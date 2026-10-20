import "server-only";

import { createClient, type AuthError, type User } from "@supabase/supabase-js";
import { env } from "@/env";
import { createClient as createCookieClient } from "@/shared/supabase/server";
import type { VerifiedIdentity } from "../services/auth.service";

/**
 * Identity verification against Supabase Auth. ALWAYS auth.getUser(), which
 * asks the Auth server; never getSession(), which trusts the cookie unchecked.
 * Only the user id leaves this file: metadata and claims are not passed on.
 */

type UserResult = { data: { user: User | null }; error: AuthError | null };

function toIdentity({ data, error }: UserResult): VerifiedIdentity | null {
  if (error) {
    // 4xx: the token or session is not valid, which is a failed login (401).
    if (
      typeof error.status === "number" &&
      error.status >= 400 &&
      error.status < 500
    ) {
      return null;
    }
    // Network error or 5xx: an outage, not a bad login. Surfaces as a 500.
    throw new Error(`Auth server unavailable: ${error.message}`);
  }
  return data.user ? { id: data.user.id } : null;
}

/** Bearer path: publishable key client, then getUser(token). */
export async function verifyBearer(
  token: string,
): Promise<VerifiedIdentity | null> {
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  return toIdentity(await supabase.auth.getUser(token));
}

/** Cookie path: the normal session client from shared/supabase/server.ts. */
export async function verifyCookieSession(): Promise<VerifiedIdentity | null> {
  const supabase = await createCookieClient();
  return toIdentity(await supabase.auth.getUser());
}
