# 0016. Authentication and authorization helpers

- Status: Accepted
- Date: 2026-10-20

## Context

`ASSESSMENT.md` section 6 requires every endpoint to authenticate the caller and
check their organization and role itself, accepting both a Supabase session
cookie and `Authorization: Bearer <access token>`. Roles must come from
`memberships` and `tenants.user_id`, never from user-editable data. The status
codes are fixed: 401 without a valid login, 404 for another organization's or
another tenant's record, 403 for a visible record when the role may not do the
action. Prisma bypasses RLS (ADR 0010), so this logic is the real access
control for every `/api` route; it must exist once and be hard to misuse.

## Decision

A small `modules/auth` module, laid out like the reference module:

- `types/actor.types.ts`: `Actor { userId, orgId, role, tenantId? }`, and the
  `ActorLookup` interface the service needs from storage.
- `repositories/actor.repository.ts`: the only Prisma access: membership by
  user id, tenant by user id, org-scoped fields only.
- `services/auth.service.ts`: pure logic with injected dependencies, so it is
  unit-tested without a server or database:
  `resolveActor` (membership first, then tenant, else null),
  `authenticateRequest`, `requireRole`, `notFound`. The three statuses are
  decided in this file only.
- `adapters/supabase-identity.adapter.ts`: verifies identity with
  `auth.getUser(token)` (publishable-key client) for Bearer and `auth.getUser()`
  on the cookie client for sessions. **Never `getSession()`.** Only the user id
  leaves the adapter: metadata and claims are not passed on.
- `api/guards.ts`: the deep-importable surface for other modules:
  `authenticate(request)`, `requireRole(actor, allowed)`, `notFound()`.
  `GET /api/me` (an extra endpoint) returns `{ userId, role, orgId }`.

Rules fixed by this decision:

1. `Authorization` present means it must be a well-formed Bearer token that the
   Auth server accepts; there is no fallback to the cookie, so a bad token never
   silently authenticates as someone else. Absent means the cookie session.
2. Role and organization are read from the database on every request. Nothing
   from `user_metadata`, `app_metadata`, JWT claims, headers or the body.
3. A user in both `memberships` and `tenants` resolves as staff/manager
   (membership first). The seed never creates that; no trigger forbids it.
4. A valid login that has neither a membership nor a tenant row is **403**: we
   know who they are, but they belong to no organization.
5. An Auth server outage (network error or 5xx) is **not** a 401: it surfaces as
   an unexpected error and `withErrorHandling` answers a generic 500.
6. A record in another organization or another tenant's is `notFound()`, with
   the same message as a missing record. Handlers resolve every referenced id
   inside the actor's organization (a tenant: their own records) and call
   `notFound()` otherwise.
7. Handler order: `authenticate` -> validate input -> `requireRole` -> load the
   record scoped by `actor.orgId` -> act.

## Alternatives considered

- **`proxy.ts` (middleware) as the gate:** it only redirects (UX); the brief says
  a protected page or hidden button is not a check, and tests call the API
  directly with Bearer tokens.
- **Roles from the JWT or `app_metadata`:** fast and stateless, but stale until
  the token expires and forbidden by the brief. One indexed lookup per request
  is cheap at this scale.
- **RLS as the only gate (call Supabase from handlers with the user's token):**
  would satisfy 404 for free, but cannot express 403 vs 404, and money
  transactions need the owner connection (row locks, constraints).
- **A decorator or wrapper that authenticates implicitly:** hides the check. The
  explicit `authenticate(request)` call at the top of every handler is easy to
  grep and to review.

## Consequences

- One lookup (two at most) per request. Acceptable; revisit with caching only if
  measured.
- Every new handler must call `authenticate` and scope by `actor.orgId`;
  forgetting is a security bug, so authorization tests per endpoint and role
  are mandatory (AGENTS.md section 13).
- `scripts/auth-check.ts` (`pnpm auth:check`) verifies the whole path against a
  running app: 7 seeded users, no token, garbage token.
- Tests alias `server-only` to an empty module (`vitest.server-only.ts`) so
  server services can be unit-tested.
