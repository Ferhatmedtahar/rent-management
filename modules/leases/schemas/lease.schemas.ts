import { z } from "zod";

export const MAX_SEN = 1_000_000_000_000; // 1e12, matches the DB range CHECKs
export const MAX_LEASE_MONTHS = 120;

const DATE_SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * True when endDate is at most MAX_LEASE_MONTHS after startDate. Only compares
 * year/month/day numbers; real-calendar validity is generateSchedule's job.
 * Strings that do not match the shape pass here and fail there.
 */
export function leaseLengthWithinCap(start: string, end: string): boolean {
  const s = DATE_SHAPE.exec(start);
  const e = DATE_SHAPE.exec(end);
  if (!s || !e) return true;
  const months =
    (Number(e[1]) - Number(s[1])) * 12 + (Number(e[2]) - Number(s[2]));
  return (
    months < MAX_LEASE_MONTHS ||
    (months === MAX_LEASE_MONTHS && Number(e[3]) <= Number(s[3]))
  );
}

/** zod strips unknown keys by default (they are ignored, not rejected). */
export const createLeaseSchema = z
  .object({
    unitId: z.uuid(),
    tenantId: z.uuid(),
    startDate: z.string(),
    endDate: z.string(),
    monthlyRentSen: z.number().int().positive().max(MAX_SEN),
    depositSen: z.number().int().min(0).max(MAX_SEN),
  })
  .refine((lease) => leaseLengthWithinCap(lease.startDate, lease.endDate), {
    message: `Lease length must be at most ${MAX_LEASE_MONTHS} months.`,
    path: ["endDate"],
  });

export type CreateLeaseBody = z.infer<typeof createLeaseSchema>;
