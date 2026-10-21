/**
 * Calendar months in Malaysia time (UTC+8, no daylight saving). Pure: UTC
 * arithmetic with a fixed 8-hour shift, no local-time Date methods, so results
 * are identical under any TZ. The database never casts timezones; months are
 * bounded here as instants.
 */
const MALAYSIA_OFFSET_MS = 8 * 3_600_000;
const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const MIN_YEAR = 1000; // Date.UTC maps years 0-99 to 1900-1999, so stay clear of them
export const MAX_RANGE_MONTHS = 60;

export type YearMonth = { year: number; month: number }; // month 1..12

/** "2026-03" -> { year: 2026, month: 3 }, or null when it is not a YYYY-MM month. */
export function parseMonth(value: string): YearMonth | null {
  const match = MONTH_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  if (year < MIN_YEAR) return null;
  return { year, month: Number(match[2]) };
}

export const formatMonth = ({ year, month }: YearMonth): string =>
  `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;

/** Months since year 0, for counting and stepping. */
const toIndex = ({ year, month }: YearMonth): number => year * 12 + (month - 1);
const fromIndex = (index: number): YearMonth => {
  const monthIndex = index % 12; // indexes are positive, so no negative remainder
  return { year: (index - monthIndex) / 12, month: monthIndex + 1 };
};

/** Inclusive list of months from..to, in order. */
export function listMonths(from: YearMonth, to: YearMonth): string[] {
  const months: string[] = [];
  for (let i = toIndex(from); i <= toIndex(to); i += 1)
    months.push(formatMonth(fromIndex(i)));
  return months;
}

export const monthCount = (from: YearMonth, to: YearMonth): number =>
  toIndex(to) - toIndex(from) + 1;

/** The instant a month starts in Malaysia: YYYY-MM-01T00:00:00+08:00. */
export function monthStartInstant({ year, month }: YearMonth): Date {
  return new Date(Date.UTC(year, month - 1, 1) - MALAYSIA_OFFSET_MS);
}

/** The Malaysia month an instant falls in, as YYYY-MM. */
export function malaysiaMonthOf(instant: Date): string {
  return new Date(instant.getTime() + MALAYSIA_OFFSET_MS)
    .toISOString()
    .slice(0, 7);
}

/** The first instant AFTER the month: the start of the next month in Malaysia. */
export function monthEndExclusive(ym: YearMonth): Date {
  return monthStartInstant(fromIndex(toIndex(ym) + 1));
}
