import { authenticate } from "@/modules/auth/api/guards";
import { json, withErrorHandling } from "@/shared/lib/api-response";
import { leaseReader } from "../repositories/lease.repository";
import { getLease } from "../services/lease-read.service";

type Context = { params: Promise<{ leaseId: string }> };

/** GET /api/leases/:leaseId. app/api/leases/[leaseId]/route.ts re-exports it. */
export const GET = withErrorHandling(
  async (request: Request, context: Context) => {
    const actor = await authenticate(request);
    const { leaseId } = await context.params;
    return json(await getLease(leaseReader, actor, leaseId, new Date()));
  },
);
