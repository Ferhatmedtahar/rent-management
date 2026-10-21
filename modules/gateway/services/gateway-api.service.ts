import { api } from "@/shared/lib/api-client";
import type { BillView } from "../types/gateway.types";

/** Client service: the real bill status, read from the database through /api. */
export function fetchBill(billId: string, signal?: AbortSignal) {
  return api.get<BillView>(`/gateway-bills/${encodeURIComponent(billId)}`, {
    signal,
  });
}

export function createGatewayBill(leaseId: string, signal?: AbortSignal) {
  return api.post<{ billId: string; amountSen: number }>(
    `/leases/${leaseId}/gateway-bills`,
    { signal },
  );
}
