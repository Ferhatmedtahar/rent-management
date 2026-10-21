import { env } from "@/env";
import { json, withErrorHandling } from "@/shared/lib/api-response";
import { gatewayWebhookStore } from "../repositories/webhook.repository";
import { handleGatewayCallback } from "../services/webhook.service";

/**
 * POST /api/webhooks/gateway (application/x-www-form-urlencoded).
 * NOT behind authenticate(): the gateway has no user, the signature is the auth.
 * The RAW body is read as text and verified before anything is parsed further.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const raw = await request.text();
  const result = await handleGatewayCallback(
    {
      store: gatewayWebhookStore,
      signatureKey: env.GATEWAY_X_SIGNATURE_KEY,
      now: () => new Date(),
    },
    raw,
  );
  return json(result);
});
