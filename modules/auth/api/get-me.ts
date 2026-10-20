import { json, withErrorHandling } from "@/shared/lib/api-response";
import { authenticate } from "./guards";

/** GET /api/me. Who the database says the caller is. app/api/me/route.ts re-exports it. */
export const GET = withErrorHandling(async (request: Request) => {
  const actor = await authenticate(request);
  return json({ userId: actor.userId, role: actor.role, orgId: actor.orgId });
});
