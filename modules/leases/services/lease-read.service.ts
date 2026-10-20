import "server-only";

import { invoiceStatus, type InvoiceStatus } from "@/lib/billing";
import type { Actor } from "@/modules/auth";
import { notFound } from "@/modules/auth/api/policy";
import { toMalaysiaIso } from "@/shared/lib/malaysia-time";
import type { LeaseDetail, LeaseReadStore } from "../types/lease.types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LeaseView = {
  lease: LeaseDetail["lease"];
  invoices: (LeaseDetail["invoices"][number] & { status: InvoiceStatus })[];
  payments: (Omit<LeaseDetail["payments"][number], "receivedAt"> & {
    receivedAt: string;
  })[];
};

const KIND_ORDER = { deposit: 0, rent: 1 } as const;

/** Allocation order: due date, deposit before rent, period index. */
function byAllocationOrder(
  a: LeaseDetail["invoices"][number],
  b: LeaseDetail["invoices"][number],
): number {
  if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  return (a.periodIndex ?? -1) - (b.periodIndex ?? -1);
}

/**
 * GET /api/leases/:leaseId. Staff and managers of the lease's organization, and
 * the lease's own tenant. Everything else (unknown, malformed id, another
 * organization, another tenant) is 404: every allowed caller can see the lease,
 * so nobody gets 403 here. `now` is injected so statuses are testable.
 */
export async function getLease(
  store: LeaseReadStore,
  actor: Actor,
  leaseId: string,
  now: Date,
): Promise<LeaseView> {
  if (!UUID.test(leaseId)) notFound();
  if (actor.role === "tenant" && !actor.tenantId) notFound();

  const detail = await store.findLeaseDetail(
    leaseId,
    actor.orgId,
    actor.role === "tenant" ? actor.tenantId : undefined,
  );
  if (!detail) notFound();

  return {
    lease: detail.lease,
    invoices: [...detail.invoices].sort(byAllocationOrder).map((invoice) => ({
      ...invoice,
      status: invoiceStatus(invoice, now),
    })),
    payments: detail.payments.map((payment) => ({
      ...payment,
      receivedAt: toMalaysiaIso(payment.receivedAt),
    })),
  };
}
