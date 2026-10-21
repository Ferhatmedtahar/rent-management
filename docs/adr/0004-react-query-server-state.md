# 0004. TanStack Query for all server state

- Status: Accepted
- Date: 2026-10-20

## Context

Server data (leases, invoices, payments) must stay correct on screen: cached,
refreshed when stale, retried on transient failure, and invalidated after a
write. Hand-rolled `useEffect` + `fetch` + `useState` gets each of these subtly
wrong (races, stale data, missing error states).

## Decision

Every read is a `useQuery`, every write a `useMutation`, in module hooks.
Defaults live in one place (`shared/lib/query-client.ts`): 30s stale time,
refetch on focus and reconnect, retry up to twice but never on 4xx, and
**mutations never auto-retry** (a retried payment is a double charge).
Keys live in `shared/lib/query-keys.ts`; mutations invalidate the affected
domain. Queries pass `signal` so requests cancel.

## Alternatives considered

- **SWR:** similar, smaller mutation story.
- **`useEffect` + fetch:** no cache, no dedupe, easy to introduce race bugs.
- **RSC-only data fetching:** good for first paint, but interactive screens
  still need client cache, refetch and optimistic updates.

## Consequences

- Loading, error and empty states come from query state consistently.
- Contributors must use hooks; ESLint blocks React Query inside pure views.
- Devtools are available in development.
