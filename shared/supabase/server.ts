import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/env";

/** Supabase client bound to the caller's cookies, so RLS sees the real user. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component: cookies are read-only there.
            // Session refresh is handled by proxy.ts.
          }
        },
      },
    },
  );
}
