import "server-only";

import type { Actor } from "@/modules/auth";
import { notFound, requireRole } from "@/modules/auth/api/policy";
import { HttpError } from "@/shared/lib/http-error";
import {
  isSlipPathInOrg,
  recordPaymentSchema,
} from "../schemas/payment.schemas";
import type { PaymentDeps } from "../types/payment.types";
import { allocatePayment } from "@/shared/lib/allocation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Record a cash or bank-transfer payment on a lease.
 *
 * Order (ASSESSMENT.md section 6): the lease is looked up INSIDE the caller's
 * organization first (404), and a tenant who is not the lease's tenant also gets
 * 404; only then is the role checked (403 for a tenant who can see the lease).
 * Then validate (400), check the slip (400), and run ONE transaction that locks
 * the lease row first, so concurrent payments on a lease are serialized and
 * cannot exceed the cap together.
 *
 * Manager: approved immediately, allocated, `payment.approved` audit row.
 * Staff: pending_verification, no allocation, no audit row.
 *
 * Slip cleanup (the brief: no file left behind): once the slip is confirmed to
 * exist, ANY failure afterwards (cap exceeded, lock miss, database error) removes
 * the object, best effort, and the original error is rethrown unchanged. The
 * object is kept if another payment already references the same path.
 */
export async function recordPayment(
  deps: PaymentDeps,
  actor: Actor,
  leaseId: string,
  body: unknown,
): Promise<{ id: string; status: "approved" | "pending_verification" }> {
  const { store, slips } = deps;

  if (!UUID.test(leaseId)) notFound();
  const lease = await store.findLeaseInOrg(leaseId, actor.orgId);
  if (!lease) notFound();
  if (actor.role === "tenant" && lease.tenantId !== actor.tenantId) notFound();
  requireRole(actor, ["manager", "staff"]);

  const parsed = recordPaymentSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid input.",
    );
  }
  const input = parsed.data;

  const slipPath =
    input.method === "bank_transfer" ? (input.slipPath ?? null) : null;
  if (slipPath !== null) {
    if (!isSlipPathInOrg(slipPath, actor.orgId)) {
      throw new HttpError(
        400,
        "The slip must be in your organization's folder.",
      );
    }
    if (!(await slips.exists(slipPath))) {
      throw new HttpError(400, "The slip file was not found. Upload it first.");
    }
  }

  try {
    return await store.transaction(async (tx) => {
      // 1. The lock is always taken first.
      if (!(await tx.lockLease(leaseId, actor.orgId))) notFound();

      // 2. Cap = remaining balance - payments still waiting for approval.
      const balance = await tx.leaseBalance(leaseId);
      const cap =
        balance.invoicedSen - balance.allocatedSen - balance.pendingSen;
      if (input.amountSen > cap) {
        throw new HttpError(
          422,
          "The amount is more than the lease still owes.",
        );
      }

      // 3. Insert the payment: manager = approved now, staff = pending.
      const approved = actor.role === "manager";
      const now = new Date();
      const payment = await tx.insertPayment({
        orgId: actor.orgId,
        leaseId,
        amountSen: input.amountSen,
        unappliedSen: 0,
        method: input.method,
        status: approved ? "approved" : "pending_verification",
        receivedAt: new Date(input.receivedAt),
        slipPath,
        recordedBy: actor.userId,
        reviewedBy: approved ? actor.userId : null,
        reviewedAt: approved ? now : null,
      });
      if (!approved)
        return { id: payment.id, status: "pending_verification" as const };

      // 4. Allocate, then audit, all in the same transaction.
      const invoices = await tx.listInvoicesForAllocation(leaseId);
      const { allocations, unappliedSen } = allocatePayment(
        input.amountSen,
        invoices,
      );
      // Manual payments are capped, so nothing can be left over.
      if (unappliedSen !== 0) {
        throw new Error(
          "Invariant violated: a capped manual payment left unapplied money.",
        );
      }
      await tx.insertAllocations(actor.orgId, leaseId, payment.id, allocations);
      await tx.insertAudit({
        orgId: actor.orgId,
        actorId: actor.userId,
        action: "payment.approved",
        entityType: "payment",
        entityId: payment.id,
        details: {
          leaseId,
          amountSen: input.amountSen,
          method: input.method,
          status: "approved",
          allocations,
        },
      });
      return { id: payment.id, status: "approved" as const };
    });
  } catch (error) {
    if (slipPath !== null) await removeSlipBestEffort(deps, slipPath);
    throw error;
  }
}

async function removeSlipBestEffort(
  deps: PaymentDeps,
  slipPath: string,
): Promise<void> {
  try {
    if (await deps.store.isSlipReferenced(slipPath)) return;
    await deps.slips.remove(slipPath);
  } catch {
    // Cleanup must never mask the original error.
  }
}
