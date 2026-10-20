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

/** What the GET endpoint reads, as plain data (strings and numbers; no Prisma types). */
export type LeaseDetail = {
  lease: {
    id: string;
    unitId: string;
    tenantId: string;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    monthlyRentSen: number;
    depositSen: number;
  };
  invoices: {
    id: string;
    kind: "deposit" | "rent";
    periodIndex: number | null;
    periodStart: string | null;
    periodEnd: string | null;
    dueDate: string;
    amountSen: number;
    /** Sum of this invoice's allocations. */
    paidSen: number;
  }[];
  payments: {
    id: string;
    amountSen: number;
    unappliedSen: number;
    method: "cash" | "bank_transfer" | "online";
    status: "pending_verification" | "approved" | "rejected" | "voided";
    receivedAt: Date;
  }[];
};

export interface LeaseReadStore {
  /**
   * The lease, scoped to the organization and, when `tenantId` is given, to that
   * tenant's own lease. Null otherwise (the service answers 404).
   */
  findLeaseDetail(
    leaseId: string,
    orgId: string,
    tenantId?: string,
  ): Promise<LeaseDetail | null>;
  listLeases(orgId: string): Promise<LeaseSummary[]>;
}

export type LeaseSummary = {
  id: string;
  unitName: string;
  tenantName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  monthlyRentSen: number;
  depositSen: number;
};
