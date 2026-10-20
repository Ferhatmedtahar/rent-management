import { authenticate } from "@/modules/auth/api/guards";
import { json, withErrorHandling } from "@/shared/lib/api-response";
import { billReader } from "../repositories/gateway.repository";
import { getBill } from "../services/bill-read.service";

type Context = { params: Promise<{ billId: string }> };

/** GET /api/gateway-bills/:billId -> { billId, amountSen, status }. Read only. */
export const GET = withErrorHandling(
  async (request: Request, context: Context) => {
    const actor = await authenticate(request);
    const { billId } = await context.params;
    return json(await getBill(billReader, actor, billId));
  },
);
