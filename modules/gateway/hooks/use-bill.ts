"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { fetchBill } from "../services/gateway-api.service";

const PENDING_POLL_MS = 3_000;

/**
 * The bill's real status. While it is still `pending` the gateway's webhook may
 * be about to settle it, so poll until it is paid or failed. Nothing is written.
 */
export function useBill(billId: string | null) {
  return useQuery({
    queryKey: queryKeys.gateway.bill(billId ?? ""),
    queryFn: ({ signal }) => fetchBill(billId ?? "", signal),
    enabled: billId !== null,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? PENDING_POLL_MS : false,
  });
}
