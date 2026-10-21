import "server-only";

import { generateSchedule } from "@/lib/billing";
import type { Actor } from "@/modules/auth";
import { notFound, requireRole } from "@/modules/auth/api/policy";
import { HttpError } from "@/shared/lib/http-error";
import { isExclusionViolation } from "../repositories/db-errors";
import { createLeaseSchema } from "../schemas/lease.schemas";
import type { LeaseStore } from "../types/lease.types";

/**
 * Create a lease and exactly the invoices generateSchedule returns, plus the
 * audit row, in ONE transaction (all or nothing).
 *
 * Authorization is re-checked here even though the handler checked it: manager
 * only (403). The unit and tenant are looked up INSIDE the actor's organization;
 * a missing id and another organization's id are indistinguishable (404).
 * Overlap on the same unit is decided by the database exclusion constraint
 * (SQLSTATE 23P01), which is race-proof, and becomes 409.
 */
export async function createLease(
  store: LeaseStore,
  actor: Actor,
  body: unknown,
): Promise<{ id: string }> {
  requireRole(actor, ["manager"]);

  const parsed = createLeaseSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid input.",
    );
  }
  const input = parsed.data;

  let schedule;
  try {
    schedule = generateSchedule(input);
  } catch (error) {
    // Pure billing validation (real dates, end >= start, amounts).
    throw new HttpError(
      400,
      error instanceof Error ? error.message : "Invalid input.",
    );
  }

  try {
    return await store.transaction(async (tx) => {
      if (!(await tx.findUnitInOrg(input.unitId, actor.orgId))) notFound();
      if (!(await tx.findTenantInOrg(input.tenantId, actor.orgId))) notFound();

      const lease = await tx.insertLease({
        ...input,
        orgId: actor.orgId,
        createdBy: actor.userId,
      });
      await tx.insertInvoices(actor.orgId, lease.id, schedule);
      await tx.insertAudit({
        orgId: actor.orgId,
        actorId: actor.userId,
        action: "lease.created",
        entityType: "lease",
        entityId: lease.id,
        details: {
          unitId: input.unitId,
          tenantId: input.tenantId,
          startDate: input.startDate,
          endDate: input.endDate,
          monthlyRentSen: input.monthlyRentSen,
          depositSen: input.depositSen,
          invoiceCount: schedule.length,
        },
      });
      return { id: lease.id };
    });
  } catch (error) {
    if (isExclusionViolation(error)) {
      throw new HttpError(
        409,
        "This unit already has a lease that overlaps these dates.",
      );
    }
    throw error;
  }
}
