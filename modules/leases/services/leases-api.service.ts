import { api } from "@/shared/lib/api-client";
import type { LeaseDetailResponse, LeaseSummary } from "../types/lease.types";

export function fetchLease(
  leaseId: string,
  signal?: AbortSignal,
): Promise<LeaseDetailResponse> {
  return api.get<LeaseDetailResponse>(`/leases/${leaseId}`, { signal });
}

export function fetchLeases(signal?: AbortSignal): Promise<LeaseSummary[]> {
  return api.get<LeaseSummary[]>("/leases", { signal });
}
