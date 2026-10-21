import { authenticate, requireRole } from "@/modules/auth/api/guards";
import { HttpError } from "@/shared/lib/http-error";
import { json, withErrorHandling } from "@/shared/lib/api-response";
import { leaseStore } from "../repositories/lease.repository";
import { createLease } from "../services/lease.service";

/** POST /api/leases. Manager only. app/api/leases/route.ts re-exports it. */
export const POST = withErrorHandling(async (request: Request) => {
  const actor = await authenticate(request);
  requireRole(actor, ["manager"]);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
  return json(await createLease(leaseStore, actor, body), 201);
});
