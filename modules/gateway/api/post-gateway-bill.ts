import { authenticate } from "@/modules/auth/api/guards";
import { json, withErrorHandling } from "@/shared/lib/api-response";
import { gatewayStore } from "../repositories/gateway.repository";
import { createGatewayBill } from "../services/gateway.service";
import { newBillId } from "../services/bill-id";

type Context = { params: Promise<{ leaseId: string }> };

/** POST /api/leases/:leaseId/gateway-bills. The lease's own tenant only. */
export const POST = withErrorHandling(
  async (request: Request, context: Context) => {
    const actor = await authenticate(request);
    const { leaseId } = await context.params;
    const result = await createGatewayBill(
      { store: gatewayStore, now: () => new Date(), newBillId },
      actor,
      leaseId,
    );
    return json(result, 201);
  },
);
