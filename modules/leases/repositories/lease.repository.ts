import "server-only";

import type { ScheduledInvoice } from "@/lib/billing";
import { prisma } from "@/shared/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type {
  AuditEntry,
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
