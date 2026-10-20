# Rent Collection System

Rent collection for property managers: leases, invoices, cash / bank transfer /
online payments, and access control for managers, staff and tenants.
It is a **money system**. Correctness beats speed. When a rule below and a
shortcut conflict, the rule wins.

Stack (mandated by the assessment, see `docs/adr/0001`): Next.js 16 (App
Router) + React + TypeScript (strict) + Supabase (PostgreSQL, Auth, RLS,
Storage) + Prisma + shadcn/ui (Radix) + Tailwind CSS 4.
Package manager: **pnpm** only. Runtime: Node 22. Local backend: Supabase CLI
stack in Docker. Deployment target: Docker (`Dockerfile`).

> Prefer retrieval-led reasoning over pre-training-led reasoning for Next.js,
> React, Prisma and Supabase. These versions are newer than your training data:
> read `node_modules/next/dist/docs/` and the installed package docs before
> writing code against them.

---

## 1. Hard rules (no exceptions)

1. **No `any`.** Use `unknown` and narrow. ESLint fails the build.
2. **Never trust any boundary.** Validate and authorize at every layer
   (section 7). A check in the layer above does not excuse the layer below.
3. **Money is integer sen, handled only by `lib/billing.ts`** (section 5).
4. **Never run:** `pnpm dev` / `next dev` (ask the user), database migrations,
   `prisma migrate *`, `prisma db *`, `supabase db *`, `supabase start|stop|reset`.
   You write SQL and Prisma schema; **the user reviews and runs it.**
5. **Never touch git state:** no `git add`, `commit`, `push`, `reset`,
   `checkout`, `stash`. The user commits.
6. **Never read or print `.env*` files.** Test through behaviour instead.
7. **Never delete code without asking.** Fix it instead.
8. **pnpm only.** Never `npm`, `npx` or `yarn`. Use `pnpm add`, `pnpm exec`,
   `pnpm dlx`.
9. **One small task at a time, then stop** and wait for the user to commit.
   Do not chain unrelated work "while you're here".
10. **Do not disable lint rules** to get unblocked. Fix the design, or ask.

---

## 2. Architecture

Modular monolith, API-first.

### Data flow (one direction, never skip a layer)

```text
page.tsx
  -> screens/<x>-screen-container.tsx   (container: wires hooks to the view)
       -> screens/<x>-screen.tsx        (pure view: props in, markup out)
       -> hooks/use-<x>.ts              (React Query; reusable logic)
            -> services/<x>-api.service.ts   (client service)
                 -> shared/lib/api-client.ts -> HTTP /api/v1/...
                      -> app/api/v1/<x>/route.ts   (re-exports only)
                           -> modules/<m>/api/<handler>.ts   (route handler logic)
                                -> modules/<m>/services/<x>.service.ts (server domain service)
                                     -> modules/<m>/repositories/<x>.repository.ts
                                          -> shared/db/prisma.ts -> PostgreSQL (RLS on)
```

- **`/api/v1` is the contract.** All data reads and writes from the UI go
  through it. A separate backend can replace the route handlers later without
  touching a component, hook or screen. Never call Prisma or Supabase data APIs
  from client code.
- **Everything is `v1`.** New routes live under `app/api/v1/`. A breaking
  change means a new `/api/v2`, never an edit to v1 semantics
  (`docs/adr/0006`).
- **Server Actions are the exception**, not the rule: only for flows that must
  run on the server and redirect (e.g. Google sign-in / sign-out). Put them in
  `modules/<m>/actions/`. Reads and mutations go through `/api/v1`.
- **Route handlers are thin.** Parse and validate input (zod), authenticate,
  authorize, call a service, shape the response with `apiSuccess` / `apiError`.
  No business logic in `route.ts` or `api/` handlers.
- **Patterns in use:** container/presentational (screens), adapter (payment
  provider, storage), strategy (rent proration, late fees, payment methods).
  See `docs/patterns.md`.

### Module structure

Every feature lives in `modules/<name>/`:

```text
modules/<name>/
├── index.ts          # PUBLIC API. The only path other modules may import. Client-safe only.
├── actions/          # "use server" actions (rare, see above)
├── adapters/         # external-system adapters (payment provider, storage)
├── api/              # route-handler logic; app/api/v1/** re-exports from here
├── components/       # PURE presentational components, module-scoped
├── constants/        # static data
├── features/         # sub-feature folders (own components + schemas)
├── hooks/            # React Query hooks + reusable logic hooks
├── repositories/     # the ONLY layer that imports Prisma
├── schemas/          # zod schemas + DTO types (shared client/server)
├── screens/          # <x>-screen.tsx (pure view) + <x>-screen-container.tsx
├── services/         # <x>-api.service.ts (client) + <x>.service.ts (server)
├── store/            # Zustand stores (module-scoped, rare)
├── strategies/       # strategy-pattern implementations
└── types/            # module-owned types
```

Rules (ESLint-enforced, `eslint.config.mjs`):

- **Cross-module imports go through the target's `index.ts` only.** Deep paths
  are legal solely for `actions/`, `api/`, `schemas/`, `constants/`, `types/`.
- **`index.ts` never re-exports server-only code** (`services/<x>.service.ts`,
  `repositories/`, `adapters/`).
- **Prisma / `shared/db` is importable from `repositories/` only.**
- **`components/` and `screens/<x>-screen.tsx` are pure**: they may not import
  React Query, services, stores, `api-client` or Supabase.
- **`fetch` is banned** outside `shared/lib/api-client.ts` and `adapters/`.
- **`process.env` is banned.** Import `env` from `env.ts`.
- `page.tsx` renders **exactly one** screen container and contains no logic.
- Types are per module (`modules/<name>/types/`). Shared types only when two
  modules genuinely need them, and then in `shared/`.

Cross-module shared code: `shared/ui` (shadcn primitives), `shared/components`,
`shared/lib` (api client, query client, query keys, money, utils),
`shared/providers`, `shared/db`, `shared/supabase`.

---

## 3. Components, hooks, state

- **Components are pure.** Same props, same output. No fetching, no timers, no
  store access, no `window` reads inside the render path.
- **Reusable logic goes in hooks** (`hooks/use-*.ts`). A container calls hooks
  and passes plain props to the view.
- **Server state = TanStack Query. Always.** Every read is a `useQuery`, every
  write a `useMutation`. Never `useEffect` + `fetch` + `useState`.
  - Query keys live in `shared/lib/query-keys.ts`. Never inline a key.
  - Staleness, retry, refetch-on-focus/reconnect are configured once in
    `shared/lib/query-client.ts` (30s stale, no retry on 4xx, mutations never
    auto-retry). Override per hook only with a written reason.
  - After a mutation, **invalidate** the affected keys
    (`queryClient.invalidateQueries({ queryKey: queryKeys.<domain>.all })`).
  - Use `signal` from `queryFn` so requests cancel.
- **Local UI state:** `useState` / `useReducer`.
- **Zustand** only for larger client-only state that must survive navigation
  or be shared across distant components (e.g. a multi-step wizard).
  Never put server data in Zustand (`docs/adr/0005`).
- No React Context for data. Context is for stable dependencies (theme, user
  identity) only.

### Every screen handles four states

1. **Loading** (skeleton or `role="status"` message, never a blank screen).
2. **Error** (clear message in plain language + a retry action).
3. **Empty** (explains why it is empty + a clear CTA to fix it).
4. **Success.**

### Forms

React Hook Form + zod. One schema per form, defined once in
`modules/<m>/schemas/`, **reused by the client resolver and by the server
(route handler / action)**. The server re-validates; the client check is UX only.

- Per-field error messages in plain language, tied to inputs with
  `aria-invalid` / `aria-describedby`.
- A form-level error banner for server errors (`ApiError.fields` maps server
  validation errors back onto fields).
- Submit button shows a loading state and is disabled while submitting
  (no double submit).
- Money inputs use `parseRinggitToSen` on submit; never store a float in form state.
- Money-moving requests send an `Idempotency-Key` (generated once per user
  intent, reused on retry).

---

## 4. API conventions (v1)

Contract in `shared/lib/api-contract.ts`; helpers in `shared/lib/api-response.ts`.

- Base path `/api/v1`. Response header `X-API-Version: 1`.
- Resources are plural nouns, kebab-case: `/leases`, `/leases/{id}/invoices`,
  `/invoices/{id}/payments`. Verbs only for true actions
  (`POST /invoices/{id}/void`).
- Success: `{ "data": T, "meta"?: { nextCursor, limit } }`.
- Error: `{ "error": { "code", "message", "fields"? } }` with the HTTP status
  mapped from `code` (see `STATUS_BY_CODE`). Never leak stack traces, SQL or
  internal ids in `message`.
- **Pagination is cursor-based (keyset)**, never offset: `?limit=&cursor=`.
  Cursors are opaque base64 of the sort key + id; order is always
  deterministic (`ORDER BY created_at, id`). See `docs/adr/0007`.
- Payments and any money-moving POST require an `Idempotency-Key` header.
  Same key + same body returns the stored response; same key + different body
  is `422 IDEMPOTENCY_KEY_REUSED`. Webhooks dedupe on the provider event id.
  See `docs/adr/0011` (accepted once the spec is known).
- Every route is validated with zod (params, query, body) before any logic.

---

## 5. Money (strict, no exceptions)

1. **Store and calculate all money as integer sen** (RM 19.99 = `1999`;
   1 ringgit = 100 sen).
   - DB columns: `bigint`, **never** `float`, `real`, `double precision`, or
     `numeric` for money amounts.
   - Never use JavaScript floats for money (no `19.99`, no `price * 1.075`).
2. **ONE file, `lib/billing.ts`, is the only place money math and rounding
   happens.** It is pure (no imports, no I/O, no local-time Date methods) and
   exports exactly the brief's three functions:
   - `generateSchedule(lease)`: deposit + monthly rent invoices; the last,
     cut-short period is prorated with exact integer math.
   - `invoiceStatus(invoice, now)`: paid / overdue / partially_paid / unpaid,
     overdue by the Malaysia calendar date.
   - `parseRinggitToSen(input)`: `"1,500.50"` -> `150050`.
     Displaying sen as RM goes through one formatter, added with the UI (not in
     `lib/billing.ts`), under the same no-float rule.
3. **Rounding rule: round half up to the nearest whole sen** (`50014.5` ->
   `50015`). Written once, in `lib/billing.ts` only, with a comment. **Round
   only at the end** of a calculation, never in the middle.
4. **No inline money math anywhere else.** No `Math.round/floor/ceil/trunc`,
   `toFixed`, `parseFloat`, and no multiplying or dividing money in
   components, routes or services (ESLint-enforced). Call `lib/billing.ts`.
5. **Money crosses boundaries only through `lib/billing.ts`:**
   - user input -> `parseRinggitToSen`
   - display -> the single formatter (see 2)
   - payment provider in/out -> sen integers, converted once in the adapter
6. **`lib/billing.ts` has unit tests** (written first, `lib/billing.test.ts`),
   run under three timezones with `pnpm test:tz`: the brief's worked examples,
   half-up rounding (`50014.5` -> `50015`), month-end anchors, leap years, the
   overdue boundary. Every new money rule gets a test before the code.

Payments are also guarded by: a state machine (no skipping states), a DB
transaction with row locks or unique constraints for concurrent writes, and
idempotency keys. Never trust the amount from the client: recompute it on the
server from the invoice.

**Payment rules (partial payments and overpayment):**

- A payment amount must be an integer `> 0`. The server computes
  `outstanding = invoice.amount_sen - sum(allocations)` and rejects
  any payment `> outstanding` with `CONFLICT` (no silent overpayment, no
  unapplied credit unless the spec says so).
- Partial payments are allowed; invoice status derives from the totals
  (`PENDING` -> `PARTIALLY_PAID` -> `PAID`), never from the client.
- There is no stored `paid` column: an invoice's paid amount is the sum of its
  `payment_allocations` (docs/database.md section 7.1). A deferred DB trigger
  (migration 3, optional) is the last line of defence against over-allocation.
- Apply a payment inside ONE transaction that first locks the lease row:
  `SELECT ... FROM leases WHERE id = $1 FOR UPDATE` (via `$queryRaw`). A plain
  `findUnique` does not lock; two concurrent payments would both read the same
  balance and both succeed.
- Idempotency: unique `(actor_id, idempotency_key)`; on conflict return the
  stored response; store a hash of the request body and reject reuse of a key
  with a different body (`422 IDEMPOTENCY_KEY_REUSED`). Detect the duplicate by
  catching the unique-violation, not by check-then-insert.
- Webhooks: unique `(provider, event_id)`; verify the signature on the RAW body
  before parsing; insert the event and apply its effect in one transaction;
  acknowledge duplicates with `200`. Webhooks can arrive out of order: apply by
  comparing against current state (e.g. a `succeeded` event for an already
  refunded payment is recorded but does not reopen it), never assume sequence.

---

## 6. Dates and time

- Store **UTC** timestamps (`timestamptz`). Store due dates and billing periods
  as **date-only** (`date`), not timestamps.
- "Overdue", billing-cycle boundaries and day counts are computed in the
  **property's IANA timezone**, never the server's local time.
- Never use `new Date("YYYY-MM-DD")` for date-only values (it parses as UTC and
  shifts a day). Use a date-only helper in `shared/lib/`.
- Day counts for proration come from a helper and are tested around month ends,
  leap years and timezone boundaries.
- **A property has an IANA timezone** (`properties.timezone`, e.g.
  `America/Chicago`). "Today" for any business decision is
  `todayInTimezone(property.timezone)` as a `YYYY-MM-DD` string. Comparing a UTC
  "now" to a due date flags tenants overdue hours early.
- **Overdue is derived, not stored**, by default: `today_in_property_tz > due_date`
  and status is not `PAID`/`VOID`. Compare `YYYY-MM-DD` strings; do not build
  `Date` objects from them.
- **Month-end rollover:** adding months clamps to the last day (Jan 31 + 1 month
  = Feb 28/29), never overflows into March. One helper (`addMonths`), tested.
  Recurring due dates are computed from the lease anchor day each period, not by
  repeatedly adding to the previous result (which drifts 31 -> 28 -> 28).
- **DST edges:** never add `24 * 3600 * 1000` ms for "one day". Do calendar
  arithmetic on date-only values. A local midnight that does not exist or occurs
  twice must not change which calendar date it is.
- Prisma returns `@db.Date` columns as `Date` at UTC midnight. Format with
  `toISOString().slice(0, 10)` and nothing else.

---

## 7. Security: no trust at any boundary

| Boundary              | Required                                                                         |
| --------------------- | -------------------------------------------------------------------------------- |
| Browser -> route      | zod-validate params, query, body. Reject unknown fields. Never trust client math |
| Route -> service      | authenticate (Supabase session), then **authorize against the resource**         |
| Service -> repository | repositories take an actor/tenant scope; no unscoped `findMany` on tenant data   |
| Repository -> DB      | DB constraints (NOT NULL, CHECK, UNIQUE, FK) are the last line; RLS is on        |
| Webhook -> route      | verify signature, dedupe by event id, then process idempotently                  |
| Server -> provider    | adapters validate provider responses with zod before use                         |

- **Prisma bypasses RLS** (it connects as the table owner). Authorization is
  therefore enforced in the service layer, and RLS is defense-in-depth for the
  Supabase client and Storage (`docs/adr/0010`). Never assume RLS protects a
  Prisma query.
- Roles: `manager`, `staff`, `tenant`. Check role **and** ownership
  (a tenant reads only their own lease and invoices; staff only properties
  they are assigned to, unless the spec says otherwise).
- **Role source of truth is the database profile**, read per request in the
  service layer. Never trust a role from the request body, `user_metadata`
  (user-editable) or a stale JWT claim alone. New sign-ups are always `tenant`;
  staff/manager are created only by a manager through an authenticated
  endpoint using the service role, never with a shared or hardcoded password.
- `proxy.ts` (Next 16; not `middleware.ts`) does fast redirects for
  unauthenticated users only. It is UX, not authorization.
- RLS helper functions live in a `private` schema, are `SECURITY DEFINER` with a
  fixed `search_path`, and are never created in Supabase's `auth` schema
  (`docs/adr/0010`).
- Secrets: server-only env vars, never `NEXT_PUBLIC_`. `SUPABASE_SECRET_KEY`
  is used on the server only and never in a code path reachable by a tenant.
- Use `import "server-only"` in repositories, server services and adapters.
- Storage: private buckets, signed URLs, size/type checks server-side.
- Error messages to the user are generic; details go to server logs.

---

## 8. Database and migrations (human-run)

- Source of truth: `prisma/schema.prisma`. Migrations in `prisma/migrations/`.
  RLS policies, triggers and constraints Prisma cannot express go in raw SQL
  files inside the same migration (created with `--create-only`).
- **You never apply anything.** Produce the schema change / SQL, explain it,
  and stop. The user reviews, runs `pnpm db:migrate:dev`, and commits.
- Local DB is the Supabase CLI stack (`supabase start`, user-run).
  Prisma CLI connects with `DIRECT_URL`; the app uses `DATABASE_URL`.
- Every table: `id` (uuid), `created_at`, `updated_at`, explicit FKs with
  `ON DELETE` behaviour chosen deliberately (RESTRICT for financial history),
  CHECK constraints for money (`amount_sen >= 0`) and enums as Postgres enums.
- Never hard-delete financial records. Void / reverse with a new row.
- Seed script `prisma/seed.ts` must be idempotent and run on an empty DB.

---

## 9. Styling and UI

- Tailwind CSS 4 (CSS-first, `app/globals.css`, no `tailwind.config`).
- shadcn/ui (Radix) primitives in `shared/ui/`; compose, do not fork.
- `cn()` from `shared/lib/utils.ts` for conditional classes.
- Icons: Lucide React.
- Semantic HTML, keyboard reachable, visible focus, labels on every input.
- **`DESIGN.md` is the design system** (trust-blue accent, light/dark, Apple-like
  type scale, status colors, screen-state and form patterns). Tokens live in
  `app/globals.css`. Use token classes; never hardcode a hex in a component.

---

## 10. Commands

| Command             | Use                                  |
| ------------------- | ------------------------------------ |
| `pnpm build`        | Verify production build              |
| `pnpm lint`         | ESLint (includes architecture rules) |
| `pnpm lint:fix`     | Auto-fix                             |
| `pnpm type-check`   | TypeScript strict                    |
| `pnpm test`         | Vitest                               |
| `pnpm format`       | Prettier write                       |
| `pnpm format:check` | Prettier check (CI)                  |
| `pnpm commit`       | Commitizen (user runs it)            |
| `pnpm db:generate`  | Regenerate Prisma client (safe)      |
| `pnpm db:migrate:*` | **User only**                        |
| `docker compose up` | **User only**                        |

Before handing a task back, run in order: `pnpm format`, `pnpm lint`,
`pnpm type-check`, `pnpm test`.

Commits are Conventional Commits (`feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`),
enforced by commitlint. Branches: `main` (prod) <- `staging` <- `dev` <-
`feat/*`. See `docs/git-workflow.md`.

---

## 11. Environment variables

Validated in `env.ts` (`@t3-oss/env-nextjs` + zod). **Always import `env`**,
never `process.env`. Add every new variable to `env.ts` and `.env.example`.

- Server: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SECRET_KEY`,
  `GATEWAY_X_SIGNATURE_KEY`, `SEED_PASSWORD` (optional, seed only)
- Client: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

---

## 12. Key files

| File                                  | Purpose                                               |
| ------------------------------------- | ----------------------------------------------------- |
| `shared/lib/api-contract.ts`          | v1 wire types, error codes, base path                 |
| `shared/lib/api-response.ts`          | `apiSuccess()` / `apiError()` for route handlers      |
| `shared/lib/api-client.ts`            | The only client HTTP entry point (`api.get/post/...`) |
| `shared/lib/query-client.ts`          | React Query defaults (stale, retry, refetch)          |
| `shared/lib/query-keys.ts`            | All query keys                                        |
| `lib/billing.ts`                      | The only place money math happens (pure, TZ-proof)    |
| `shared/db/prisma.ts`                 | The Prisma client (repositories only)                 |
| `shared/supabase/{server,browser}.ts` | Supabase clients (auth session, Storage)              |
| `modules/health/`                     | Reference module: copy its shape for new modules      |
| `docs/`                               | ADRs, database, auth, payments, patterns              |
| `DESIGN.md` · `app/globals.css`       | Design system and tokens                              |

---

## 13. Required tests (write first, Vitest)

The hidden tests probe edge cases; ours must cover them before the code exists.

- **Money:** half-up rounding (`50014.5` sen -> `50015`), proration across month
  lengths, `parseRinggitToSen` rejecting `1.234`, `"abc"`, `-5` and values above
  `Number.MAX_SAFE_INTEGER`.
- **Dates:** Jan 31 + 1 month, leap-year Feb, overdue at the property-timezone
  midnight boundary (UTC already the next day), DST transition days.
- **Payments:** partial payment, exact payment, overpayment rejected, payment
  against `PAID`/`VOID` rejected, two concurrent payments cannot overpay.
- **Idempotency:** same key + same body returns the stored response (one row);
  same key + different body is rejected; double-submit creates one payment.
- **Webhooks:** duplicate `(provider, event_id)` applied once; out-of-order
  events do not corrupt state; bad signature rejected before any write.
- **Authorization:** each role against each endpoint; a tenant cannot read or
  pay another tenant's invoice (expect `NOT_FOUND`/`FORBIDDEN`).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
