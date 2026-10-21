import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { fetchCollectionsReport } from "../services/reports-api.service";

export function useCollections(from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.reports.collections(from, to),
    queryFn: ({ signal }) => fetchCollectionsReport(from, to, signal),
    enabled: Boolean(from && to),
    // Dashboard report data does not change second-by-second; keep fresh for 60s
    staleTime: 60_000,
  });
}
