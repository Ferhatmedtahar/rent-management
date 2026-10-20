export type CollectionsRow = { month: string; collectedSen: number };

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
}
