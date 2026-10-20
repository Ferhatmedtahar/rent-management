import { isServer, QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";

const MAX_QUERY_RETRIES = 2;

/** Never retry client errors (4xx): the same request will fail the same way. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < MAX_QUERY_RETRIES;
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Fresh for 30s: no refetch storms, but data never sits stale for long.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      // Never auto-retry mutations: a retried payment is a double charge.
      mutations: { retry: false },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/** New client per server request, one shared client in the browser. */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
