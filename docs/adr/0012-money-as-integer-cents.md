# 0012. Money as integer sen in one pure module

- Status: Accepted (reworded from "integer cents in `shared/lib/money.ts`";
  the assessment brief fixes the unit as sen and the file as `lib/billing.ts`)
- Date: 2026-10-20

## Context

Floating-point arithmetic cannot represent most decimal amounts exactly
(`0.1 + 0.2 !== 0.3`), and ad-hoc rounding scattered across code produces
off-by-a-sen errors, invoices that do not add up, and inconsistent display.
The assessment grades money correctness explicitly, and runs the billing
functions under three timezones.

## Decision

- All amounts are **integer sen** (1 ringgit = 100 sen) in the database
  (`bigint`, never float/real/double/numeric) and in code (RM 19.99 = `1999`).
- **One file, `lib/billing.ts`,** owns all money math and rounding. It exports
  exactly `generateSchedule`, `invoiceStatus` and `parseRinggitToSen`. It is
  pure: no imports, no I/O, no local-time Date methods, so results are
  identical under any `TZ`. Display formatting is a separate helper added with
  the UI, under the same no-float rule.
- **Rounding rule: half up to the nearest sen**, defined once in that file and
  computed with exact integer (BigInt) math, never floats; rounding happens
  only at the end of a calculation (last-period proration).
- ESLint bans `Math.round/floor/ceil/trunc`, `toFixed` and `parseFloat` outside
  `lib/billing.ts`, and forbids imports and local-time Date APIs inside it.
  `lib/billing.ts` is test-first (`lib/billing.test.ts`, `pnpm test:tz`).

## Alternatives considered

- **Prisma `Decimal` / Postgres `numeric`:** exact, but every caller still
  needs a rounding policy, and it is easy to mix with floats. Integer sen plus
  one module makes the invariant mechanical.
- **A money library (e.g. dinero.js):** capable, but the brief requires a pure,
  dependency-free `lib/billing.ts` with fixed signatures.
- **`splitEvenly` / `applyPercent` helpers (earlier plan):** dropped; the brief
  has no splitting or percentage fees. Add them to the module with tests if a
  rule ever needs them.

## Consequences

- Single place to audit and test; no float can reach the database.
- `bigint` columns map to JS `bigint` in Prisma; API bodies carry plain
  integers, capped at 1e12 sen so they stay safe in JSON.
- Multi-currency or sub-sen pricing would need a new decision (not in scope).
