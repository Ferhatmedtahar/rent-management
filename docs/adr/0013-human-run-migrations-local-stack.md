# 0013. Human-run migrations on a local Supabase stack

- Status: Accepted
- Date: 2026-10-20

## Context

Graders run our migrations and seed on their own machine against a local
Supabase stack (Docker + Supabase CLI), not a cloud project. Schema and RLS
changes are the highest-risk changes in a money system, and AI-generated SQL
can be subtly wrong.

## Decision

- Develop against the **local Supabase stack** (`supabase start`). Postgres on
  `54322`, API on `54321`, Studio on `54323`.
- **Prisma owns the schema and migration history** (`prisma/migrations`). RLS
  policies, triggers and constraints Prisma cannot express are raw SQL inside
  the same migration (created with `--create-only`).
- **A human reviews and applies every migration.** Agents write schema and SQL
  and stop; they never run `prisma migrate`, `prisma db`, or `supabase db`
  (enforced in `.claude/settings.json`).
- Apply with `prisma migrate deploy` for reproducibility (no shadow database);
  `migrate dev` is for authoring only.
- The seed (`prisma/seed.ts`) is idempotent and must run on an empty database.
- The app is dockerized separately (`Dockerfile`, `docker-compose.yml`); the
  Supabase stack stays on the CLI's own compose network.

## Open question (resolve when the spec is received)

Graders run "your migrations and seed" on a local Supabase stack, most likely
`supabase start` then `supabase db reset`. `db reset` applies only
`supabase/migrations/*.sql` and `supabase/seed.sql`; it does **not** run Prisma
migrations. Check the spec for which path it expects, then pick one:

1. **Prisma as source, mirrored for Supabase:** keep `prisma/migrations` and also
   emit the same SQL into `supabase/migrations` (for example with
   `prisma migrate diff --script`) so both `prisma migrate deploy` and
   `supabase db reset` produce the same database; RLS lives in the Supabase
   migrations. Seed through `prisma/seed.ts` and, if required, `supabase/seed.sql`.
2. **Supabase migrations as source:** write SQL in `supabase/migrations`, use
   `prisma db pull` / `prisma generate` for types. Simplest for graders, weaker
   Prisma story.

Whichever is chosen, the README documents exactly one command path from a clean
machine. Until the spec is known, this ADR stays Accepted for the principles
(human-run, local, reproducible) and the mechanism above is undecided.

## Alternatives considered

- **Supabase SQL migrations (`supabase/migrations`) as source of truth:** fine
  for RLS, but the brief calls for Prisma and loses type-safe schema history.
- **Letting the agent run migrations:** faster, but removes the review step on
  the riskiest change type.

## Consequences

- Every schema change has a human review gate and a clean commit.
- README must document exact commands and order so graders can reproduce.
