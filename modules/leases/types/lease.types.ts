import type { ScheduledInvoice } from "@/lib/billing";

/** A validated create-lease request. Dates are YYYY-MM-DD, money is integer sen. */
export type CreateLeaseInput = {
  unitId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  monthlyRentSen: number;
  depositSen: number;
};

export type NewLease = CreateLeaseInput & { orgId: string; createdBy: string };

export type AuditEntry = {
  orgId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
};

/** Everything the service does inside ONE database transaction. */
export interface LeaseTx {
  findUnitInOrg(unitId: string, orgId: string): Promise<{ id: string } | null>;
  findTenantInOrg(
    tenantId: string,
    orgId: string,
  ): Promise<{ id: string } | null>;
  insertLease(lease: NewLease): Promise<{ id: string }>;
  insertInvoices(
    orgId: string,
    leaseId: string,
    invoices: ScheduledInvoice[],
  ): Promise<void>;
  insertAudit(entry: AuditEntry): Promise<void>;
}

/** Runs `work` in a transaction: any throw rolls every write back. */
export interface LeaseStore {
  transaction<T>(work: (tx: LeaseTx) => Promise<T>): Promise<T>;
}
