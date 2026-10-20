import "server-only";

import { NextResponse } from "next/server";
import {
  API_VERSION,
  type ApiErrorBody,
  type ApiErrorCode,
  type ApiSuccessBody,
  type PageMeta,
} from "./api-contract";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  IDEMPOTENCY_KEY_REUSED: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

const VERSION_HEADER = { "X-API-Version": API_VERSION };

/** Build a successful v1 response. */
export function apiSuccess<T>(
  data: T,
  options?: { status?: number; meta?: PageMeta },
): NextResponse<ApiSuccessBody<T>> {
  const body: ApiSuccessBody<T> = { data, meta: options?.meta };
  return NextResponse.json(body, {
    status: options?.status ?? 200,
    headers: VERSION_HEADER,
  });
}

/** Build a failed v1 response. Never leak internals in `message`. */
export function apiError(
  code: ApiErrorCode,
  message: string,
  fields?: Record<string, string[]>,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error: { code, message, fields } },
    { status: STATUS_BY_CODE[code], headers: VERSION_HEADER },
  );
}
