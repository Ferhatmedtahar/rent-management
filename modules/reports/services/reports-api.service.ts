import { api } from "@/shared/lib/api-client";
import type {
  MonthlyCollection,
  OverdueReportResponse,
} from "../types/reports-api.types";

export function fetchOverdueReport(
  signal?: AbortSignal,
): Promise<OverdueReportResponse> {
  return api.get<OverdueReportResponse>("/reports/overdue", { signal });
}

export function fetchCollectionsReport(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<MonthlyCollection[]> {
  return api.get<MonthlyCollection[]>("/reports/collections", {
    query: { from, to },
    signal,
  });
}
