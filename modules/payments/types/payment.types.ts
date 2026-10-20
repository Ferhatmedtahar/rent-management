export type PaymentMethodInput = "cash" | "bank_transfer";

export type RecordPaymentInput = {
  amountSen: number;
  method: PaymentMethodInput;
  receivedAt: string;
  slipPath?: string;
};

/** An invoice as the allocation sees it. dueDate is YYYY-MM-DD. */
export type AllocatableInvoice = {
  id: string;
  kind: "deposit" | "rent";
  periodIndex: number | null;
  dueDate: string;
  amountSen: number;
  /** Already allocated by this lease's other approved payments. */
  allocatedSen: number;
};

export type AllocationRow = { invoiceId: string; amountSen: number };

export type NewPayment = {
  orgId: string;
  leaseId: string;
  amountSen: number;
  unappliedSen: number;
  method: PaymentMethodInput;
  status: "pending_verification" | "approved";
  receivedAt: Date;
  slipPath: string | null;
  recordedBy: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
};

export type AuditEntry = {
  orgId: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
};

export type LeaseBalance = {
  /** Sum of all the lease's invoices. */
  invoicedSen: number;
  /** Sum of all allocations of the lease. */
  allocatedSen: number;
  /** Sum of the lease's payments still pending_verification. */
  pendingSen: number;
};

/** Everything done inside ONE database transaction. */
export interface PaymentTx {
  /** SELECT ... FOR UPDATE on the lease row. False when no such lease in the org. */
  lockLease(leaseId: string, orgId: string): Promise<boolean>;
  leaseBalance(leaseId: string): Promise<LeaseBalance>;
  listInvoicesForAllocation(leaseId: string): Promise<AllocatableInvoice[]>;
  insertPayment(payment: NewPayment): Promise<{ id: string }>;
  insertAllocations(
    orgId: string,
    leaseId: string,
    paymentId: string,
    rows: AllocationRow[],
  ): Promise<void>;
  insertAudit(entry: AuditEntry): Promise<void>;
}

export interface PaymentStore {
  /** The lease if it is in the organization; used before anything else. */
  findLeaseInOrg(
    leaseId: string,
    orgId: string,
  ): Promise<{ id: string; tenantId: string } | null>;
  /** True when any payment already points at this slip path. */
  isSlipReferenced(slipPath: string): Promise<boolean>;
  transaction<T>(work: (tx: PaymentTx) => Promise<T>): Promise<T>;
}

/** The private payment-slips bucket, through the admin client. */
export interface SlipStorage {
  exists(path: string): Promise<boolean>;
  remove(path: string): Promise<void>;
}

export type PaymentDeps = { store: PaymentStore; slips: SlipStorage };
