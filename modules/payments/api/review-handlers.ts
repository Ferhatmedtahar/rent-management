import { authenticate } from "@/modules/auth/api/guards";
import { json, withErrorHandling } from "@/shared/lib/api-response";
import { paymentStore } from "../repositories/payment.repository";
import {
  approvePayment,
  rejectPayment,
  voidPayment,
} from "../services/review.service";

type Context = { params: Promise<{ paymentId: string }> };

/**
 * POST /api/payments/:paymentId/approve | reject | void. Manager only; the
 * 404-before-403 ordering lives in the service (it needs the payment lookup).
 * Unparseable JSON becomes `undefined`, which fails validation (400) only
 * AFTER the lookup and the role check.
 */
export const APPROVE = withErrorHandling(
  async (request: Request, context: Context) => {
    const actor = await authenticate(request);
    const { paymentId } = await context.params;
    return json(
      await approvePayment({ store: paymentStore }, actor, paymentId),
    );
  },
);

export const REJECT = withErrorHandling(
  async (request: Request, context: Context) => {
    const actor = await authenticate(request);
    const { paymentId } = await context.params;
    const body: unknown = await request.json().catch(() => undefined);
    return json(
      await rejectPayment({ store: paymentStore }, actor, paymentId, body),
    );
  },
);

export const VOID = withErrorHandling(
  async (request: Request, context: Context) => {
    const actor = await authenticate(request);
    const { paymentId } = await context.params;
    const body: unknown = await request.json().catch(() => undefined);
    return json(
      await voidPayment({ store: paymentStore }, actor, paymentId, body),
    );
  },
);
