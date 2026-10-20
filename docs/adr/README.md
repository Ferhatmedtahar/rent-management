# Architecture Decision Records

Short records of decisions that are costly to reverse. Format: Context,
Decision, Alternatives, Consequences. Statuses: **Proposed**, **Accepted**,
**Superseded by NNNN**. New decision: copy `template.md`, take the next number,
add it below.

| #                                                | Decision                                                 | Status                                          |
| ------------------------------------------------ | -------------------------------------------------------- | ----------------------------------------------- |
| [0001](0001-mandated-stack.md)                   | Mandated stack (Next.js, React, Radix, Supabase, Prisma) | Accepted                                        |
| [0002](0002-modular-monolith.md)                 | Modular monolith with `index.ts` public APIs             | Accepted                                        |
| [0003](0003-api-first-data-access.md)            | API-first data access through `/api`                     | Accepted                                        |
| [0004](0004-react-query-server-state.md)         | TanStack Query for all server state                      | Accepted                                        |
| [0005](0005-zustand-client-state.md)             | Zustand for large client state only                      | Accepted                                        |
| [0006](0006-api-versioning.md)                   | URL-path API versioning (`/api/v1`)                      | Superseded by 0015                              |
| [0007](0007-cursor-pagination.md)                | Cursor (keyset) pagination                               | Superseded by 0015                              |
| [0008](0008-rest-resources-and-envelope.md)      | REST resource naming and response envelope               | Superseded by 0015                              |
| [0009](0009-trust-boundaries.md)                 | No trust at any boundary                                 | Accepted                                        |
| [0010](0010-prisma-bypasses-rls.md)              | Prisma bypasses RLS, so authorize in the service layer   | Accepted                                        |
| [0011](0011-idempotency-and-webhooks.md)         | Idempotency keys and webhook deduplication               | Accepted (webhook part; header dropped by 0015) |
| [0012](0012-money-as-integer-cents.md)           | Money as integer sen in one pure module                  | Accepted                                        |
| [0013](0013-human-run-migrations-local-stack.md) | Human-run migrations on a local Supabase stack           | Accepted                                        |
| [0014](0014-dates-and-timezones.md)              | Date-only due dates, UTC timestamps, property timezone   | Accepted                                        |
| [0015](0015-api-contract-fixed-by-the-brief.md)  | API contract fixed by the brief                          | Accepted                                        |
