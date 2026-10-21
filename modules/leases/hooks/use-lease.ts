import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { fetchLease } from "../services/leases-api.service";

export function useLease(leaseId: string) {
  return useQuery({
    queryKey: queryKeys.lease(leaseId),
    queryFn: ({ signal }) => fetchLease(leaseId, signal),
    enabled: Boolean(leaseId),
  });
}
