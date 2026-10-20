import { connection } from "next/server";
import { json, withErrorHandling } from "@/shared/lib/api-response";
import { getHealthStatus } from "../services/health.service";

/** GET /api/health. Route handler logic; app/api/health/route.ts re-exports it. */
export const GET = withErrorHandling(async () => {
  // Opt out of build-time prerendering: the response depends on the request-time clock.
  await connection();
  return json(getHealthStatus());
});
