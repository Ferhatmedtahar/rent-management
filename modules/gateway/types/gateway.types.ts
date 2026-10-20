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
