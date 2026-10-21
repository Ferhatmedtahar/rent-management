import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/prisma";
import type { WebhookStore, WebhookTx } from "../types/gateway.types";

function txRepository(tx: Prisma.TransactionClient): WebhookTx {
  return {
    async lockLease(leaseId, orgId) {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM leases WHERE id = ${leaseId}::uuid AND org_id = ${orgId}::uuid FOR UPDATE`;
      return rows.length === 1;
    },

    async markBillPaid(billId, paidAt, transactionId) {
      // The status guard is what makes repeat and concurrent deliveries no-ops.
      const result = await tx.gatewayBill.updateMany({
        where: { id: billId, status: { not: "paid" } },
        data: { status: "paid", paidAt, transactionId },
      });
      return result.count === 1;
    },

    async listInvoicesForAllocation(leaseId) {
      const [invoices, allocated] = await Promise.all([
        tx.invoice.findMany({ where: { leaseId } }),
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
        id: invoice.id,
        kind: invoice.kind,
        periodIndex: invoice.periodIndex,
        dueDate: invoice.dueDate.toISOString().slice(0, 10),
        amountSen: Number(invoice.amountSen),
        allocatedSen: allocatedBy.get(invoice.id) ?? 0,
      }));
    },

    insertOnlinePayment: (payment) =>
      tx.payment.create({
        data: {
          orgId: payment.orgId,
          leaseId: payment.leaseId,
          amountSen: BigInt(payment.amountSen),
          unappliedSen: BigInt(payment.unappliedSen),
          method: "online",
          status: "approved",
          receivedAt: payment.receivedAt,
          gatewayBillId: payment.gatewayBillId,
          reviewedAt: payment.reviewedAt,
          // recorded_by and reviewed_by stay null: the gateway is not a user.
        },
        select: { id: true },
      }),

    async insertAllocations(orgId, leaseId, paymentId, rows) {
      if (rows.length === 0) return;
      await tx.paymentAllocation.createMany({
        data: rows.map((row) => ({
          orgId,
          leaseId,
          paymentId,
          invoiceId: row.invoiceId,
          amountSen: BigInt(row.amountSen),
        })),
      });
    },

    async insertAudit(entry) {
      await tx.auditLog.create({
        data: {
          orgId: entry.orgId,
          actorId: null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          details: entry.details as Prisma.InputJsonValue,
        },
      });
    },
  };
}

export const gatewayWebhookStore: WebhookStore = {
  async findBill(billId) {
    const bill = await prisma.gatewayBill.findUnique({ where: { id: billId } });
    return bill
      ? {
          id: bill.id,
          orgId: bill.orgId,
          leaseId: bill.leaseId,
          amountSen: Number(bill.amountSen),
          status: bill.status,
        }
      : null;
  },

  async markBillFailed(billId) {
    // Only pending -> failed. A paid bill never goes back; a failed one stays failed.
    await prisma.gatewayBill.updateMany({
      where: { id: billId, status: "pending" },
      data: { status: "failed" },
    });
  },

  transaction: (work) => prisma.$transaction((tx) => work(txRepository(tx))),
};
