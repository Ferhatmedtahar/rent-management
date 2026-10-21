import "server-only";

import type { Actor } from "@/modules/auth";
import { notFound, requireRole } from "@/modules/auth/api/policy";
import { HttpError } from "@/shared/lib/http-error";
import { reasonSchema } from "../schemas/payment.schemas";
import type {
  PaymentRecord,
  PaymentStatus,
  PaymentStore,
  PaymentTx,
} from "../types/payment.types";
import { allocatePayment } from "@/shared/lib/allocation";

/**
 * Approve, reject and void: manager only.
 *
 * Section 6 order, for every action: the payment is looked up INSIDE the caller's
 * organization first. Missing, malformed id, another organization's, or a tenant
 * who does not own it: 404. Only then the role: staff, or a tenant who owns it: 403.
 * Then the body (400), then ONE transaction.
 *
 * Lock order is always: (1) the lease row FOR UPDATE, (2) the payment. Every
 * path that touches a lease's money (record, approve, reject, void) takes the
 * lease lock first, so they are serialized and cannot deadlock. A status-guarded
 * UPDATE is the second line: a repeated or concurrent action matches 0 rows -> 409.
 */
type Deps = { store: PaymentStore };
type Result = { status: PaymentStatus };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns the payment's lease id (immutable, so reading it before the lock is safe). */
async function authorize(
  deps: Deps,
  actor: Actor,
  paymentId: string,
): Promise<string> {
  if (!UUID.test(paymentId)) notFound();
  const found = await deps.store.findPaymentInOrg(paymentId, actor.orgId);
  if (!found) notFound();
  if (actor.role === "tenant" && found.leaseTenantId !== actor.tenantId)
    notFound();
  requireRole(actor, ["manager"]);
  return found.leaseId;
}

function parseReason(body: unknown): string {
  const parsed = reasonSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid input.",
    );
  }
  return parsed.data.reason;
}

/** Lock the lease FIRST, then load the payment, which must be in `expected`. */
async function lockAndLoad(
  tx: PaymentTx,
  actor: Actor,
  leaseId: string,
  paymentId: string,
  expected: PaymentStatus,
  wrongStateMessage: string,
): Promise<PaymentRecord> {
  if (!(await tx.lockLease(leaseId, actor.orgId))) notFound();
  const payment = await tx.getPayment(paymentId);
  if (!payment) notFound();
  if (payment.status !== expected) throw new HttpError(409, wrongStateMessage);
  return payment;
}

const ALREADY_MOVED = "This payment was already handled.";

export async function approvePayment(
  deps: Deps,
  actor: Actor,
  paymentId: string,
): Promise<Result> {
  const leaseId = await authorize(deps, actor, paymentId);

  return deps.store.transaction(async (tx) => {
    const payment = await lockAndLoad(
      tx,
      actor,
      leaseId,
      paymentId,
      "pending_verification",
      "Only a payment waiting for verification can be approved.",
    );

    // Re-check at THIS moment: not more than the lease's remaining balance
    // (invoices minus allocations). Other pending payments are irrelevant here.
    const balance = await tx.leaseBalance(leaseId);
    const remaining = balance.invoicedSen - balance.allocatedSen;
    if (payment.amountSen > remaining) {
      throw new HttpError(
        422,
        "The amount is more than the lease still owes. The payment stays pending.",
      );
    }

    const moved = await tx.transitionPayment(
      paymentId,
      "pending_verification",
      {
        status: "approved",
        reviewedBy: actor.userId,
        reviewedAt: new Date(),
      },
    );
    if (!moved) throw new HttpError(409, ALREADY_MOVED);

    const invoices = await tx.listInvoicesForAllocation(leaseId);
    const { allocations, unappliedSen } = allocatePayment(
      payment.amountSen,
      invoices,
    );
    if (unappliedSen !== 0) {
      throw new Error(
        "Invariant violated: a capped manual payment left unapplied money.",
      );
    }
    await tx.insertAllocations(actor.orgId, leaseId, paymentId, allocations);
    await tx.insertAudit({
      orgId: actor.orgId,
      actorId: actor.userId,
      action: "payment.approved",
      entityType: "payment",
      entityId: paymentId,
      details: {
        leaseId,
        amountSen: payment.amountSen,
        status: "approved",
        allocations,
      },
    });
    return { status: "approved" as const };
  });
}

export async function rejectPayment(
  deps: Deps,
  actor: Actor,
  paymentId: string,
  body: unknown,
): Promise<Result> {
  const leaseId = await authorize(deps, actor, paymentId);
  const reason = parseReason(body);

  return deps.store.transaction(async (tx) => {
    const payment = await lockAndLoad(
      tx,
      actor,
      leaseId,
      paymentId,
      "pending_verification",
      "Only a payment waiting for verification can be rejected.",
    );
    const moved = await tx.transitionPayment(
      paymentId,
      "pending_verification",
      {
        status: "rejected",
        reviewedBy: actor.userId,
        reviewedAt: new Date(),
        rejectReason: reason,
      },
    );
    if (!moved) throw new HttpError(409, ALREADY_MOVED);

    await tx.insertAudit({
      orgId: actor.orgId,
      actorId: actor.userId,
      action: "payment.rejected",
      entityType: "payment",
      entityId: paymentId,
      details: {
        leaseId,
        amountSen: payment.amountSen,
        status: "rejected",
        reason,
      },
    });
    return { status: "rejected" as const };
  });
}

/**
 * Void an approved payment. Removes ONLY this payment's allocations; other
 * payments' allocations and unapplied_sen are untouched (docs/database.md Q1).
 * This payment's own unapplied_sen goes to 0 (the table CHECK requires it for a
 * non-approved payment); its previous value and its allocations are kept in the
 * audit row, since the allocation rows are deleted.
 */
export async function voidPayment(
  deps: Deps,
  actor: Actor,
  paymentId: string,
  body: unknown,
): Promise<Result> {
  const leaseId = await authorize(deps, actor, paymentId);
  const reason = parseReason(body);

  return deps.store.transaction(async (tx) => {
    const payment = await lockAndLoad(
      tx,
      actor,
      leaseId,
      paymentId,
      "approved",
      "Only an approved payment can be voided.",
    );

    const removedAllocations = await tx.listAllocations(paymentId);
    const now = new Date();
    const moved = await tx.transitionPayment(paymentId, "approved", {
      status: "voided",
      voidedBy: actor.userId,
      voidedAt: now,
      voidReason: reason,
      unappliedSen: 0,
    });
    if (!moved) throw new HttpError(409, ALREADY_MOVED);
    await tx.deleteAllocations(paymentId);

    await tx.insertAudit({
      orgId: actor.orgId,
      actorId: actor.userId,
      action: "payment.voided",
      entityType: "payment",
      entityId: paymentId,
      details: {
        leaseId,
        amountSen: payment.amountSen,
        status: "voided",
        reason,
        previousUnappliedSen: payment.unappliedSen,
        removedAllocations,
      },
    });
    return { status: "voided" as const };
  });
}
