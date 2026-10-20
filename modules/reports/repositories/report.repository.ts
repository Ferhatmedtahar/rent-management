import "server-only";

import { prisma } from "@/shared/db/prisma";
import type { ReportStore } from "../types/report.types";

/** YYYY-MM-DD -> UTC-midnight Date for @db.Date columns. */
function toDbDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export const reportStore: ReportStore = {
  // One range scan on the partial index (org_id, received_at) WHERE status = 'approved'.
  // Months are bounded by the service as +08:00 instants: no timezone cast in SQL.
  listPaymentsReceivedBetween: (orgId, start, endExclusive) =>
    prisma.payment.findMany({
      where: {
        orgId,
        status: "approved",
        receivedAt: { gte: start, lt: endExclusive },
      },
      select: { receivedAt: true, amountSen: true, status: true },
    }),

  async countOverdueInvoices(orgId, asOfMalaysiaDate) {
    const invoices = await prisma.invoice.findMany({
      where: {
        orgId,
        dueDate: { lt: toDbDate(asOfMalaysiaDate) },
      },
      select: {
        id: true,
        amountSen: true,
      },
    });
    if (invoices.length === 0) return 0;

    const allocated = await prisma.paymentAllocation.groupBy({
      by: ["invoiceId"],
      where: {
        orgId,
        invoiceId: { in: invoices.map((i) => i.id) },
      },
      _sum: { amountSen: true },
    });
    const paidBy = new Map(
      allocated.map((row) => [row.invoiceId, row._sum.amountSen ?? BigInt(0)]),
    );

    let overdueCount = 0;
    for (const inv of invoices) {
      const paid = paidBy.get(inv.id) ?? BigInt(0);
      if (paid < inv.amountSen) {
        overdueCount++;
      }
    }
    return overdueCount;
  },
};
