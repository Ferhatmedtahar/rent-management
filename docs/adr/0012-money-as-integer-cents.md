# 0012. Money as integer cents in one module

- Status: Accepted
- Date: 2026-10-20

## Context

Floating-point arithmetic cannot represent most decimal amounts exactly
(`0.1 + 0.2 !== 0.3`), and ad-hoc rounding scattered across code produces
off-by-a-cent errors, split payments that do not sum to the total, and
inconsistent display. The assessment grades money correctness explicitly.

## Decision

- All amounts are **integer cents** in the database (`integer`/`bigint`, never
  float/real/double) and in code (`$19.99` = `1999`).
- **One file, `shared/lib/money.ts`,** owns all money math and rounding:
  `toCents`, `formatMoney`, `applyPercent`, `prorate`, `splitEvenly`.
- **Rounding rule: half up to the nearest cent**, defined once in that file;
  rounding happens only at the end of a calculation.
- `splitEvenly` distributes the remainder so parts always sum to the total
  (`1000` ÷ 3 = `[334, 333, 333]`).
- ESLint bans `Math.round/floor/ceil/trunc`, `toFixed` and `parseFloat` outside
  `money.ts`. Money crosses boundaries (input, display, provider) only through
  it. `money.ts` is test-first.

## Alternatives considered

- **Prisma `Decimal` / Postgres `numeric`:** exact, but every caller still
  needs a rounding policy, and it is easy to mix with floats. Integer cents plus
  one module makes the invariant mechanical.
- **A money library (e.g. dinero.js):** capable, but adds a dependency and
  learning surface for a small, fixed set of operations.

## Consequences

- Single place to audit and test; no float can reach the database.
- Multi-currency or sub-cent pricing would need a new decision (not in scope).
