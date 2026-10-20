import { API_BASE_PATH, type ApiErrorBody } from "./api-contract";

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

/** Thrown for every non-2xx response. React Query and forms read this. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type RequestOptions = {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  signal?: AbortSignal;
};

function errorMessage(payload: unknown): string {
  const message = (payload as Partial<ApiErrorBody> | null)?.error;
  return typeof message === "string" && message ? message : FALLBACK_MESSAGE;
}

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = new URL(`${API_BASE_PATH}${path}`, "http://placeholder");
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${url.pathname}${url.search}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
    credentials: "same-origin",
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(payload));
  }

  // Success bodies are the bare JSON of the endpoint (docs/adr/0015).
  return payload as T;
}

/** The only HTTP entry point for client code. Services call this, never fetch. */
export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>("GET", path, options),
  post: <T>(path: string, options?: RequestOptions) =>
    request<T>("POST", path, options),
  patch: <T>(path: string, options?: RequestOptions) =>
    request<T>("PATCH", path, options),
  put: <T>(path: string, options?: RequestOptions) =>
    request<T>("PUT", path, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, options),
};
