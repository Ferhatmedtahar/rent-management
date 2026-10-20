import { authenticate } from "@/modules/auth/api/guards";
import { json, withErrorHandling } from "@/shared/lib/api-response";
import { slipStorage } from "../adapters/slip-storage.adapter";
import { paymentStore } from "../repositories/payment.repository";
import { recordPayment } from "../services/payment.service";

type Context = { params: Promise<{ leaseId: string }> };

/**
 * POST /api/leases/:leaseId/payments. Staff and managers.
 * The role check lives in the service, after the lease lookup, so a caller who
 * cannot see the lease gets 404 and only one who can see it gets 403.
 */
export const POST = withErrorHandling(
  async (request: Request, context: Context) => {
    const actor = await authenticate(request);
    const { leaseId } = await context.params;

    // Unparseable JSON becomes `undefined`, which fails validation (400) AFTER the
    // lease lookup, so a caller who cannot see the lease still gets 404.
    const body: unknown = await request.json().catch(() => undefined);
    const result = await recordPayment(
      { store: paymentStore, slips: slipStorage },
      actor,
      leaseId,
      body,
    );
    return json(result, 201);
  },
);
