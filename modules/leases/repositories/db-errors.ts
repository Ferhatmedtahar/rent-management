/**
 * Recognising Postgres exclusion violations (SQLSTATE 23P01) from Prisma 7 with
 * the pg driver adapter. Prisma has no dedicated kind for 23P01, so the adapter
 * reports `{ kind: "postgres", code: "23P01", ... }` and the client wraps it in
 * a PrismaClientKnownRequestError (code "P2039", or "P2010" for raw queries)
 * with `meta.driverAdapterError.cause` holding that object. The message also
 * contains "Code: `23P01`". We accept any of these shapes, and a raw pg error.
 */
export const EXCLUSION_VIOLATION = "23P01";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

export function isExclusionViolation(error: unknown, depth = 0): boolean {
  const e = asRecord(error);
  if (!e || depth > 4) return false;

  if (e.code === EXCLUSION_VIOLATION) return true;

  const cause = asRecord(asRecord(asRecord(e.meta)?.driverAdapterError)?.cause);
  if (cause?.code === EXCLUSION_VIOLATION) return true;
  if (cause?.originalCode === EXCLUSION_VIOLATION) return true;

  if (
    typeof e.message === "string" &&
    e.message.includes(`Code: \`${EXCLUSION_VIOLATION}\``)
  ) {
    return true;
  }
  return isExclusionViolation(e.cause, depth + 1);
}
