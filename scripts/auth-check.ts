/**
 * End-to-end check of authentication and the role/org lookup.
 * Run with: pnpm auth:check   (start `pnpm dev` first; the seed must have run)
 *
 * Signs in as each of the 7 seeded users with the PUBLISHABLE key, calls
 * GET /api/me with `Authorization: Bearer <access token>`, and prints
 * user -> status / role / org. Also checks that no token and a garbage token
 * both give 401. Optional argument: base URL (default http://localhost:3000).
 * Tokens and the password are never printed.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

// Same files Next.js uses. Loaded before the app's env module is imported.
config({ path: ".env.local" });
config({ path: ".env" });

type Expected = {
  email: string;
  role: "manager" | "staff" | "tenant";
  org: "northwind" | "beta";
};

const EXPECTED: Expected[] = [
  { email: "manager@northwind.test", role: "manager", org: "northwind" },
  { email: "staff@northwind.test", role: "staff", org: "northwind" },
  { email: "aisyah@northwind.test", role: "tenant", org: "northwind" },
  { email: "ben@northwind.test", role: "tenant", org: "northwind" },
  { email: "probe@northwind.test", role: "tenant", org: "northwind" },
  { email: "manager@beta.test", role: "manager", org: "beta" },
  { email: "chen@beta.test", role: "tenant", org: "beta" },
];

type Me = { userId?: string; role?: string; orgId?: string };

async function callMe(baseUrl: string, authorization?: string) {
  const response = await fetch(`${baseUrl}/api/me`, {
    headers: authorization ? { Authorization: authorization } : {},
  });
  const body: unknown = await response.json().catch(() => null);
  return { status: response.status, body };
}

async function main(): Promise<void> {
  const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const { env } = await import("@/env");
  const password = env.SEED_PASSWORD;
  if (!password) throw new Error("SEED_PASSWORD is not set in .env.local");

  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let failures = 0;
  const report = (ok: boolean, line: string) => {
    if (!ok) failures += 1;
    console.log(`${ok ? "OK  " : "FAIL"} ${line}`);
  };

  const orgByLabel = new Map<string, Set<string>>();
  for (const expected of EXPECTED) {
    const { data, error } = await client.auth.signInWithPassword({
      email: expected.email,
      password,
    });
    if (error || !data.session) {
      report(false, `${expected.email} -> sign-in failed`);
      continue;
    }
    const { status, body } = await callMe(
      baseUrl,
      `Bearer ${data.session.access_token}`,
    );
    const me = (body ?? {}) as Me;
    const ok = status === 200 && me.role === expected.role && Boolean(me.orgId);
    report(
      ok,
      `${expected.email} -> ${status} role=${me.role ?? "-"} org=${me.orgId ?? "-"}`,
    );
    if (me.orgId) {
      const set = orgByLabel.get(expected.org) ?? new Set<string>();
      set.add(me.orgId);
      orgByLabel.set(expected.org, set);
    }
    await client.auth.signOut();
  }

  // Same organization for everyone in it, and the two organizations differ.
  const northwind = orgByLabel.get("northwind");
  const beta = orgByLabel.get("beta");
  report(
    northwind?.size === 1,
    "all Northwind users resolve to ONE organization",
  );
  report(beta?.size === 1, "all Beta users resolve to ONE organization");
  report(
    Boolean(northwind && beta && ![...northwind].some((id) => beta.has(id))),
    "Northwind and Beta are different organizations",
  );

  const noToken = await callMe(baseUrl);
  report(
    noToken.status === 401,
    `no token -> ${noToken.status} (expected 401)`,
  );
  const garbage = await callMe(baseUrl, "Bearer not-a-real-token");
  report(
    garbage.status === 401,
    `garbage token -> ${garbage.status} (expected 401)`,
  );
  const wrongScheme = await callMe(baseUrl, "Basic dXNlcjpwYXNz");
  report(
    wrongScheme.status === 401,
    `Basic scheme -> ${wrongScheme.status} (expected 401)`,
  );

  if (failures > 0) throw new Error(`${failures} check(s) failed`);
  console.log("auth check passed");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    message.includes("fetch failed")
      ? "Could not reach the app. Start it with `pnpm dev` and run again."
      : message,
  );
  process.exitCode = 1;
});
