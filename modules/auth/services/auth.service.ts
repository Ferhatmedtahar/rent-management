import "server-only";

import { HttpError } from "@/shared/lib/http-error";
import type { Actor, ActorLookup, Role } from "../types/actor.types";

/**
 * Pure authentication and authorization logic. No Next.js, Supabase or Prisma
 * here: the verified identity and the database lookups are injected, so every
 * rule below is unit-tested without a server or a database.
 *
 * The three statuses of ASSESSMENT.md section 6 are decided in this file only:
 *   401  no valid login            (authenticateRequest)
 *   403  visible record, role not allowed for the action   (requireRole)
 *   404  other organization's / other tenant's record      (notFound)
 */

/** A login the Auth server has verified. Only `id` is ever read. */
export type VerifiedIdentity = { id: string };

export interface AuthenticateDeps {
  /** Verify an access token with the Auth server (auth.getUser(token)). */
  verifyBearer(token: string): Promise<VerifiedIdentity | null>;
  /** Verify the session cookie with the Auth server (auth.getUser()). */
  verifyCookieSession(): Promise<VerifiedIdentity | null>;
  lookup: ActorLookup;
}

const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

/** Role and organization come from the database, membership first, then tenant. */
export async function resolveActor(
  lookup: ActorLookup,
  userId: string,
): Promise<Actor | null> {
  const membership = await lookup.findMembershipByUserId(userId);
  if (membership) {
    return { userId, orgId: membership.orgId, role: membership.role };
  }
  const tenant = await lookup.findTenantByUserId(userId);
  if (tenant) {
    return { userId, orgId: tenant.orgId, role: "tenant", tenantId: tenant.id };
  }
  return null;
}

/**
 * Accepts `Authorization: Bearer <access token>` or the session cookie.
 * - Header absent: the cookie session is used.
 * - Header present: it must be a well-formed Bearer token. No fallback to the
 *   cookie, so a bad token never silently authenticates as someone else.
 * - A valid login with no membership and no tenant row is 403: we know who they
 *   are, but they belong to no organization.
 */
export async function authenticateRequest(
  headers: Pick<Headers, "get">,
  deps: AuthenticateDeps,
): Promise<Actor> {
  const authorization = headers.get("authorization");

  let identity: VerifiedIdentity | null;
  if (authorization === null) {
    identity = await deps.verifyCookieSession();
  } else {
    const token = BEARER_PATTERN.exec(authorization.trim())?.[1];
    identity = token ? await deps.verifyBearer(token) : null;
  }
  if (!identity) throw new HttpError(401, "Sign in to continue.");

  const actor = await resolveActor(deps.lookup, identity.id);
  if (!actor) {
    throw new HttpError(403, "Your account is not part of an organization.");
  }
  return actor;
}

/** 403: the caller can see the record, but their role may not do this. */
export function requireRole(actor: Actor, allowed: readonly Role[]): void {
  if (!allowed.includes(actor.role)) {
    throw new HttpError(403, "You do not have permission to do this.");
  }
}

/**
 * 404: the record is in another organization, or is another tenant's. Same
 * message as a record that does not exist, so its existence is never revealed.
 */
export function notFound(): never {
  throw new HttpError(404, "Not found.");
}
