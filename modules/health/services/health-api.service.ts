import { api } from "@/shared/lib/api-client";
import type { HealthStatus } from "../types/health.types";

/** Client service. The only layer hooks call; it talks to /api and nothing else. */
export function fetchHealthStatus(signal?: AbortSignal) {
  return api.get<HealthStatus>("/health", { signal });
}
