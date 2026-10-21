# UI build plan (for any AI agent)

Audience: an AI agent that has never seen this repo. Read this file fully, then do **one task at a
time** (section 12) and stop after each. This plan covers the UI only; the backend and database are
done and are not to be changed except for the two small read endpoints in task U0.

## 0. Rules you must follow (non-negotiable)

1. Read first, in order: `CLAUDE.md`, `AGENTS.md`, `DESIGN.md`, this file. `AGENTS.md` is
   authoritative for architecture; `DESIGN.md` for look and feel.
2. **Never** run: `pnpm dev`, `next dev`, `prisma migrate`, `prisma db *`, `supabase *`,
   `docker *`, any seed. The human runs them and reports back. **Never** `git add/commit/push`.
   **Never** read or print `.env*`. `pnpm` only (never npm/npx/yarn; use `pnpm dlx`).
3. One task, then run `pnpm format`, `pnpm lint`, `pnpm type-check`, `pnpm test`, and
   `SKIP_ENV_VALIDATION=true pnpm build`, report the result, and **stop**.
4. Do not disable lint rules. The ESLint rules are the architecture (section 3).
5. Money: never do money math or `Math.round/toFixed/parseFloat`. Display with `formatSen`
   (`shared/lib/format-money.ts`), parse input with `parseRinggitToSen` (`lib/billing.ts`).
6. Dates: every date and time shown or typed is **Malaysia time** (`Asia/Kuala_Lumpur`, UTC+8, no
   DST), whatever the browser timezone. Use only the helpers in section 7. No `toLocale*String`,
   no `new Date(...).getDate()`, no `new Date()` during render.
7. The secret key (`SUPABASE_SECRET_KEY`) must never reach the browser. Client code uses only the
   publishable key (`shared/supabase/browser.ts`). Never import `shared/supabase/admin.ts` or
   anything `server-only` from client code.
8. If another assistant (you) writes code, its session log must be exported to `ai-logs/` by the
   human. Keep sessions focused, paste no secrets, and say what you decided and why in your report.

## 1. What exists (do not rebuild)

Backend (Next route handlers), all return bare JSON; errors are `{ "error": "message" }`:

| Endpoint                                               | Who                           | Success                                                         | Errors                           |
| ------------------------------------------------------ | ----------------------------- | --------------------------------------------------------------- | -------------------------------- |
| `GET /api/me`                                          | any logged in                 | `{ userId, role, orgId }` (verify exact keys in `modules/auth`) | 401                              |
| `POST /api/leases`                                     | manager                       | 201 `{ id }`                                                    | 400, 403, 404, 409 overlap       |
| `GET /api/leases/:leaseId`                             | staff, manager, owning tenant | 200 (shape below)                                               | 401, 404                         |
| `POST /api/leases/:leaseId/payments`                   | staff, manager                | 201 `{ id, status }`                                            | 400, 403, 404, 422 over cap      |
| `POST /api/payments/:id/approve`                       | manager                       | 200 `{ status }`                                                | 403, 404, 409, 422               |
| `POST /api/payments/:id/reject`                        | manager                       | 200 `{ status }`                                                | 400 (reason >= 5), 403, 404, 409 |
| `POST /api/payments/:id/void`                          | manager                       | 200 `{ status }`                                                | 400 (reason >= 5), 403, 404, 409 |
| `POST /api/leases/:leaseId/gateway-bills`              | owning tenant                 | 201 `{ billId, amountSen }`                                     | 403, 404, 422 nothing due        |
| `GET /api/gateway-bills/:billId`                       | owning tenant, staff, manager | 200 `{ billId, amountSen, status }`                             | 404                              |
| `GET /api/reports/collections?from=YYYY-MM&to=YYYY-MM` | staff, manager                | 200 `[{ month, collectedSen }]`                                 | 400, 403                         |
| `POST /api/webhooks/gateway`                           | the gateway only              | not used by the UI                                              |                                  |

`GET /api/leases/:leaseId` body:

```ts
{ lease: { id, unitId, tenantId, startDate, endDate, monthlyRentSen, depositSen },
  invoices: { id, kind: 'deposit'|'rent', periodIndex: number|null, periodStart: string|null,
              periodEnd: string|null, dueDate, amountSen, paidSen,
              status: 'paid'|'partially_paid'|'unpaid'|'overdue' }[],   // allocation order
  payments: { id, amountSen, unappliedSen, method: 'cash'|'bank_transfer'|'online',
              status: 'pending_verification'|'approved'|'rejected'|'voided',
              receivedAt: string /* ISO with +08:00 */ }[] }
```

Already in the repo: `/health` page (reference module), `/payments/return` page
(`modules/gateway/screens`, plain styling, restyle in U6), React Query provider in
`app/layout.tsx`, design tokens in `app/globals.css`, `shared/lib/{api-client,query-keys,
format-money,malaysia-time}.ts`, Supabase clients in `shared/supabase/{browser,server}.ts`.

**Missing endpoints the UI needs** (added in task U0, extra endpoints are allowed by the brief):
`GET /api/leases` (list for staff/manager, scoped to `actor.orgId`) and `GET /api/reports/overdue`
(`{ overdueCount }`). Nothing else on the backend changes.

## 2. Seeded accounts (shared password = `SEED_PASSWORD` in `.env.example`)

`manager@northwind.test`, `staff@northwind.test`, `aisyah@northwind.test`, `ben@northwind.test`,
`probe@northwind.test`, `manager@beta.test`, `chen@beta.test`. Aisyah's lease (unit A-12-3) has the
interesting data: 7 invoices, a cash payment (RM 3,000), an approved bank transfer (RM 2,000) with a
slip.

## 3. Architecture for UI code (enforced by ESLint)

```text
app/<route>/page.tsx            -> renders exactly ONE screen container, no logic
modules/<m>/screens/<x>-screen-container.tsx   client: calls hooks, owns mutations/toasts/state
modules/<m>/screens/<x>-screen.tsx             PURE view: props in, markup out
modules/<m>/components/*.tsx                   PURE pieces (dialogs, tables, badges)
modules/<m>/hooks/use-*.ts                      React Query hooks (useQuery / useMutation)
modules/<m>/services/<x>-api.service.ts         client service: only calls shared/lib/api-client
modules/<m>/index.ts                            public API: export containers and types only
```

- Pure views and `components/` may **not** import `@tanstack/react-query`, services, stores,
  `api-client` or Supabase (lint error). They receive data and callbacks as props.
- Forms: `react-hook-form` + `zod` (`@hookform/resolvers/zod`) are allowed inside a pure dialog
  component; the container passes `onSubmit` and `isSubmitting`.
- Cross-module imports go through the other module's `index.ts` only.
- All server state uses React Query: reads are `useQuery`, writes are `useMutation` with
  `retry: false` (already the default). After a mutation, invalidate with `queryKeys`. Add keys in
  `shared/lib/query-keys.ts` (`me`, `leases`, `lease(id)`, `reports`, `overdue`, `tenantPortal`).
  Never `useEffect` + `fetch`.
- Only the **tenant portal's own reads and phone update** may use Supabase directly (section 9);
  everything else goes through `/api`.

## 4. Stack and installation

Everything is already installed except shadcn/Radix, Lucide and Sonner. From the repo root:

```bash
# 1. shadcn config: create components.json by hand (do NOT run an interactive init, it rewrites
#    globals.css). Contents:
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york", "rsc": true, "tsx": true,
  "tailwind": { "config": "", "css": "app/globals.css", "baseColor": "neutral",
                "cssVariables": true, "prefix": "" },
  "iconLibrary": "lucide",
  "aliases": { "components": "@/shared/components", "utils": "@/shared/lib/utils",
               "ui": "@/shared/ui", "lib": "@/shared/lib", "hooks": "@/shared/hooks" }
}

# 2. add primitives (these install Radix, class-variance-authority, lucide-react, tw-animate-css)
pnpm dlx shadcn@latest add button input label textarea select dialog alert-dialog \
  dropdown-menu table badge card skeleton separator sonner tooltip
```

- Primitives live in `shared/ui/` (shadcn output). Compose them; do not fork their internals.
- After **every** `shadcn add`, run `git diff app/globals.css`-equivalent by reading the file: if the
  CLI changed colors or appended variables, **restore the tokens** (section 5). The design tokens
  in `app/globals.css` are the source of truth and already contain the shadcn bridge
  (`--color-primary`, `--color-muted`, `--color-ring`, ...).
- Icons: `lucide-react` only. Toasts: `sonner` via a `<Toaster />` mounted once in `app/layout.tsx`.
- Add `tw-animate-css` import to `globals.css` only if a component needs it and nothing breaks.
- Node deps are pnpm; the human converts to npm for graders at the end. Do not touch lockfiles by
  hand.

## 5. Look and feel (from `DESIGN.md`, summarized)

- Calm, trustworthy, Apple-like. One accent: trust blue (`text-tint`, `bg-tint-fill`,
  `text-on-tint`). Light and dark follow the system via `light-dark()` tokens; never hardcode hex.
- Surfaces: page `bg-bg`, cards `bg-card` with `rounded-card` and hairline `border-outline`
  (no heavy shadows), insets `bg-inset`. Text: `text-label`, secondary `text-label-2`.
- Type scale classes: `text-large-title` (page title), `text-title-2` (card title), `text-headline`,
  `text-body`, `text-subheadline` (table cells), `text-footnote`, `text-caption`. Amounts and number
  columns: add `tabular` and right-align.
- Status badges (always text, never color only): `paid` -> green, `partially_paid` -> orange,
  `unpaid` -> gray, `overdue` -> red; payments: `approved` green, `pending_verification` orange,
  `rejected` red, `voided` gray. Soft background (`bg-green-soft`) + colored text (`text-green`).
- Containers: `container-max` for dashboards, `container-mid` for forms.
- One primary button per view. Destructive actions use a confirm dialog that states the amount.
- Accessibility: visible focus (already global), label on every input, `aria-invalid` +
  `aria-describedby` on invalid fields, real `<table>` with `<th scope>`, dialogs trap focus.
- **Logo:** a small `shared/components/logo.tsx`: an inline SVG mark (rounded square in `tint-fill`
  containing a simple house or key glyph in `on-tint`) next to the wordmark "Rent Collection" in
  `text-headline`. Used in the staff nav, tenant nav and login page. No external image files.

## 6. Every screen has four states (required)

| State   | Pattern                                                                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Loading | Skeleton matching the layout (`Skeleton`), `role="status"`, `aria-busy`. Never a blank screen.                                                                                       |
| Error   | Plain-language message in a red-soft banner (`role="alert"`) + "Try again" calling `refetch`. Show `ApiError.message` for expected errors (409, 422, 400); a generic line otherwise. |
| Empty   | Icon + one sentence on why it is empty + a primary CTA ("Create the first lease").                                                                                                   |
| Success | The content. After a mutation: a success toast and the data refreshes.                                                                                                               |

## 7. Malaysia time and money helpers (build first, in U1, with tests)

Create `shared/lib/format-datetime.ts` (pure, no `Intl`, no `toLocale*`, no local-time Date
methods; built on `getTime()` + `toISOString()` + a fixed +8h shift like `malaysia-time.ts`):

- `formatDateMyt(yyyyMmDd: string): string` -> `"31 Jan 2026"` (string split + month-name table,
  never `new Date(string)` on a date-only value).
- `formatDateTimeMyt(isoWithOffset: string): string` -> `"1 Mar 2026, 12:30 AM"` (parse to an
  instant, shift +8h, read UTC fields). Always followed by a muted "MYT" label in the UI.
- `malaysiaInputToIso(value: string): string` -> converts a `datetime-local` value
  (`"2026-03-01T00:30"`) to `"2026-03-01T00:30:00+08:00"` for `receivedAt`. Reject malformed
  values (throw; the form shows an error).
- `defaultMalaysiaNowInput(now: Date): string` -> current Malaysia time as a `datetime-local` value.
  Call it **inside the form's mount effect or default values factory from an injected clock after
  mount**, never during server render, to avoid hydration mismatch.
- Unit tests, also run by `pnpm test:tz` under UTC, Asia/Kuala_Lumpur and America/New_York.

Hydration rule: nothing rendered on the server may depend on the browser timezone or the current
time. Anything "now"-dependent is computed after mount.

## 8. Auth, session and routing

- **Login** (`/login`, public): email + password -> `supabase.auth.signInWithPassword` using the
  browser client (`@supabase/ssr` writes the session cookie, which the API already accepts). On
  success call `GET /api/me`, then `router.replace`: `manager|staff` -> `/dashboard`,
  `tenant` -> `/portal`. Show "Incorrect email or password" for auth errors (never the raw message).
  Sign-out: `supabase.auth.signOut()` then `/login`.
- `/` redirects like login does (logged out -> `/login`).
- **Route guard** (UX only; the API and RLS are the real security): a `proxy.ts` at the repo root
  (Next 16 uses `proxy.ts`, not `middleware.ts`; read `node_modules/next/dist/docs/` for the exact
  API) refreshes the session cookie with `@supabase/ssr` and redirects unauthenticated requests for
  `/dashboard`, `/leases*`, `/portal` to `/login`. Do not put role logic in the proxy; role mismatches
  are handled in the layouts: a tenant opening `/dashboard` is redirected to `/portal` and vice
  versa, decided from `useMe()`.
- Route groups: `app/(staff)/{dashboard,leases}` with a staff layout (top nav: logo, Dashboard,
  Leases, user menu with role and Sign out), `app/(tenant)/portal` with a tenant layout (logo,
  user menu). `/login`, `/payments/return` use a bare layout.
- If `cacheComponents` in `next.config.ts` fights dynamic, cookie-reading pages, read the Next docs
  and fix it (for example mark the layouts dynamic or disable the flag); `npm run build && npm start`
  must keep working.

## 9. Screens

### 9.1 `/login`

Card centered in `container-mid` width 420px: logo, title "Sign in", email, password, primary
"Sign in" (loading + disabled while submitting), error banner. Helpful footer text: none needed.

### 9.2 `/dashboard` (staff, manager)

- Top row: card "Overdue invoices" with the count (`GET /api/reports/overdue`).
- Card "Collections, last 6 months": table (Month, Collected) from
  `GET /api/reports/collections?from=<month-5>&to=<current month>`. Compute the month range with a
  small pure helper using `todayInMalaysia(now)` after mount (UTC arithmetic on the year/month
  numbers; test it, including year rollover). Months shown as "Jan 2026"; amounts `formatSen`,
  right-aligned, `tabular`. A bar chart is optional; a table is enough.
- States: skeletons, error banner with retry, empty ("Nothing collected yet").
- Link "View leases" -> `/leases`.

### 9.3 `/leases` (staff, manager)

Table from `GET /api/leases`: Unit, Tenant, Period (`start - end` via `formatDateMyt`), Monthly rent,
Deposit, with the whole row linking to `/leases/[leaseId]`. Empty state (manager): CTA "Create lease"
(optional bonus screen; for staff just the sentence). Client-side filter input by unit/tenant is
enough.

### 9.4 `/leases/[leaseId]` (staff, manager) - the most important screen

Data: `useLease(id)` -> `GET /api/leases/:id`. Header: unit and tenant names come from the
list endpoint (add them to the `GET /api/leases/:id` response ONLY if the brief's shape tests would
not break; they would, so **do not** change that response: read the names from the cached list or
from `GET /api/leases` filtered by id; fall back to showing dates only).

- **Invoices table**: Period (deposit shows "Deposit"; rent shows `periodStart - periodEnd`), Due
  date, Amount, Paid, Balance (amount minus paid, computed by subtraction only), Status badge. Row
  order is the API order. Footer row: totals (sum with plain integer addition; display `formatSen`).
- **Payments table**: Received (`formatDateTimeMyt` + "MYT"), Method, Amount, Status badge,
  Unapplied (online only, when > 0), Slip (bank transfer only: "View slip" button), Actions
  (manager only, see below).
- **Slip link**: staff/manager read `payments.slip_path` through the browser Supabase client
  (RLS allows own-org staff to select it): one query `from('payments').select('id, slip_path')
.eq('lease_id', id)`; on click `supabase.storage.from('payment-slips').createSignedUrl(path, 60)`
  and open the URL in a new tab with `rel="noopener noreferrer"`. Show an error toast on failure.
  Never store or log signed URLs.
- **Record payment** (button visible to staff and manager; a header "Record payment" opens a
  dialog): fields **Amount (RM)** text input with `inputMode="decimal"` and placeholder `1,500.00`
  (validated by `parseRinggitToSen`, error "Enter an amount like 1,500.00"), **Method** select
  (Cash / Bank transfer), **Received** `datetime-local` input labelled "Received (Malaysia time)"
  defaulting to now (section 7), and for Bank transfer a **Slip** file input (JPEG, PNG or PDF, max
  5 MB: validate type and size client-side with clear messages).
  Submit flow in the container: (1) if bank transfer, upload the file with the browser Supabase
  client to `payment-slips/<orgId>/<crypto.randomUUID()>.<ext>` (`orgId` from `useMe()`);
  (2) `POST /api/leases/:id/payments` with `{ amountSen, method, receivedAt, slipPath? }`;
  (3) on 201 toast "Payment recorded" (manager) or "Payment recorded, waiting for manager approval"
  (staff, status `pending_verification`), invalidate `lease(id)`, close the dialog.
  Errors: 422 -> inline form error with the server message ("exceeds what is still owed"); 400 ->
  inline; others -> toast. The server removes the uploaded object when recording fails, so the UI
  does not delete it. If the upload itself fails, show a toast and do not POST. Disable the submit
  button while submitting (no double submit).
- **Approve / Reject / Void** (manager only; hidden from staff, but the API is the real check):
  - Approve on `pending_verification`: confirm `AlertDialog` "Approve RM X?" -> `POST .../approve`.
    409 -> toast "This payment was already handled" + refetch; 422 -> toast with the server message.
  - Reject on `pending_verification`: dialog with a required **Reason** textarea (min 5 characters
    after trim, inline error) -> `POST .../reject { reason }`.
  - Void on `approved`: dialog stating the amount and a required reason (min 5) -> `POST .../void`.
  - Success toasts: "Payment approved / rejected / voided"; invalidate `lease(id)`, `overdue`,
    `reports`.
- Empty states: no invoices (impossible, but handle) and no payments ("No payments yet. Record the
  first one.").

### 9.5 `/portal` (tenant)

- Reads **directly with supabase-js + RLS** (required by the brief): own tenant row
  (`tenants` where `user_id = auth user`), own leases (`leases`), and own phone. For the lease detail
  call `GET /api/leases/:leaseId` (a tenant may read their own lease). If a tenant has several
  leases, show a simple selector; default to the latest.
- Cards: **Lease** (unit name via `units` select, dates, rent, deposit), **Amount due now**
  (invoices with `dueDate <= todayInMalaysia(now)` and unpaid, balance = `amountSen - paidSen` summed
  with plain addition; computed after mount with an injected clock; display only - the server
  recomputes it when creating the bill), **Invoices** table with status badges, **Payments** table
  (no slip link, no actions).
- **Pay now**: enabled only when amount due now > 0. Calls `POST /api/leases/:id/gateway-bills`,
  then a dialog shows "Payment bill created", the **Bill id** (monospace, copy button) and the
  **amount** (`formatSen`), the text "In production you would be redirected to the payment gateway.
  For this test, send the bill to the gateway simulator.", and a link **Check payment status** to
  `/payments/return?bill_id=<id>`. 422 -> toast "Nothing is due right now". Never mark anything as
  paid in the UI.
- **Edit phone**: inline form; empty input sends `null`; otherwise validate
  `^[0-9+() -]+$`, max 20 chars, helpful message. Save with
  `supabase.from('tenants').update({ phone }).eq('user_id', userId)`; the tenant may update only
  `phone`. Success toast "Phone updated"; show the DB error as "Could not update phone" otherwise.

### 9.6 `/payments/return`

Exists (`modules/gateway/screens`). Restyle with the card pattern and status badge only. It must
keep reading only `bill_id`, polling `GET /api/gateway-bills/:billId` while `pending`, and **never**
reading or trusting `paid=` in the URL. Statuses: pending ("Waiting for the payment gateway..."),
paid ("Payment received"), failed ("Payment failed"), not found. Link back to `/portal`.

### 9.7 Optional bonus (only if everything else is done): `/leases/new`

Manager form (unit select, tenant select, dates, monthly rent, deposit) with a live schedule
preview from `generateSchedule` (`lib/billing.ts`, pure, safe on the client). Unit and tenant lists
come from RLS reads. Submit `POST /api/leases`; 409 -> "These dates overlap another lease on this
unit".

## 10. Form pattern (use everywhere)

Label above input, always visible. Helper text in `text-footnote text-label-2`; the error replaces
it in `text-red`, linked by `aria-describedby`, input has `aria-invalid`. Validate on blur, then on
change after the first error. Submit button label is the action ("Record payment"), shows a spinner
and is disabled while submitting. A form-level error banner shows the server message. Money inputs
are `type="text"` with `inputMode="decimal"`, never `type="number"`.

## 11. Testing expectations

- Unit tests (Vitest) for pure helpers: `format-datetime`, the 6-month range helper, amount-due-now,
  slip validation (type/size), the form zod schemas.
- Container/view tests with Testing Library for the dialogs (reject needs a 5+ char reason, submit
  disabled while submitting, hydration-safe default values). Mock services, not `fetch`.
- No test should depend on the machine timezone. Run `pnpm test:tz`.
- The human does the visual QA (section 13). You cannot run the app: after each task list exactly
  what to open and what to see.

## 12. Tasks (do one, then stop)

**U0 - Backend reads (small).** In `modules/leases` add `GET /api/leases` (staff/manager, scoped to
`actor.orgId`, 403 for tenants; returns `[{ id, unitName, tenantName, startDate, endDate,
monthlyRentSen, depositSen }]` ordered by start date, id). In `modules/reports` add
`GET /api/reports/overdue` (staff/manager) -> `{ overdueCount }` = invoices of the org not fully
paid with `due_date < todayInMalaysia(now)` (compute with the same rule as `invoiceStatus`, inject
the clock). Same anatomy, lock-free reads, `withErrorHandling`, unit tests with a fake store, and
check scripts like the existing ones. Do not change any existing response shape.

**U1 - Foundations.** `components.json`, shadcn primitives, `<Toaster />`, `logo.tsx`,
`format-datetime.ts` + tests (`test:tz`), query keys (`me`, `leases`, `lease`, `reports`, `overdue`,
`tenantPortal`), `useMe`, a shared `PageState` set (`LoadingState`, `ErrorState`, `EmptyState`)
and `StatusBadge` in `shared/components`, restore `globals.css` tokens if the CLI changed them.

**U2 - Auth shell.** `/login`, `/` redirect, `proxy.ts`, `(staff)` and `(tenant)` layouts with nav
and sign out, role redirects.

**U3 - Lease detail (read-only).** `/leases/[leaseId]` with invoices, payments, slip link, states.

**U4 - Lease detail (actions).** Record payment dialog (+ slip upload), approve / reject / void
dialogs, toasts, invalidation.

**U5 - Dashboard and lease list.** `/dashboard` and `/leases`.

**U6 - Tenant portal.** `/portal` (RLS reads, amount due now, Pay now dialog, phone edit) and
restyle `/payments/return`.

**U7 - Polish and QA.** Dark mode pass, keyboard pass, empty/error states everywhere, remove dead
code, make sure `pnpm build` is clean with no hydration warnings, write the QA notes into
`docs/ui-qa.md`.

## 13. Human QA checklist (after each task, in a browser)

1. Sign in as each role; wrong password shows a friendly error; sign out works.
2. Manager `/leases/<Aisyah>`: 7 invoices (deposit first), paid and statuses correct, payments with
   RM 3,000 cash and RM 2,000 bank transfer, slip opens in a new tab.
3. Record a cash payment above the remaining balance -> inline 422 message; below -> success toast.
4. As staff: recorded payment shows "waiting for approval"; as manager approve it; reject and void
   need a 5+ character reason.
5. Tenant `/portal`: only their own data; "Amount due now" non-zero for Aisyah; Pay now shows a
   bill id; run `GATEWAY_X_SIGNATURE_KEY=test_x_signature_key node gateway-sim.mjs <billId> <amount>`;
   `/payments/return?bill_id=...` turns to "Payment received" without any manual refresh.
6. Edit phone: valid number saves; letters are rejected with a message.
7. **Timezone test:** in Chrome DevTools -> Sensors, override the timezone to America/New_York, then
   to UTC, and reload: every date and time must be identical to Malaysia time and the console must
   show **no hydration warnings**.
8. Light and dark themes, keyboard-only navigation, mobile width.
9. `npm run build && npm start` still works.

## 14. Definition of done (UI)

All screens in section 9 exist with the four states, toasts on every action (success and error),
Malaysia time everywhere, no hydration warnings, no `any`, lint and type-check clean, tests green
under three timezones, no secret key in client bundles (`grep -r SUPABASE_SECRET_KEY .next/static`
finds nothing).
