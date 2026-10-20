import "server-only";

import type { Actor } from "@/modules/auth";
import { notFound, requireRole } from "@/modules/auth/api/policy";
import { HttpError } from "@/shared/lib/http-error";
import { todayInMalaysia } from "@/shared/lib/malaysia-time";
import type { GatewayDeps } from "../types/gateway.types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * "Pay now": create a gateway bill for the amount due now = the unpaid amounts of
 * the lease's invoices due on or before TODAY IN MALAYSIA (invoices not yet due
 * are excluded). Nothing due -> 422. Existing pending bills are NOT subtracted.
 *
 * Tenant who owns the lease only. The lease is looked up inside the caller's
 * organization first (404 for unknown, malformed, other organization, or a
 * tenant who does not own it); a manager or staff member who can see it gets 403.
 * The lease row is locked before allocations are read, so the amount is
 * consistent with payments being approved or voided at the same time.
 */
export async function createGatewayBill(
  deps: GatewayDeps,
  actor: Actor,
  leaseId: string,
): Promise<{ billId: string; amountSen: number }> {
  if (!UUID.test(leaseId)) notFound();
  const lease = await deps.store.findLeaseInOrg(leaseId, actor.orgId);
  if (!lease) notFound();
  if (actor.role === "tenant" && lease.tenantId !== actor.tenantId) notFound();
  requireRole(actor, ["tenant"]);

  const today = todayInMalaysia(deps.now());
  const billId = deps.newBillId();

  return deps.store.transaction(async (tx) => {
    if (!(await tx.lockLease(leaseId, actor.orgId))) notFound();

    const balances = await tx.listInvoiceBalances(leaseId);
    let amountSen = 0;
    for (const invoice of balances) {
      const unpaid = invoice.amountSen - invoice.allocatedSen;
      // YYYY-MM-DD strings compare correctly as text.
      if (invoice.dueDate <= today && unpaid > 0) amountSen += unpaid;
    }
    if (amountSen === 0) throw new HttpError(422, "Nothing is due right now.");

    await tx.insertBill({
      id: billId,
      orgId: actor.orgId,
      leaseId,
      amountSen,
      createdBy: actor.userId,
    });
    return { billId, amountSen };
  });
}
