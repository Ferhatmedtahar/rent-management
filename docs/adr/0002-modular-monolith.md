# 0002. Modular monolith with `index.ts` public APIs

- Status: Accepted
- Date: 2026-10-20

## Context

A rent collection system has distinct domains (properties, leases, invoices,
payments, access control). Without boundaries, any file can import any other,
money logic spreads, and a change in one place breaks another. We also want to
be able to lift a module into a separate service later.

## Decision

One deployable app, organised as modules under `modules/<name>/`. Each module
owns its `actions`, `adapters`, `api`, `components`, `features`, `hooks`,
`repositories`, `schemas`, `screens`, `services`, `strategies` and `types`.
`index.ts` is the module's only public surface. ESLint enforces the boundaries
(cross-module imports through `index.ts`, Prisma only in `repositories/`,
pure components). `page.tsx` renders exactly one screen container.

## Alternatives considered

- **Flat `components/ lib/ hooks/` layout:** fast to start, but ownership is
  unclear and money/auth logic sprawls.
- **Separate services or packages now:** more isolation, far more setup and
  operational cost than a timed build warrants.

## Consequences

- Every feature has a predictable home; reviewers know where to look.
- Some ceremony (barrel files, container/view split) in exchange for enforced
  structure.
- Module boundaries double as the seams for extracting a service later.
