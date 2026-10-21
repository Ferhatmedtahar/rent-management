import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/prisma";
import type {
  AuditEntry,
  PaymentStore,
  PaymentTx,
} from "../types/payment.types";

const toNumber = (value: bigint | null | undefined): number =>
  Number(value ?? BigInt(0));

function txRepository(tx: Prisma.TransactionClient): PaymentTx {
  return {
    async lockLease(leaseId, orgId) {
      // findUnique does not lock. FOR UPDATE serializes everything on this lease.
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM leases WHERE id = ${leaseId}::uuid AND org_id = ${orgId}::uuid FOR UPDATE`;
      return rows.length === 1;
    },

    async leaseBalance(leaseId) {
      const [invoiced, allocated, pending] = await Promise.all([
        tx.invoice.aggregate({ where: { leaseId }, _sum: { amountSen: true } }),
        tx.paymentAllocation.aggregate({
          where: { leaseId },
          _sum: { amountSen: true },
        }),
        tx.payment.aggregate({
          where: { leaseId, status: "pending_verification" },
          _sum: { amountSen: true },
        }),
      ]);
      return {
        invoicedSen: toNumber(invoiced._sum.amountSen),
        allocatedSen: toNumber(allocated._sum.amountSen),
        pendingSen: toNumber(pending._sum.amountSen),
      };
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
        allocated.map((row) => [row.invoiceId, toNumber(row._sum.amountSen)]),
      );
      return invoices.map((invoice) => ({
        id: invoice.id,
        kind: invoice.kind,
        periodIndex: invoice.periodIndex,
        dueDate: invoice.dueDate.toISOString().slice(0, 10),
        amountSen: toNumber(invoice.amountSen),
        allocatedSen: allocatedBy.get(invoice.id) ?? 0,
      }));
    },

    insertPayment: (payment) =>
      tx.payment.create({
        data: {
          orgId: payment.orgId,
          leaseId: payment.leaseId,
          amountSen: BigInt(payment.amountSen),
          unappliedSen: BigInt(payment.unappliedSen),
          method: payment.method,
          status: payment.status,
          receivedAt: payment.receivedAt,
          slipPath: payment.slipPath,
          recordedBy: payment.recordedBy,
          reviewedBy: payment.reviewedBy,
          reviewedAt: payment.reviewedAt,
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

    async getPayment(paymentId) {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) return null;
      return {
        id: payment.id,
        leaseId: payment.leaseId,
        amountSen: toNumber(payment.amountSen),
        unappliedSen: toNumber(payment.unappliedSen),
        status: payment.status,
      };
    },

    async transitionPayment(paymentId, from, patch) {
      // The status guard makes a repeated or concurrent transition match 0 rows.
      const result = await tx.payment.updateMany({
        where: { id: paymentId, status: from },
        data: {
          status: patch.status,
          reviewedBy: patch.reviewedBy,
          reviewedAt: patch.reviewedAt,
          rejectReason: patch.rejectReason,
          voidedBy: patch.voidedBy,
          voidedAt: patch.voidedAt,
          voidReason: patch.voidReason,
          unappliedSen:
            patch.unappliedSen === undefined
              ? undefined
              : BigInt(patch.unappliedSen),
        },
      });
      return result.count === 1;
    },

    async listAllocations(paymentId) {
      const rows = await tx.paymentAllocation.findMany({
        where: { paymentId },
        orderBy: { createdAt: "asc" },
      });
      return rows.map((row) => ({
        invoiceId: row.invoiceId,
        amountSen: toNumber(row.amountSen),
      }));
    },

    async deleteAllocations(paymentId) {
      await tx.paymentAllocation.deleteMany({ where: { paymentId } });
    },

    async insertAudit(entry: AuditEntry) {
      await tx.auditLog.create({
        data: {
          orgId: entry.orgId,
          actorId: entry.actorId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          details: entry.details as Prisma.InputJsonValue,
        },
      });
    },
  };
}

export const paymentStore: PaymentStore = {
  findLeaseInOrg: (leaseId, orgId) =>
    prisma.lease.findFirst({
      where: { id: leaseId, orgId },
      select: { id: true, tenantId: true },
    }),

  async findPaymentInOrg(paymentId, orgId) {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, orgId },
      select: {
        id: true,
        leaseId: true,
        lease: { select: { tenantId: true } },
      },
    });
    return payment
      ? {
          id: payment.id,
          leaseId: payment.leaseId,
          leaseTenantId: payment.lease.tenantId,
        }
      : null;
  },

  async isSlipReferenced(slipPath) {
    return (await prisma.payment.count({ where: { slipPath } })) > 0;
  },

  transaction: (work) => prisma.$transaction((tx) => work(txRepository(tx))),
};
