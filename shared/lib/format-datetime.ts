/**
 * Malaysia time (Asia/Kuala_Lumpur, UTC+8, no DST) datetime formatting helpers.
 * Pure functions: no Intl, no toLocale*, no local-time Date methods.
 * Guaranteed to produce identical output under any host timezone.
 */

const MALAYSIA_OFFSET_MS = 8 * 3_600_000;

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Format a date-only YYYY-MM-DD string to "31 Jan 2026".
 * Never uses new Date() on date-only strings to prevent UTC midnight date shift.
 */
export function formatDateMyt(yyyyMmDd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyyMmDd)) {
    throw new Error(
      `Invalid date-only format (expected YYYY-MM-DD): "${yyyyMmDd}"`,
    );
  }
  const [yearStr, monthStr, dayStr] = yyyyMmDd.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const day = Number(dayStr);

  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) {
    throw new Error(`Date out of bounds: "${yyyyMmDd}"`);
  }

  const monthName = MONTH_NAMES[monthIndex];
  return `${day} ${monthName} ${year}`;
}

/**
 * Format an ISO timestamp string with offset or Z to "1 Mar 2026, 12:30 AM".
 * Parses to UTC instant, shifts +8h, and reads UTC fields only.
 */
export function formatDateTimeMyt(isoWithOffset: string): string {
  const instant = new Date(isoWithOffset);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`Invalid ISO date string: "${isoWithOffset}"`);
  }

  const myt = new Date(instant.getTime() + MALAYSIA_OFFSET_MS);
  const year = myt.getUTCFullYear();
  const monthName = MONTH_NAMES[myt.getUTCMonth()];
  const day = myt.getUTCDate();
  const hour24 = myt.getUTCHours();
  const minute = myt.getUTCMinutes();

  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const minuteStr = String(minute).padStart(2, "0");

  return `${day} ${monthName} ${year}, ${hour12}:${minuteStr} ${period}`;
}

/**
 * Convert a datetime-local input value (e.g. "2026-03-01T00:30")
 * to "2026-03-01T00:30:00+08:00" for receivedAt.
 * Throws on malformed or out-of-range inputs.
 */
export function malaysiaInputToIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value,
  );
  if (!match) {
    throw new Error(`Invalid datetime-local value: "${value}"`);
  }

  const [, year, month, day, hour, minute, second = "00"] = match;
  const m = Number(month);
  const d = Number(day);
  const h = Number(hour);
  const min = Number(minute);
  const s = Number(second);

  if (m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || min > 59 || s > 59) {
    throw new Error(`Datetime-local values out of range: "${value}"`);
  }

  return `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`;
}

/**
 * Current Malaysia time as a datetime-local value ("YYYY-MM-DDTHH:mm").
 * Must be called inside useEffect or a post-mount factory, never during SSR.
 */
export function defaultMalaysiaNowInput(now: Date): string {
  if (Number.isNaN(now.getTime())) {
    throw new Error("Invalid now Date passed to defaultMalaysiaNowInput");
  }
  const myt = new Date(now.getTime() + MALAYSIA_OFFSET_MS);
  return myt.toISOString().slice(0, 16);
}

/**
 * Format a month "YYYY-MM" string to "Jan 2026".
 */
export function formatMonthMyt(yyyyMm: string): string {
  if (!/^\d{4}-\d{2}$/.test(yyyyMm)) {
    throw new Error(`Invalid month format (expected YYYY-MM): "${yyyyMm}"`);
  }
  const [yearStr, monthStr] = yyyyMm.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (monthIndex < 0 || monthIndex > 11) {
    throw new Error(`Month out of bounds: "${yyyyMm}"`);
  }
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

/**
 * Return the last N months in Malaysia time up to and including the current Malaysia month.
 * Pure calculation based on given `now` instant.
 */
export function getLastNMonthsMyt(
  now: Date,
  count = 6,
): {
  from: string;
  to: string;
  months: string[];
} {
  const myt = new Date(now.getTime() + MALAYSIA_OFFSET_MS);
  const currentYear = myt.getUTCFullYear();
  const currentMonth = myt.getUTCMonth() + 1; // 1..12

  let startYear = currentYear;
  let startMonth = currentMonth - (count - 1);
  while (startMonth <= 0) {
    startMonth += 12;
    startYear -= 1;
  }

  const months: string[] = [];
  let y = startYear;
  let m = startMonth;
  for (let step = 0; step < count; step += 1) {
    months.push(`${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  return {
    from: months[0]!,
    to: months[months.length - 1]!,
    months,
  };
}
