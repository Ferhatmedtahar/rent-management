/**
 * API v1 wire contract. Shared by route handlers (server) and the client
 * fetch wrapper so both sides agree on one shape. See docs/adr/0006 and 0008.
 */

/** Every route lives under this prefix. A breaking change means a new /v2. */
export const API_BASE_PATH = "/api/v1";
export const API_VERSION = "1";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "IDEMPOTENCY_KEY_REUSED"
  | "RATE_LIMITED"
  | "INTERNAL";

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Field-level problems, keyed by field path, for form display. */
    fields?: Record<string, string[]>;
  };
};

/** Cursor pagination metadata. `nextCursor` is null on the last page. */
export type PageMeta = {
  nextCursor: string | null;
  limit: number;
};

export type ApiSuccessBody<T> = {
  data: T;
  meta?: PageMeta;
};

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};
