import "server-only";

import { actorRepository } from "../repositories/actor.repository";
import {
  verifyBearer,
  verifyCookieSession,
} from "../adapters/supabase-identity.adapter";
import { authenticateRequest } from "../services/auth.service";
import type { Actor } from "../types/actor.types";

/**
 * The guards every route handler uses. Deep-importable by other modules
 * (`@/modules/auth/api/guards`). Call `authenticate` first in every handler,
 * then `requireRole` for the action, then scope every query by `actor.orgId`
 * (and `actor.tenantId` for tenants), answering `notFound()` for anything else.
 *
 *   401  authenticate()   no valid login
 *   403  requireRole()    visible record, action not allowed for the role
 *   404  notFound()       other organization's or other tenant's record
 */
export { notFound, requireRole } from "./policy";

export function authenticate(request: Request): Promise<Actor> {
  return authenticateRequest(request.headers, {
    verifyBearer,
    verifyCookieSession,
    lookup: actorRepository,
  });
}
