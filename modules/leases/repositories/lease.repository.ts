import "server-only";

import type { ScheduledInvoice } from "@/lib/billing";
import { prisma } from "@/shared/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type {
  AuditEntry,
  LeaseReadStore,
  LeaseStore,
  LeaseTx,
  NewLease,
} from "../types/lease.types";

/** YYYY-MM-DD -> UTC-midnight Date for @db.Date columns. The only place this happens. */
function toDbDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function txRepository(tx: Prisma.TransactionClient): LeaseTx {
  return {
    // Scoped by org: a unit/tenant of another organization is "not found".
    findUnitInOrg: (unitId, orgId) =>
      tx.unit.findFirst({ where: { id: unitId, orgId }, select: { id: true } }),

    findTenantInOrg: (tenantId, orgId) =>
      tx.tenant.findFirst({
        where: { id: tenantId, orgId },
        select: { id: true },
      }),

    insertLease: (lease: NewLease) =>
      tx.lease.create({
        data: {
          orgId: lease.orgId,
          unitId: lease.unitId,
          tenantId: lease.tenantId,
          startDate: toDbDate(lease.startDate),
          endDate: toDbDate(lease.endDate),
          monthlyRentSen: BigInt(lease.monthlyRentSen),
          depositSen: BigInt(lease.depositSen),
          createdBy: lease.createdBy,
        },
        select: { id: true },
      }),

    async insertInvoices(orgId, leaseId, invoices: ScheduledInvoice[]) {
      await tx.invoice.createMany({
        data: invoices.map((invoice) => ({
          orgId,
          leaseId,
          kind: invoice.kind,
          periodIndex: invoice.periodIndex,
          periodStart: invoice.periodStart
            ? toDbDate(invoice.periodStart)
            : null,
          periodEnd: invoice.periodEnd ? toDbDate(invoice.periodEnd) : null,
          dueDate: toDbDate(invoice.dueDate),
          amountSen: BigInt(invoice.amountSen),
        })),
      });
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

export const leaseStore: LeaseStore = {
  transaction: (work) => prisma.$transaction((tx) => work(txRepository(tx))),
};

/** Prisma returns @db.Date as a UTC-midnight Date: the date is its first 10 ISO characters. */
const toDateString = (date: Date): string => date.toISOString().slice(0, 10);

export const leaseReader: LeaseReadStore = {
  async findLeaseDetail(leaseId, orgId, tenantId) {
    // Scoped by organization, and by tenant for a tenant caller: no row = 404.
    const lease = await prisma.lease.findFirst({
      where: { id: leaseId, orgId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!lease) return null;

    const [invoices, allocated, payments] = await Promise.all([
      prisma.invoice.findMany({
        where: { leaseId },
        orderBy: [{ dueDate: "asc" }, { kind: "asc" }, { periodIndex: "asc" }],
      }),
      prisma.paymentAllocation.groupBy({
        by: ["invoiceId"],
        where: { leaseId },
        _sum: { amountSen: true },
      }),
      prisma.payment.findMany({
        where: { leaseId },
        orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
      }),
    ]);
    const paidBy = new Map(
      allocated.map((row) => [row.invoiceId, Number(row._sum.amountSen ?? 0)]),
    );

    return {
      lease: {
        id: lease.id,
        unitId: lease.unitId,
        tenantId: lease.tenantId,
        startDate: toDateString(lease.startDate),
        endDate: toDateString(lease.endDate),
        monthlyRentSen: Number(lease.monthlyRentSen),
        depositSen: Number(lease.depositSen),
      },
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        kind: invoice.kind,
        periodIndex: invoice.periodIndex,
        periodStart: invoice.periodStart
          ? toDateString(invoice.periodStart)
          : null,
        periodEnd: invoice.periodEnd ? toDateString(invoice.periodEnd) : null,
        dueDate: toDateString(invoice.dueDate),
        amountSen: Number(invoice.amountSen),
        paidSen: paidBy.get(invoice.id) ?? 0,
      })),
      payments: payments.map((payment) => ({
        id: payment.id,
        amountSen: Number(payment.amountSen),
        unappliedSen: Number(payment.unappliedSen),
        method: payment.method,
        status: payment.status,
        receivedAt: payment.receivedAt,
      })),
    };
  },
};
