import { authenticate } from "@/modules/auth/api/guards";
import { requireRole } from "@/modules/auth/api/policy";
import { json, withErrorHandling } from "@/shared/lib/api-response";
import { leaseReader } from "../repositories/lease.repository";
import { listLeases } from "../services/lease-read.service";

/** GET /api/leases. app/api/leases/route.ts re-exports it. */
export const GET = withErrorHandling(async (request: Request) => {
  const actor = await authenticate(request);
  requireRole(actor, ["manager", "staff"]);
  return json(await listLeases(leaseReader, actor));
});
