"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { fetchHealthStatus } from "../services/health-api.service";

/** Server state goes through React Query: caching, staleness, retry, refetch. */
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health.status(),
    queryFn: ({ signal }) => fetchHealthStatus(signal),
  });
}
