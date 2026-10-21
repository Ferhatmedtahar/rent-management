# 0011. Idempotency keys and webhook deduplication

- Status: Accepted for webhook deduplication, locking and unique constraints.
  The `Idempotency-Key` header part is dropped by 0015 (the brief has no such header).
- Date: 2026-10-20

## Context

Networks retry. A user double-clicks "Pay", a client retries after a timeout, or
a provider redelivers a webhook. Without protection each retry can record a
second payment. Concurrent requests can also race on the same invoice.

## Decision

- **Client-initiated money-moving POSTs** require an `Idempotency-Key` header,
  generated once per user intent and reused on retry. A table
  `idempotency_keys(key, actor_id, request_hash, response, status, created_at)`
  with a unique `(actor_id, key)` stores the outcome. Same key + same body →
  return the stored response. Same key + different body → `422
IDEMPOTENCY_KEY_REUSED`. In-flight duplicates wait or get `409`.
- **Webhooks** verify the signature, then insert the provider event id into a
  unique `webhook_events` table inside the same transaction as the payment
  effect. A duplicate id is acknowledged (`200`) and ignored.
- **Concurrency:** payment application runs in a transaction that locks the
  invoice row (`SELECT ... FOR UPDATE`) or relies on a unique constraint, then
  recomputes the outstanding balance server-side.
- Payment status follows a state machine; illegal transitions are rejected.

### Details (from the engineering review; confirm against the spec)

- **Locking:** `SELECT ... FROM invoices WHERE id = $1 FOR UPDATE` via
  `$queryRaw` at the start of the transaction. A plain `findUnique` reads without
  a lock, so two concurrent payments both see the same balance and both succeed.
  Optimistic `version` counters are an acceptable alternative only with a retry
  loop; we prefer the explicit lock for clarity.
- **Duplicate detection by constraint, not by lookup:** insert the payment and
  catch the unique violation (`P2002`) on `(actor_id, idempotency_key)`. A
  check-then-insert has a race window between two simultaneous requests.
- **Key scope:** unique per actor (and endpoint), not globally, so one user's key
  cannot collide with or probe another's. Store `request_hash`; same key with a
  different body is `422 IDEMPOTENCY_KEY_REUSED`.
- **Webhook uniqueness:** `(provider, event_id)`, not `event_id` alone (two
  providers may reuse an id). Verify the signature on the raw request body before
  parsing JSON.
- **Out-of-order and duplicate events:** the handler never assumes sequence. It
  records every event, then applies it against current state with the state
  machine (e.g. `payment.failed` arriving after `payment.succeeded` is stored but
  ignored; a late `succeeded` for a refunded payment does not reopen it).
  Duplicates return `200` without side effects.
- **Amount authority:** the server recomputes the outstanding balance inside the
  locked transaction; a client or webhook amount that exceeds it is rejected
  (and, for webhooks, flagged for manual review rather than silently dropped).

## Alternatives considered

- **Client-side debounce only:** does not protect against retries or webhooks.
- **Natural keys only (e.g. unique provider reference):** covers webhooks but not
  cash/bank-transfer entries created by staff.

## Consequences

- Safe retries by default. Extra table and a lookup per money-moving request.
- Keys expire after a retention window (set when the spec is known).
- Details (key scope, retention, states) are confirmed after reading the spec.
