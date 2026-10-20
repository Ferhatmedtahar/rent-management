/**
 * Display formatter for integer sen: 150050 -> "RM 1,500.50". String and
 * integer work only (no float, no rounding), so it cannot introduce an error.
 * Display ONLY: parsing user input is parseRinggitToSen in lib/billing.ts.
 */
export function formatSen(sen: number): string {
  if (!Number.isSafeInteger(sen))
    throw new Error("formatSen needs an integer number of sen");
  const negative = sen < 0;
  const digits = String(negative ? -sen : sen).padStart(3, "0");
  const ringgit = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}RM ${ringgit}.${digits.slice(-2)}`;
}
