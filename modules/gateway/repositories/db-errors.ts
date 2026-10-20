/**
 * Recognising a unique-constraint violation from Prisma 7 + the pg adapter:
 * PrismaClientKnownRequestError code "P2002", or the raw SQLSTATE "23505" at
 * the top level, under meta.driverAdapterError.cause, or in a nested cause.
 */
const PRISMA_UNIQUE = "P2002";
const PG_UNIQUE = "23505";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

export function isUniqueViolation(error: unknown, depth = 0): boolean {
  const e = asRecord(error);
  if (!e || depth > 4) return false;
  if (e.code === PRISMA_UNIQUE || e.code === PG_UNIQUE) return true;
  const cause = asRecord(asRecord(asRecord(e.meta)?.driverAdapterError)?.cause);
  if (cause?.code === PG_UNIQUE || cause?.originalCode === PG_UNIQUE)
    return true;
  if (cause?.kind === "UniqueConstraintViolation") return true;
  return isUniqueViolation(e.cause, depth + 1);
}
