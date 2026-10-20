/**
 * Malaysia time (Asia/Kuala_Lumpur) helpers. UTC+8, no daylight saving, ever,
 * so a fixed offset is exact. Built on getTime() and toISOString() only (both
 * UTC): no local-time Date methods, so the result is the same under any TZ.
 */
const MALAYSIA_OFFSET_MS = 8 * 3_600_000;

/** Today's calendar date in Malaysia as YYYY-MM-DD, from an injected clock. */
export function todayInMalaysia(now: Date): string {
  return new Date(now.getTime() + MALAYSIA_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

/** An instant as ISO 8601 in Malaysia time WITH offset: 2026-03-01T00:30:00.000+08:00. */
export function toMalaysiaIso(instant: Date): string {
  return new Date(instant.getTime() + MALAYSIA_OFFSET_MS)
    .toISOString()
    .replace("Z", "+08:00");
}
