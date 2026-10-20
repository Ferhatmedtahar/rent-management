# 0009. No trust at any boundary

- Status: Accepted
- Date: 2026-10-20

## Context

Money systems fail at the seams: a client sends a tampered amount, a route
forgets an ownership check, a webhook is replayed, a provider returns an
unexpected shape. Relying on "the layer above already checked" makes a single
mistake exploitable.

## Decision

Every boundary validates and authorizes independently:

1. **Browser → route:** zod-validate params, query, body; reject unknown
   fields; never accept computed money from the client (recompute server-side).
2. **Route → service:** authenticate the session, then authorize against the
   specific resource (role **and** ownership).
3. **Service → repository:** repositories require an actor/tenant scope; no
   unscoped queries on tenant data.
4. **Repository → database:** constraints (NOT NULL, CHECK, UNIQUE, FK) and RLS
   are the last line of defense.
5. **Webhook → route:** verify signature, dedupe by event id.
6. **Server → provider:** validate provider responses before use.

## Alternatives considered

- **Validate once at the edge:** less code, but any internal caller or future
  route bypasses it.

## Consequences

- Some duplicated checks (intentional). Client-side validation is UX only.
- Defects are contained: one missed check does not expose another tenant's data.
- Higher test surface; each boundary has its own tests.
