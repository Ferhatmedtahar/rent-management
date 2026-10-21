/** An invoice's unpaid state, as the bill amount needs it. dueDate is YYYY-MM-DD. */
export type InvoiceBalance = {
  dueDate: string;
  amountSen: number;
  /** Sum of the invoice's allocations. */
  allocatedSen: number;
};

export type NewBill = {
  id: string;
  orgId: string;
  leaseId: string;
  amountSen: number;
  createdBy: string;
};

export interface GatewayTx {
  /** SELECT ... FOR UPDATE on the lease row. False when no such lease in the org. */
  lockLease(leaseId: string, orgId: string): Promise<boolean>;
  listInvoiceBalances(leaseId: string): Promise<InvoiceBalance[]>;
  insertBill(bill: NewBill): Promise<void>;
}

export interface GatewayStore {
  findLeaseInOrg(
    leaseId: string,
    orgId: string,
  ): Promise<{ id: string; tenantId: string } | null>;
  transaction<T>(work: (tx: GatewayTx) => Promise<T>): Promise<T>;
}

export type GatewayDeps = {
  store: GatewayStore;
  /** Injected so tests control "today". */
  now: () => Date;
  /** Injected so tests can pin the id; production uses `newBillId`. */
  newBillId: () => string;
};

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

export type BillStatus = "pending" | "paid" | "failed";

export type BillRecord = {
  id: string;
  orgId: string;
  leaseId: string;
  amountSen: number;
  status: BillStatus;
};

export type OnlinePayment = {
  orgId: string;
  leaseId: string;
  amountSen: number;
  unappliedSen: number;
  receivedAt: Date;
  gatewayBillId: string;
  reviewedAt: Date;
};

export type WebhookAudit = {
  orgId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
};

export interface WebhookTx {
  /** SELECT ... FOR UPDATE on the lease row. Always taken FIRST. */
  lockLease(leaseId: string, orgId: string): Promise<boolean>;
  /**
   * UPDATE gateway_bills SET status='paid', paid_at, transaction_id
   * WHERE id = $1 AND status <> 'paid'. True when this call settled the bill;
   * false when it was already paid (a repeat delivery).
   */
  markBillPaid(
    billId: string,
    paidAt: Date,
    transactionId: string | null,
  ): Promise<boolean>;
  listInvoicesForAllocation(leaseId: string): Promise<
    {
      id: string;
      kind: "deposit" | "rent";
      periodIndex: number | null;
      dueDate: string;
      amountSen: number;
      allocatedSen: number;
    }[]
  >;
  insertOnlinePayment(payment: OnlinePayment): Promise<{ id: string }>;
  insertAllocations(
    orgId: string,
    leaseId: string,
    paymentId: string,
    rows: { invoiceId: string; amountSen: number }[],
  ): Promise<void>;
  /** The actor is null: the gateway is not a user. */
  insertAudit(entry: WebhookAudit): Promise<void>;
}

export interface WebhookStore {
  /** By primary key; the id is text and is never cast. */
  findBill(billId: string): Promise<BillRecord | null>;
  /** UPDATE ... SET status='failed' WHERE id = $1 AND status = 'pending'. */
  markBillFailed(billId: string): Promise<void>;
  transaction<T>(work: (tx: WebhookTx) => Promise<T>): Promise<T>;
}

export type WebhookDeps = {
  store: WebhookStore;
  /** GATEWAY_X_SIGNATURE_KEY, read through env.ts by the handler. */
  signatureKey: string;
  now: () => Date;
};

/** The bill as the return page and the read endpoint show it. */
export type BillView = {
  billId: string;
  amountSen: number;
  status: BillStatus;
};

export interface BillReadStore {
  findBillInOrg(
    billId: string,
    orgId: string,
  ): Promise<{
    id: string;
    amountSen: number;
    status: BillStatus;
    leaseTenantId: string;
  } | null>;
}
