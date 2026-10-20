import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/prisma";
import type {
  BillReadStore,
  GatewayStore,
  GatewayTx,
} from "../types/gateway.types";

function txRepository(tx: Prisma.TransactionClient): GatewayTx {
  return {
    async lockLease(leaseId, orgId) {
      // findUnique does not lock. FOR UPDATE serializes this against payments on the lease.
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM leases WHERE id = ${leaseId}::uuid AND org_id = ${orgId}::uuid FOR UPDATE`;
      return rows.length === 1;
    },

    async listInvoiceBalances(leaseId) {
      const [invoices, allocated] = await Promise.all([
        tx.invoice.findMany({
          where: { leaseId },
          select: { id: true, dueDate: true, amountSen: true },
        }),
        tx.paymentAllocation.groupBy({
          by: ["invoiceId"],
          where: { leaseId },
          _sum: { amountSen: true },
        }),
      ]);
      const allocatedBy = new Map(
        allocated.map((row) => [
          row.invoiceId,
          Number(row._sum.amountSen ?? 0),
        ]),
      );
      return invoices.map((invoice) => ({
        dueDate: invoice.dueDate.toISOString().slice(0, 10),
        amountSen: Number(invoice.amountSen),
        allocatedSen: allocatedBy.get(invoice.id) ?? 0,
      }));
    },

    async insertBill(bill) {
      await tx.gatewayBill.create({
        data: {
          id: bill.id,
          orgId: bill.orgId,
          leaseId: bill.leaseId,
          amountSen: BigInt(bill.amountSen),
          status: "pending",
          createdBy: bill.createdBy,
        },
      });
    },
  };
}

export const gatewayStore: GatewayStore = {
  findLeaseInOrg: (leaseId, orgId) =>
    prisma.lease.findFirst({
      where: { id: leaseId, orgId },
      select: { id: true, tenantId: true },
    }),

  transaction: (work) => prisma.$transaction((tx) => work(txRepository(tx))),
};

export const billReader: BillReadStore = {
  async findBillInOrg(billId, orgId) {
    const bill = await prisma.gatewayBill.findFirst({
      where: { id: billId, orgId },
      select: {
        id: true,
        amountSen: true,
        status: true,
        lease: { select: { tenantId: true } },
      },
    });
    return bill
      ? {
          id: bill.id,
          amountSen: Number(bill.amountSen),
          status: bill.status,
          leaseTenantId: bill.lease.tenantId,
        }
      : null;
  },
};
