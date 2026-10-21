# 0007. Cursor (keyset) pagination

- Status: Superseded by 0015 (the brief defines no list pagination; revisit for the bonus list search)
- Date: 2026-10-20

## Context

Invoice and payment lists grow without bound and change while users read them
(new invoices, new payments). Offset pagination (`LIMIT n OFFSET m`) skips or
repeats rows when data is inserted between page loads and gets slower as the
offset grows, because the database must scan and discard the skipped rows.

## Decision

List endpoints use cursor (keyset) pagination: `?limit=&cursor=`. The server
orders by a deterministic key (`created_at, id`, with `id` as tiebreaker),
applies `WHERE (created_at, id) > (cursor values)`, and returns
`meta.nextCursor` (null on the last page). Cursors are opaque base64 so clients
cannot depend on their shape. `limit` has a default and a hard maximum. Sort
columns are indexed to match.

## Alternatives considered

- **Offset/limit:** simple and allows "jump to page 7", but unstable under
  writes and O(offset) in cost.
- **Page numbers + total count:** needs `COUNT(*)` on large tables.

## Consequences

- Stable pages while data changes; constant-time page fetches with an index.
- No random page access or total count (UI uses "Load more"/infinite scroll
  via React Query `useInfiniteQuery`).
- Each list endpoint must define and index its sort key.
