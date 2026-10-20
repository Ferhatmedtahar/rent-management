import { connection } from "next/server";
import { apiSuccess } from "@/shared/lib/api-response";
import { getHealthStatus } from "../services/health.service";

/** GET /api/v1/health. Route handler logic; app/api/v1/health/route.ts re-exports it. */
export async function GET() {
  // Opt out of build-time prerendering: the response depends on the request-time clock.
  await connection();
  return apiSuccess(getHealthStatus());
}
