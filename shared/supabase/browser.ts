import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/env";

/** Browser Supabase client. Auth session and Storage uploads only; data goes through /api/v1. */
export function createClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
