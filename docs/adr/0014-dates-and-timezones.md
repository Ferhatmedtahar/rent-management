# 0014. Date-only due dates, UTC timestamps, property timezone

- Status: Accepted
- Date: 2026-10-20

## Context

Rent has two kinds of time. A _moment_ (a payment was submitted, a webhook
arrived) is a point on the UTC timeline. A _deadline_ (rent is due May 1) is a
calendar date with no time of day. Mixing them produces real bugs: a tenant in
Los Angeles at 6 PM on May 1 is already May 2 in UTC, so comparing a UTC "now"
to the due date flags them overdue (and charges a late fee) six hours early.

## Decision

- **Moments** are `timestamptz` (Prisma `DateTime @db.Timestamptz()`), stored and
  transmitted in UTC.
- **Deadlines** (due dates, lease start/end, billing periods) are `date` (Prisma
  `@db.Date`). They carry no time and no zone.
- Every **property has an IANA timezone** (`properties.timezone`). "Today" for
  any business rule is the current calendar date in that timezone, computed with
  `Intl.DateTimeFormat` and compared as `YYYY-MM-DD` strings.
- **Overdue is derived**, not stored: `today_in_property_tz > due_date` and the
  invoice is not `PAID`/`VOID`. This avoids a nightly job that is wrong between
  runs. If a stored status is ever needed (for filtering), a job refreshes it and
  the derived check remains the authority.
- Date arithmetic is calendar arithmetic on date-only values via helpers in
  `shared/lib/`: month-end clamping (Jan 31 + 1 month = Feb 28/29), anchor-day
  recurrence (compute each period from the lease anchor, not from the previous
  result), and no millisecond-based "add a day" (breaks on DST days).
- API contract: dates are `YYYY-MM-DD` strings, timestamps are ISO-8601 with `Z`.
  Never `new Date("YYYY-MM-DD")` to represent a calendar date.

## Alternatives considered

- **Store due dates as timestamps at a fixed UTC time:** wrong for properties in
  other zones and breaks on DST.
- **Server-local time for "today":** depends on where the server runs; Docker and
  Vercel default to UTC.
- **A date library (date-fns-tz, Temporal):** capable, but a few small tested
  helpers cover the needed operations without a new dependency; revisit if
  requirements grow.

## Consequences

- Correct overdue behaviour in every timezone; a single place to test boundaries.
- Developers must use the helpers; ESLint can't catch `new Date(string)` misuse,
  so reviews and tests do.
- Cross-timezone reporting needs an explicit "as of" timezone.
