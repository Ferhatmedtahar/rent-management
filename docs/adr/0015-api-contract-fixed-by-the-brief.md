# 0015. API contract fixed by the brief

- Status: Accepted. Supersedes 0006 (URL-path versioning) and 0008 (REST
  envelope). Also retires the parts of 0007 (cursor pagination) and 0011
  (`Idempotency-Key`) that assumed those decisions.
- Date: 2026-10-20

## Context

`ASSESSMENT.md` section 7 fixes the HTTP API: endpoint paths, request bodies,
and response shapes. Hidden tests call exactly those paths as each seeded
account. Earlier ADRs designed a different contract: a `/api/v1` prefix, an
`X-API-Version` header, a `{ data, meta }` success envelope, an error object
with `code` and `fields`, cursor pagination and an `Idempotency-Key` header.
The brief names its own contract, so ours cannot differ from it.

## Decision

- Routes live at `/api/...` exactly as written in the brief
  (`/api/leases`, `/api/payments/{id}/approve`, `/api/webhooks/gateway`,
  `/api/reports/collections`). No version prefix. Our own extra route,
  `/api/health`, follows the same rule.
- Success bodies are the **bare JSON** of the endpoint (`201 { id }`,
  `200 { status }`, an array for the report). There is no envelope.
- Errors are `{ "error": "message" }`. The HTTP status carries the meaning:
  400 invalid input, 401 no valid login, 403 visible record but action not
  allowed, 404 not found or in another organization, 409 conflict, 422 rule
  violation. There is no error `code` and no per-field map.
- One thin layer enforces this: `json(data, status)` and `apiError(status,
message)` in `shared/lib/api-response.ts`; `HttpError(status, message)` in
  `shared/lib/http-error.ts`; and `withErrorHandling(handler)`, which maps
  `HttpError` to `apiError`, maps anything unexpected to a generic 500, and
  logs only the error message (never bodies or payloads). The client side is
  `ApiError(status, message)` in `shared/lib/api-client.ts`.
- No list pagination and no `Idempotency-Key`: the brief defines neither.
  Concurrency safety comes from the lease row lock and unique constraints
  (docs/database.md section 5.4); webhook deduplication stays as in 0011.
- A breaking change to this contract is not ours to make: it belongs to whoever
  owns the brief. Within our own extra routes, only additive changes.

## Alternatives considered

- **Keep `/api/v1` and add the brief's paths as aliases:** two surfaces to keep
  in sync and test, for no consumer of the old one.
- **Keep the `{ data, meta }` envelope for our own routes:** inconsistent with
  every route the tests call, and the client would need two decoding paths.
- **Keep error `code` and `fields`:** the brief's error body is a single string;
  extra keys risk failing strict shape checks. Field-level form errors can be
  derived client-side from the same zod schemas.

## Consequences

- Route handlers, services and the client are simpler: one error shape, no
  unwrapping.
- Forms show a banner with the server message; per-field messages come from
  the shared zod schema on the client.
- Status codes must be chosen carefully and tested per endpoint and role
  (401/403/404 rules in AGENTS.md section 7).
