import "server-only";

import type { Actor } from "@/modules/auth";
import { notFound } from "@/modules/auth/api/policy";
import type { BillReadStore, BillView } from "../types/gateway.types";

const BILL_ID = /^bill_[A-Za-z0-9_-]{32,128}$/;

/**
 * The bill's REAL status from the database, for the return page. Visible to the
 * lease's own tenant and to staff and managers of the organization; everything
 * else (unknown, malformed, other organization, other tenant) is 404. Read only.
 */
export async function getBill(
  store: BillReadStore,
  actor: Actor,
  billId: string,
): Promise<BillView> {
  if (!BILL_ID.test(billId)) notFound();
  const bill = await store.findBillInOrg(billId, actor.orgId);
  if (!bill) notFound();
  if (actor.role === "tenant" && bill.leaseTenantId !== actor.tenantId)
    notFound();
  return { billId: bill.id, amountSen: bill.amountSen, status: bill.status };
}
