import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { fetchLeases } from "../services/leases-api.service";

export function useLeases() {
  return useQuery({
    queryKey: queryKeys.leases.list(),
    queryFn: ({ signal }) => fetchLeases(signal),
  });
}
