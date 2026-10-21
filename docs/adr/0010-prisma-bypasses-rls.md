# 0010. Prisma bypasses RLS, so authorize in the service layer

- Status: Accepted
- Date: 2026-10-20

## Context

The brief requires Row Level Security and server-side authorization. Prisma
connects to Postgres with a single role (the table owner / `postgres`), which
bypasses RLS. Policies written for the Supabase `authenticated` role therefore
do **not** apply to Prisma queries. Treating RLS as the only guard would leave
every Prisma query unprotected.

## Decision

Two independent layers:

1. **Application authorization (primary for Prisma):** services resolve the
   authenticated actor (role + id) and pass an explicit scope to repositories.
   Every repository query on tenant data filters by that scope. Authorization
   logic lives in services and is unit-tested.
2. **RLS (defense-in-depth):** enabled on every table with policies per role.
   It protects the Supabase client and Storage, and any future path that is not
   Prisma. Policies live as raw SQL in migrations and are reviewed by a human.

Prisma is importable only from `repositories/` (ESLint), so a bypass-capable
client is never reachable from routes or components.

## Alternatives considered

- **Run Prisma as a restricted role with `SET LOCAL request.jwt.claims` per
  transaction** so RLS applies: possible, but fragile with pooling and harder to
  reason about under time pressure. Revisit if the spec rewards it.
- **Supabase JS client for all data access:** RLS always applies, but we lose
  Prisma typing and migrations required by the brief.

## Implementation notes (pitfalls to avoid)

- **Helper functions go in a `private` schema** (e.g. `private.current_app_role()`),
  not in Supabase's `auth` schema, which is owned by `supabase_auth_admin` and
  not writable by our migrations. Do not name a function `current_role`: it is a
  reserved SQL keyword.
- Helpers that read the profile are `SECURITY DEFINER` with
  `SET search_path = ''` and schema-qualified names, `STABLE`, and granted only
  to the roles that need them. This also avoids infinite recursion when a policy
  on `profiles` would otherwise query `profiles`.
- **Role source of truth is the `profiles` table**, not JWT claims alone and
  never `user_metadata` (user-editable). A trigger on `auth.users` creates the
  profile with role `TENANT`; elevation to `STAFF`/`MANAGER` happens only through
  a manager-authenticated endpoint using the service role.
- Prisma needs table access for its own role: policies protect `authenticated` /
  `anon`; the connection role used by Prisma is a deliberate, documented
  exception.
- Every policy is tested per role with `SET ROLE authenticated` plus
  `request.jwt.claims` in a SQL test (human-run).

## Consequences

- Authorization bugs are code bugs: they need tests per role and per resource.
- RLS policies must still be correct and tested, because they guard other paths.
- Document the permission matrix in `docs/authorization.md` once the spec is known.
