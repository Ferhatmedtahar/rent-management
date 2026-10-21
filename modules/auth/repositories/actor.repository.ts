import "server-only";

import { prisma } from "@/shared/db/prisma";
import type { ActorLookup } from "../types/actor.types";

/**
 * Role sources of truth: `memberships` (manager | staff) and `tenants.user_id`
 * (tenant). Selects org-scoped fields only. Prisma bypasses RLS, so this is
 * only ever called with a user id that Supabase Auth already verified.
 */
export const actorRepository: ActorLookup = {
  findMembershipByUserId(userId) {
    return prisma.membership.findUnique({
      where: { userId },
      select: { orgId: true, role: true },
    });
  },

  findTenantByUserId(userId) {
    return prisma.tenant.findUnique({
      where: { userId },
      select: { id: true, orgId: true },
    });
  },
};
