import "server-only";

import { allocatePayment } from "@/shared/lib/allocation";
import { HttpError } from "@/shared/lib/http-error";
import { isUniqueViolation } from "../repositories/db-errors";
import type { WebhookDeps } from "../types/gateway.types";
import { parsePaidAt } from "./paid-at";
import { parseFormFields, verifySignature } from "./signature";

/**
 * POST /api/webhooks/gateway, the brief's table, literally. The signature is
 * the only authentication (the gateway is not a user).
 *
 *   signature missing/wrong ........ 401, nothing else happens (no store call)
 *   unknown bill id ................ 404
 *   paid=true, amount mismatch ..... 422
 *   paid=true, bill pending/failed . 200, bill paid, ONE approved online payment, allocated
 *   paid=true, bill already paid ... 200, no effect (repeat delivery)
 *   paid=false, bill pending ....... 200, bill failed
 *   paid=false, failed or paid ..... 200, no effect (a paid bill never goes back)
 *   any other `paid` value ......... 422
 *
 * Exactly-once: inside ONE transaction the lease row is locked FIRST, then the
 * bill is moved with `UPDATE ... WHERE status <> 'paid'`. Only the call that
 * changes the row creates the payment; a repeat or concurrent delivery matches
 * 0 rows and is a no-op. UNIQUE(payments.gateway_bill_id) is the last line of
 * defence: a unique violation means a concurrent winner, also a 200.
 *
 * Logging: never the key, the signature, or any callback field. Only generic text.
 */
export async function handleGatewayCallback(
  deps: WebhookDeps,
  rawBody: string,
): Promise<{ ok: true }> {
  const { store } = deps;

  // 1. Signature first. Nothing else runs, and the database is never touched, until it verifies.
  const fields = parseFormFields(rawBody);
  if (!fields || !verifySignature(fields, deps.signatureKey)) {
    throw new HttpError(401, "Invalid signature.");
  }

  // 2. Unknown bill.
  const bill = await store.findBill(fields.get("id") ?? "");
  if (!bill) throw new HttpError(404, "Unknown bill.");

  const paid = fields.get("paid");
  if (paid === "false") {
    // Only a pending bill can fail; a racing paid=true is never overwritten.
    await store.markBillFailed(bill.id);
    return { ok: true };
  }
  if (paid !== "true") throw new HttpError(422, "Invalid paid value.");

  // 3. paid=true: amount must equal the bill's, paid_at must parse.
  const paidAmount = fields.get("paid_amount") ?? "";
  if (!/^\d{1,16}$/.test(paidAmount) || Number(paidAmount) !== bill.amountSen) {
    throw new HttpError(422, "The paid amount does not match the bill.");
  }
  const paidAt = parsePaidAt(fields.get("paid_at"));
  if (!paidAt)
    throw new HttpError(422, "paid_at is not a valid date and time.");
  const rawTransactionId = fields.get("transaction_id") ?? "";
  const transactionId =
    rawTransactionId.length >= 1 && rawTransactionId.length <= 255
      ? rawTransactionId
      : null;

  try {
    await store.transaction(async (tx) => {
      // Lock order: the lease row first, then the bill.
      if (!(await tx.lockLease(bill.leaseId, bill.orgId))) {
        throw new Error("lease for bill not found");
      }
      const settled = await tx.markBillPaid(bill.id, paidAt, transactionId);
      if (!settled) return; // already paid: a repeat delivery

      const invoices = await tx.listInvoicesForAllocation(bill.leaseId);
      const { allocations, unappliedSen } = allocatePayment(
        bill.amountSen,
        invoices,
      );
      const payment = await tx.insertOnlinePayment({
        orgId: bill.orgId,
        leaseId: bill.leaseId,
        amountSen: bill.amountSen,
        unappliedSen,
        receivedAt: paidAt,
        gatewayBillId: bill.id,
        reviewedAt: deps.now(),
      });
      await tx.insertAllocations(
        bill.orgId,
        bill.leaseId,
        payment.id,
        allocations,
      );
      await tx.insertAudit({
        orgId: bill.orgId,
        action: "payment.approved",
        entityType: "payment",
        entityId: payment.id,
        details: {
          source: "gateway",
          billId: bill.id,
          leaseId: bill.leaseId,
          amountSen: bill.amountSen,
          unappliedSen,
          allocations,
        },
      });
    });
  } catch (error) {
    // A concurrent winner already created the payment: same outcome as a repeat.
    if (isUniqueViolation(error)) return { ok: true };
    // Do not log the error itself: driver errors can quote request values.
    console.error("Gateway webhook processing failed.");
    throw new HttpError(500, "Something went wrong. Please try again.");
  }
  return { ok: true };
}
