import { z } from "zod";

export const MAX_SEN = 1_000_000_000_000;

// ISO 8601 date-time with an EXPLICIT offset (Z or +hh:mm). No offset = ambiguous = rejected.
const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Date.parse rolls 2026-02-30 over to March, so check the components ourselves. */
function isRealDateTime(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!m) return false;
  const [year, month, day, hour, minute, second] = m
    .slice(1)
    .map((part) => Number(part ?? 0));
  const leap = (year! % 4 === 0 && year! % 100 !== 0) || year! % 400 === 0;
  const monthDays = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month! - 1];
  return (
    month! >= 1 &&
    month! <= 12 &&
    day! >= 1 &&
    day! <= (monthDays ?? 0) &&
    hour! <= 23 &&
    minute! <= 59 &&
    second! <= 59 &&
    !Number.isNaN(Date.parse(value))
  );
}

export const receivedAtSchema = z
  .string()
  .regex(
    ISO_WITH_OFFSET,
    "receivedAt must be ISO 8601 with an explicit offset, e.g. 2026-03-01T00:30:00+08:00.",
  )
  .refine(isRealDateTime, "receivedAt is not a real date and time.");

/** Zod strips unknown keys (ignored, not rejected). */
export const recordPaymentSchema = z
  .object({
    amountSen: z.number().int().positive().max(MAX_SEN),
    method: z.enum(["cash", "bank_transfer"]),
    receivedAt: receivedAtSchema,
    slipPath: z.string().min(1).max(512).optional(),
  })
  .superRefine((payment, ctx) => {
    if (payment.method === "bank_transfer" && !payment.slipPath) {
      ctx.addIssue({
        code: "custom",
        path: ["slipPath"],
        message: "A bank transfer needs a payment slip.",
      });
    }
    if (payment.method === "cash" && payment.slipPath !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["slipPath"],
        message: "A cash payment cannot have a slip.",
      });
    }
  });

/** The slip must live in the caller's own organization folder, with no traversal. */
export function isSlipPathInOrg(slipPath: string, orgId: string): boolean {
  const prefix = `${orgId}/`;
  return (
    slipPath.startsWith(prefix) &&
    slipPath.length > prefix.length &&
    !slipPath.split("/").some((segment) => segment === ".." || segment === ".")
  );
}

/** Reject and void need a reason of at least 5 characters once trimmed. */
export const reasonSchema = z.object({
  reason: z
    .string()
    .transform((value) => value.trim())
    .refine(
      (value) => value.length >= 5,
      "A reason of at least 5 characters is required.",
    ),
});
