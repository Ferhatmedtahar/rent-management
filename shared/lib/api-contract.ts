/**
 * HTTP contract fixed by ASSESSMENT.md section 7 (docs/adr/0015). Shared by
 * route handlers (server) and the client fetch wrapper.
 *
 * Success bodies are the bare JSON of each endpoint (e.g. `201 { id }`), so they
 * have no shared type here. Errors are always `{ "error": "message" }` with the
 * HTTP status carrying the meaning (400, 401, 403, 404, 409, 422, 500).
 */

/** Every route lives under this prefix, exactly as written in the brief. */
export const API_BASE_PATH = "/api";

export type ApiErrorBody = {
  error: string;
};
