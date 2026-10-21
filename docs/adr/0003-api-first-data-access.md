# 0003. API-first data access through `/api`

- Status: Accepted
- Date: 2026-10-20

## Context

Next.js lets components and Server Actions talk to the database directly. That
couples the UI to the data layer, makes authorization easy to skip, and makes
it hard to move logic to a dedicated backend later. This system handles money,
so we want one explicit, testable, secured entry point for every operation.

## Decision

All reads and writes from the UI go through Route Handlers under `/api`
(paths fixed by the brief, docs/adr/0015). The call chain is fixed: component → hook (React Query) → client
service → `api-client` → route → handler → server service → repository.
Components never fetch; hooks never call Prisma. Server Actions are reserved
for flows that must run on the server and redirect (Google sign-in/out).
A future separate backend replaces the handlers behind the same `/api`
contract without touching UI code.

## Alternatives considered

- **Server Actions for everything:** less boilerplate, but RPC-style endpoints
  are unversioned, awkward to call from other clients, and action IDs can skew
  across deploys.
- **Direct Supabase client from the browser:** fast, but moves authorization
  into RLS alone and lets clients touch money tables.

## Consequences

- One place to apply auth and validation.
- The contract is testable with plain HTTP, and webhooks fit the same model.
- More files per feature than Server Actions; offset by the module template.
