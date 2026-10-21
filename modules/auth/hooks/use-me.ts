"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/lib/query-keys";
import { fetchMe } from "../services/auth-api.service";

/** React Query hook to get currently authenticated user details from /api/me. */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me.info(),
    queryFn: ({ signal }) => fetchMe(signal),
  });
}
