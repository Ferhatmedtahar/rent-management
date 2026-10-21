/** Wire shapes of the reports API (/api/reports/*). Shared by client and server. */

export type OverdueReportResponse = {
  overdueCount: number;
};

export type MonthlyCollection = {
  month: string; // YYYY-MM
  collectedSen: number;
};
