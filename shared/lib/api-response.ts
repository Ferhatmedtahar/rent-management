import "server-only";

import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import type { ApiErrorBody } from "./api-contract";
import { HttpError } from "./http-error";

/** Success response: the bare JSON body of the endpoint, e.g. `json({ id }, 201)`. */
export function json<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

/** Error response: `{ "error": message }`. Never leak internals in `message`. */
export function apiError(
  status: number,
  message: string,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: message }, { status });
}

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

/**
 * Wraps a route handler. `HttpError` becomes `{ error }` with its status; any
 * other error becomes a generic 500. Only the error message is logged, never
 * request bodies, headers or payloads (webhook callbacks carry signatures).
 * Next.js control-flow errors (redirect, notFound, request-time APIs) pass through.
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Response | Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof HttpError) {
        return apiError(error.status, error.message);
      }
      unstable_rethrow(error);
      console.error(
        "Unhandled API error:",
        error instanceof Error ? error.message : "non-Error value thrown",
      );
      return apiError(500, GENERIC_ERROR_MESSAGE);
    }
  };
}
