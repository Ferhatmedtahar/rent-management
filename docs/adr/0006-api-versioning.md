# 0006. URL-path API versioning (`/api/v1`)

- Status: Superseded by 0015
- Date: 2026-10-20

## Context

The API is the contract between UI and server, and later possibly a separate
backend and other clients. Contracts change; consumers must not break silently.

## Decision

Version in the URL path: every route lives under `/api/v1`, and responses carry
`X-API-Version: 1`. Within v1 only additive, backwards-compatible changes are
allowed (new optional fields, new endpoints). A breaking change creates
`/api/v2` alongside v1, with v1 kept until clients migrate. The prefix is a
single constant (`API_BASE_PATH`) used by client and server.

## Alternatives considered

- **Header versioning (`Accept: application/vnd.x.v1+json`):** cleaner URLs,
  but invisible in logs, curl and browser tools, and easy to forget.
- **No versioning:** simplest, but any breaking change is a flag day.
- **Query-string version:** easy to drop accidentally, awkward to cache.

## Consequences

- Version is obvious in every request and trace; routing and docs are simple.
- Resource URLs change between versions (acceptable trade-off).
- Folder layout mirrors the version: `app/api/v1/...`.
