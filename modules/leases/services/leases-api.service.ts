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

export function createLease(
  payload: {
    unitId: string;
    tenantId: string;
    startDate: string;
    endDate: string;
    monthlyRentSen: number;
    depositSen: number;
  },
  signal?: AbortSignal,
): Promise<{ id: string }> {
  return api.post<{ id: string }>("/leases", {
    body: payload,
    signal,
  });
}
