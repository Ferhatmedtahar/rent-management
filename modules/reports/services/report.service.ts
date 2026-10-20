import "server-only";

import type { Actor } from "@/modules/auth";
import { requireRole } from "@/modules/auth/api/policy";
import { HttpError } from "@/shared/lib/http-error";
import type { CollectionsRow, ReportStore } from "../types/report.types";
import {
  MAX_RANGE_MONTHS,
  listMonths,
  malaysiaMonthOf,
  monthCount,
  monthEndExclusive,
  monthStartInstant,
  parseMonth,
} from "./months";

/** Raw query values: every occurrence of the parameter (none, one, or repeated). */
export type CollectionsQuery = { from: string[]; to: string[] };

const BAD_RANGE =
  "from and to must be months written as YYYY-MM, from not after to.";

/**
 * GET /api/reports/collections. Staff and managers only (tenant 403), always
 * scoped to the caller's organization. Order: role -> validate -> query.
 *
 * One entry per month from..to inclusive, in order, empty months as 0. A month
 * is a Malaysia calendar month: [YYYY-MM-01T00:00+08:00, next month's start).
 * Only APPROVED payments count (pending, rejected and voided are excluded;
 * online approved ones count). Sums are bigint, converted to number at the end.
 */
export async function getCollections(
  store: ReportStore,
  actor: Actor,
  query: CollectionsQuery,
): Promise<CollectionsRow[]> {
  requireRole(actor, ["manager", "staff"]);

  if (query.from.length !== 1 || query.to.length !== 1)
    throw new HttpError(400, BAD_RANGE);
  const from = parseMonth(query.from[0] ?? "");
  const to = parseMonth(query.to[0] ?? "");
  if (!from || !to) throw new HttpError(400, BAD_RANGE);
  const months = monthCount(from, to);
  if (months < 1) throw new HttpError(400, BAD_RANGE);
  if (months > MAX_RANGE_MONTHS) {
    throw new HttpError(
      400,
      `The range can cover at most ${MAX_RANGE_MONTHS} months.`,
    );
  }

  const payments = await store.listPaymentsReceivedBetween(
    actor.orgId,
    monthStartInstant(from),
    monthEndExclusive(to),
  );

  // Month list is generated in code so months with nothing collected appear as 0.
  const totals = new Map<string, bigint>(
    listMonths(from, to).map((month) => [month, BigInt(0)]),
  );
  for (const payment of payments) {
    if (payment.status !== "approved") continue;
    const month = malaysiaMonthOf(payment.receivedAt);
    const total = totals.get(month);
    if (total !== undefined) totals.set(month, total + payment.amountSen);
  }
  return [...totals].map(([month, total]) => ({
    month,
    collectedSen: Number(total),
  }));
}
