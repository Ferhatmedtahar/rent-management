# Rent Collection System

Rent collection module for Malaysian property management companies: leases, invoices, cash /
bank transfer / online payments, and access control for managers, staff and tenants.
Business timezone is `Asia/Kuala_Lumpur`, currency MYR, all money is integer **sen**.

Stack: Next.js 16 (App Router), TypeScript strict, Supabase (Postgres, Auth, RLS, Storage),
Prisma, shadcn/ui + Tailwind CSS, TanStack Query, zod.

## Run it (from a fresh clone)

```bash
npx supabase start            # local stack from supabase/config.toml (Docker required)
npx supabase db reset         # rebuilds the database from supabase/migrations/
npm install
cp .env.example .env.local    # replace keys with `npx supabase status` values if they differ
npm run seed
npm run build && npm start    # http://localhost:3000
```

All seeded accounts share the password in `.env.example` (`SEED_PASSWORD`). Log in as
`manager@northwind.test`. Other accounts: `staff@northwind.test`, `aisyah@northwind.test`,
`ben@northwind.test`, `probe@northwind.test`, `manager@beta.test`, `chen@beta.test`.

Gateway simulator (brief section 5): `GATEWAY_X_SIGNATURE_KEY=test_x_signature_key node
gateway-sim.mjs <bill_id> <amount_sen> [true|false]`.

## How it is built

- `lib/billing.ts`: pure schedule, invoice status and ringgit parsing (tests run under three
  timezones: `npm run test:tz`).
- `supabase/migrations/`: schema, constraints, RLS, grants, audit append-only triggers and the
  private `payment-slips` bucket. `prisma/schema.prisma` is hand-written to match.
- `modules/<name>/`: each feature owns its api, services, repositories, schemas, hooks, screens.
  Prisma is only imported from repositories (ESLint-enforced).
- Authorization is enforced in code (Prisma bypasses RLS) and again by RLS for the Data API and
  Storage. Docs: `docs/database.md`, `docs/adr/`, `AGENTS.md`.
- Write-ups: `REVIEW.md` (Part B), `DECISIONS.md` (Part C).

## AI use

Planning and review used a separate Claude session, and one early reference guide came from
another assistant; both logs are in `ai-logs/`. The pre-test scaffold (tooling, lint rules, docs,
Docker files, an empty module skeleton) was prepared before the timer started; all domain code
(database, billing, payments, webhook, reports) was written during the test.

## Status

| Area                                                           | Status                                                   |
| -------------------------------------------------------------- | -------------------------------------------------------- |
| Billing, access control, payments, webhook, collections report | Implemented, covered by unit tests and `*:check` scripts |
| UI                                                             | **Not finished — functional scaffolding only**           |

### The UI is not finished

This submission is backend-first and the interface was left unfinished. Please judge the
project on the domain logic, API, database and security layers, not on the front end.

What is **not** done:

- **No finished UI/UX.** Pages exist as rough, functional scaffolding so the API can be driven
  from a browser. Layout, spacing, hierarchy, empty/error states and the design system in
  `DESIGN.md` are not applied consistently, and several screens called for in the brief are
  missing or only partially wired.
- **No animations or transitions.** No motion, page transitions, skeleton shimmer, toasts, or
  micro-interactions were built.
- **No polish:** no responsive pass, no accessibility audit, no dark-mode QA, no loading-state
  design, no visual QA of any kind.
- **No end-to-end UI tests.**

## Known issues and what was skipped

- **UI/UX and animation are unfinished** (see above). Treat the front end as a demo harness for
  the API, not a deliverable.
- `Idempotency-Key` is not used (not in the brief).
- No deposit refund flow (not in the brief).
- The optional integrity triggers ("migration 3") were not added.
- The `*:check` scripts create throwaway data; run `npx supabase db reset && npm run seed`
  afterwards.

## Next steps

1. Finish the UI/UX: apply `DESIGN.md` properly, complete every screen, add animations and
   transitions, toasts, loading/empty/error states, responsive and accessibility passes.
2. Deposit refund / credit notes, list pagination and search, realtime tenant portal updates.
3. The optional database integrity triggers, end-to-end browser tests.
