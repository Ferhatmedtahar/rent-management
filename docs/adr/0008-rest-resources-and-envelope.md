# 0008. REST resource naming and response envelope

- Status: Accepted
- Date: 2026-10-20

## Context

Consistent URLs and response shapes let the client layer, error handling and
tests be written once.

## Decision

- **Resources** are plural kebab-case nouns, nested one level for ownership:
  `/leases`, `/leases/{id}/invoices`, `/invoices/{id}/payments`. Standard verbs:
  `GET` read, `POST` create, `PATCH` partial update, `DELETE` remove (rare for
  financial data). Verbs appear in the path only for real actions
  (`POST /invoices/{id}/void`).
- **Success:** `{ "data": T, "meta"?: { nextCursor, limit } }`.
- **Error:** `{ "error": { "code", "message", "fields"? } }`; HTTP status is
  derived from a closed set of `code` values (`VALIDATION_FAILED` 422,
  `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, ...).
- Contract types live in `shared/lib/api-contract.ts` and are shared by server
  helpers and the client, so both sides cannot drift.

## Alternatives considered

- **Bare payloads with status codes only:** no room for metadata or typed errors.
- **GraphQL/tRPC:** more power than needed and unfamiliar to graders.

## Consequences

- Forms map `error.fields` straight onto inputs; React Query reads one `ApiError`.
- A tenant cannot be told whether a forbidden resource exists: use `NOT_FOUND`
  where existence itself is sensitive.
