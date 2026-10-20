import { receivedAtSchema } from "@/modules/payments/schemas/payment.schemas";

const GATEWAY_FORMAT =
  /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-])(\d{2})(\d{2})$/;

/**
 * Parses the webhook's `paid_at`: the brief's "2026-04-01 00:30:12 +0800" or
 * ISO 8601 with an explicit offset. Real calendar dates only. Anything else is
 * null (the caller answers 422); there is NEVER a fallback to the current time.
 */
export function parsePaidAt(value: string | undefined): Date | null {
  if (!value) return null;
  const match = GATEWAY_FORMAT.exec(value);
  const iso = match
    ? `${match[1]}T${match[2]}${match[3]}${match[4]}:${match[5]}`
    : value;
  const parsed = receivedAtSchema.safeParse(iso);
  return parsed.success ? new Date(parsed.data) : null;
}
