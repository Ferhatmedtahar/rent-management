# 0005. Zustand for large client state only

- Status: Accepted
- Date: 2026-10-20

## Context

Some UI state is not server data and outgrows `useState`: a multi-step wizard
(create lease), a record-payment flow spanning several components, or filters
that must survive navigation. Prop drilling and Context re-render the whole
subtree for every change.

## Decision

Use `useState`/`useReducer` for local state. Use **Zustand**, module-scoped in
`modules/<name>/store/`, only for client-only state that must survive
navigation or be shared across distant components. **Never store server data in
a store**; that belongs in React Query (ADR 0004). Stores are consumed by
containers and hooks, never by pure views.

## Alternatives considered

- **Redux Toolkit:** more ceremony than this scope needs.
- **React Context:** re-renders all consumers on any change; fine for stable
  values (theme, user identity), poor for fast-changing state.
- **Jotai:** comparable; Zustand's single-store selectors are simpler to read.

## Consequences

- Small, selector-based stores with minimal re-renders and no provider.
- Two sources of truth are avoided by the rule above; reviews must enforce it.
