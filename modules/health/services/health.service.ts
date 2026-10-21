import "server-only";

import type { HealthStatus } from "../types/health.types";

/** Server domain service. Business logic lives here, never in route handlers. */
export function getHealthStatus(): HealthStatus {
  return { status: "ok", time: new Date().toISOString() };
}
