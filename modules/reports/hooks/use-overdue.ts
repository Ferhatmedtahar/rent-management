import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { fetchOverdueReport } from "../services/reports-api.service";

export function useOverdue() {
  return useQuery({
    queryKey: queryKeys.overdue.count(),
    queryFn: ({ signal }) => fetchOverdueReport(signal),
  });
}
