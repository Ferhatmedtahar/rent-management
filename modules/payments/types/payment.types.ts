export type PaymentMethodInput = "cash" | "bank_transfer";

export type RecordPaymentInput = {
  amountSen: number;
  method: PaymentMethodInput;
  receivedAt: string;
  slipPath?: string;
};

export type {
  AllocatableInvoice,
  AllocationRow,
} from "@/shared/lib/allocation";
import type {
  AllocatableInvoice,
  AllocationRow,
} from "@/shared/lib/allocation";

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

export type PaymentStatus =
  "pending_verification" | "approved" | "rejected" | "voided";

/** A payment row as the review actions need it. */
export type PaymentRecord = {
  id: string;
  leaseId: string;
  amountSen: number;
  unappliedSen: number;
  status: PaymentStatus;
};

/** Fields a status transition may set. Undefined = leave unchanged. */
export type PaymentPatch = {
  status: PaymentStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  rejectReason?: string;
  voidedBy?: string;
  voidedAt?: Date;
  voidReason?: string;
  unappliedSen?: number;
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
  getPayment(paymentId: string): Promise<PaymentRecord | null>;
  /**
   * UPDATE ... WHERE id = $1 AND status = $from. False when no row matched
   * (somebody else already moved it), which the service reports as 409.
   */
  transitionPayment(
    paymentId: string,
    from: PaymentStatus,
    patch: PaymentPatch,
  ): Promise<boolean>;
  listAllocations(paymentId: string): Promise<AllocationRow[]>;
  /** Deletes ONLY this payment's allocation rows. */
  deleteAllocations(paymentId: string): Promise<void>;
}

export interface PaymentStore {
  /** The lease if it is in the organization; used before anything else. */
  findLeaseInOrg(
    leaseId: string,
    orgId: string,
  ): Promise<{ id: string; tenantId: string } | null>;
  /** The payment with its lease's tenant, if its lease is in the organization. */
  findPaymentInOrg(
    paymentId: string,
    orgId: string,
  ): Promise<{ id: string; leaseId: string; leaseTenantId: string } | null>;
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
