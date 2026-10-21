/**
 * Billing rules: lease invoice schedule, invoice status, ringgit parsing.
 *
 * Pure on purpose: no imports, no I/O, no local-time Date methods, no Intl.
 * Calendar dates are 'YYYY-MM-DD' strings handled as integer day numbers
 * (proleptic Gregorian, UTC), so results are identical under any TZ.
 * Money is integer sen (1 ringgit = 100 sen).
 */

export type InvoiceKind = "deposit" | "rent";

export interface ScheduledInvoice {
  kind: InvoiceKind;
  periodIndex: number | null; // 0, 1, 2... for rent; null for the deposit
  periodStart: string | null; // 'YYYY-MM-DD'; null for the deposit
  periodEnd: string | null; // 'YYYY-MM-DD', inclusive; null for the deposit
  dueDate: string; // 'YYYY-MM-DD'
  amountSen: number; // integer
}

export type InvoiceStatus = "paid" | "partially_paid" | "unpaid" | "overdue";

// ---------------------------------------------------------------------------
// Calendar helpers (integer arithmetic only)
// ---------------------------------------------------------------------------

interface CalendarDate {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
}

const MS_PER_DAY = 86_400_000;
// Business timezone is Asia/Kuala_Lumpur: UTC+8, no daylight saving, ever.
const MALAYSIA_OFFSET_MS = 8 * 3_600_000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

const daysInMonth = (year: number, month: number): number => {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
};

/** Days since 1970-01-01 for a valid civil date (Howard Hinnant's algorithm). */
const daysFromCivil = (year: number, month: number, day: number): number => {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const monthIndex = (month + 9) % 12; // March = 0
  const dayOfYear = Math.floor((153 * monthIndex + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 +
    Math.floor(yearOfEra / 4) -
    Math.floor(yearOfEra / 100) +
    dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
};

/** Inverse of daysFromCivil. */
const civilFromDays = (days: number): CalendarDate => {
  const z = days + 719_468;
  const era = Math.floor(z / 146_097);
  const dayOfEra = z - era * 146_097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36_524) -
      Math.floor(dayOfEra / 146_096)) /
      365,
  );
  const dayOfYear =
    dayOfEra -
    (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthIndex = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthIndex + 2) / 5) + 1;
  const month = monthIndex < 10 ? monthIndex + 3 : monthIndex - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return { year, month, day };
};

const pad = (value: number, width: number): string =>
  String(value).padStart(width, "0");

const formatDay = (days: number): string => {
  const { year, month, day } = civilFromDays(days);
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
};

/** Parses a real calendar date written exactly as YYYY-MM-DD, or throws. */
const parseDate = (value: unknown, label: string): CalendarDate => {
  const match = typeof value === "string" ? DATE_PATTERN.exec(value) : null;
  if (!match) throw new Error(`${label} must be a date written as YYYY-MM-DD`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`${label} is not a real calendar date`);
  }
  return { year, month, day };
};

// ---------------------------------------------------------------------------
// generateSchedule
// ---------------------------------------------------------------------------

/**
 * Prorated rent for a cut-short last period, in whole sen.
 *
 * ROUNDING RULE (the only one in this file): half up to the nearest sen,
 * computed with exact integer math, never with floats:
 *   amount = floor((2 * rent * daysUsed + daysInPeriod) / (2 * daysInPeriod))
 * BigInt keeps rent * daysUsed exact even for amounts near 2^53.
 */
const prorate = (
  monthlyRentSen: number,
  daysUsed: number,
  daysInPeriod: number,
): number => {
  const two = BigInt(2);
  const numerator =
    two * BigInt(monthlyRentSen) * BigInt(daysUsed) + BigInt(daysInPeriod);
  return Number(numerator / (two * BigInt(daysInPeriod)));
};

export function generateSchedule(lease: {
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD', inclusive (the tenant's last day)
  monthlyRentSen: number;
  depositSen: number;
}): ScheduledInvoice[] {
  if (typeof lease !== "object" || lease === null) {
    throw new Error("lease must be an object");
  }
  const start = parseDate(lease.startDate, "startDate");
  const end = parseDate(lease.endDate, "endDate");
  const startDay = daysFromCivil(start.year, start.month, start.day);
  const endDay = daysFromCivil(end.year, end.month, end.day);
  if (endDay < startDay)
    throw new Error("endDate must not be before startDate");

  const { monthlyRentSen, depositSen } = lease;
  if (!Number.isSafeInteger(monthlyRentSen) || monthlyRentSen <= 0) {
    throw new Error("monthlyRentSen must be a positive integer");
  }
  if (!Number.isSafeInteger(depositSen) || depositSen < 0) {
    throw new Error("depositSen must be a non-negative integer");
  }

  const schedule: ScheduledInvoice[] = [];
  if (depositSen > 0) {
    schedule.push({
      kind: "deposit",
      periodIndex: null,
      periodStart: null,
      periodEnd: null,
      dueDate: formatDay(startDay),
      amountSen: depositSen,
    });
  }

  // Anchor k = start + k calendar months, always counted from the START date
  // (never from the previous anchor), clamped to the month's last day.
  const startMonths = start.year * 12 + (start.month - 1);
  const anchorDay = (k: number): number => {
    const months = startMonths + k;
    const year = Math.floor(months / 12);
    const month = (months % 12) + 1;
    return daysFromCivil(
      year,
      month,
      Math.min(start.day, daysInMonth(year, month)),
    );
  };

  for (let k = 0; ; k += 1) {
    const periodStartDay = anchorDay(k);
    if (periodStartDay > endDay) break;
    const nextAnchorDay = anchorDay(k + 1);
    const fullPeriodDays = nextAnchorDay - periodStartDay;
    const periodEndDay = Math.min(nextAnchorDay - 1, endDay);
    const daysUsed = periodEndDay - periodStartDay + 1;
    schedule.push({
      kind: "rent",
      periodIndex: k,
      periodStart: formatDay(periodStartDay),
      periodEnd: formatDay(periodEndDay),
      dueDate: formatDay(periodStartDay),
      amountSen:
        daysUsed < fullPeriodDays
          ? prorate(monthlyRentSen, daysUsed, fullPeriodDays)
          : monthlyRentSen,
    });
  }
  return schedule;
}

// ---------------------------------------------------------------------------
// invoiceStatus
// ---------------------------------------------------------------------------

export function invoiceStatus(
  invoice: { dueDate: string; amountSen: number; paidSen: number },
  now: Date,
): InvoiceStatus {
  const due = parseDate(invoice.dueDate, "dueDate");
  if (!Number.isSafeInteger(invoice.amountSen) || invoice.amountSen < 0) {
    throw new Error("amountSen must be a non-negative integer");
  }
  if (!Number.isSafeInteger(invoice.paidSen) || invoice.paidSen < 0) {
    throw new Error("paidSen must be a non-negative integer");
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("now must be a valid Date");
  }

  if (invoice.paidSen >= invoice.amountSen) return "paid";

  // Today's date in Malaysia: shift the instant by +8h, then take the UTC day.
  const todayDay = Math.floor(
    (now.getTime() + MALAYSIA_OFFSET_MS) / MS_PER_DAY,
  );
  const dueDay = daysFromCivil(due.year, due.month, due.day);
  // Strictly after the due date: due 2026-03-01 is overdue from
  // 2026-03-01T16:00:00Z (= 2026-03-02 00:00 Malaysia).
  if (todayDay > dueDay) return "overdue";

  if (invoice.paidSen > 0) return "partially_paid";
  return "unpaid";
}

// ---------------------------------------------------------------------------
// parseRinggitToSen
// ---------------------------------------------------------------------------

// Digits with optional comma thousands groups of exactly three digits (the
// first group has 1 to 3 digits, so "01,500" is accepted like "007"), then an
// optional decimal part of one or two digits. ASCII digits only.
const RINGGIT_PATTERN = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;

export function parseRinggitToSen(input: string): number {
  if (typeof input !== "string") throw new Error("amount must be a string");
  const match = RINGGIT_PATTERN.exec(input.trim());
  if (!match) throw new Error("amount is not a valid ringgit value");

  const ringgit = BigInt((match[1] ?? "").replaceAll(",", ""));
  const sen = BigInt((match[2] ?? "").padEnd(2, "0"));
  const total = ringgit * BigInt(100) + sen;
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("amount is too large");
  }
  return Number(total);
}
