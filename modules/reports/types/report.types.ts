export type CollectionsRow = { month: string; collectedSen: number };

export type OverdueReport = { overdueCount: number };

/** A payment as the report reads it. The sum is done in bigint, converted at the very end. */
export type PaymentForReport = {
  receivedAt: Date;
  amountSen: bigint;
  status: "pending_verification" | "approved" | "rejected" | "voided";
};

export interface ReportStore {
  /**
   * Payments of ONE organization with received_at in [start, endExclusive).
   * The repository filters status = 'approved' (the partial index
   * (org_id, received_at) WHERE status = 'approved'); the service re-checks.
   */
  listPaymentsReceivedBetween(
    orgId: string,
    start: Date,
    endExclusive: Date,
  ): Promise<PaymentForReport[]>;

  /**
   * Count of invoices belonging to ONE organization where:
   * 1. sum(payment_allocations) < amount_sen (not fully paid)
   * 2. due_date < asOfMalaysiaDate (due before asOfMalaysiaDate)
   */
  countOverdueInvoices(
    orgId: string,
    asOfMalaysiaDate: string,
  ): Promise<number>;
}
