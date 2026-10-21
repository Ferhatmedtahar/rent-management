import "server-only";

import { createClient } from "@supabase/supabase-js";
import { env } from "@/env";

/**
 * Supabase client with the SECRET (service role) key. It bypasses RLS and can
 * call the Auth admin API, so it is for trusted server code only: the seed, and
 * manager-initiated account creation behind an authenticated, authorized
 * endpoint. Never import this from client code, a component or a tenant-reachable
 * path (`server-only` fails the build if it leaks into a client bundle).
 *
 * No session is kept: every call is made with the secret key itself.
 */
export function createAdminClient() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
