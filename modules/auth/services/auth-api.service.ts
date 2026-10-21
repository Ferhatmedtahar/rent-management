import { api } from "@/shared/lib/api-client";
import type { MeResponse } from "../types/actor.types";

/** Client service for GET /api/me. The only layer hooks call. */
export function fetchMe(signal?: AbortSignal): Promise<MeResponse> {
  return api.get<MeResponse>("/me", { signal });
}
