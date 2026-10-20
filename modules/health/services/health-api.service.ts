import { api } from "@/shared/lib/api-client";
import type { HealthStatus } from "../types/health.types";

/** Client service. The only layer hooks call; it talks to /api/v1 and nothing else. */
export async function fetchHealthStatus(signal?: AbortSignal) {
  const response = await api.get<HealthStatus>("/health", { signal });
  return response.data;
}
