/**
 * Checks for GET /api/reports/collections. Writes NO data.
 * Run with: pnpm reports:check   (start `pnpm dev` first)
 * Optional argument: base URL (default http://localhost:3000).
 *
 * The exact numbers [300000, 0, 200000] only hold on a FRESHLY SEEDED database
 * (`npx supabase db reset && pnpm seed`). If other scripts (payments:check,
 * webhook:check) ran since, the numbers can differ; the script then prints
 * them and tells you to reset and seed.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

type Row = { month: string; collectedSen: number };

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
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  const tokens = new Map<string, string>();
  const tokenFor = async (email: string): Promise<string> => {
    const cached = tokens.get(email);
    if (cached) return cached;
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.session) throw new Error(`sign-in failed for ${email}`);
    tokens.set(email, data.session.access_token);
    return data.session.access_token;
  };
  const get = async (query: string, email: string | null) => {
    const headers: Record<string, string> = {};
    if (email) headers.authorization = `Bearer ${await tokenFor(email)}`;
    const response = await fetch(`${baseUrl}/api/reports/collections${query}`, {
      headers,
    });
    return {
      status: response.status,
      body: (await response.json().catch(() => null)) as unknown,
    };
  };

  let failures = 0;
  const check = (ok: boolean, label: string) => {
    if (!ok) failures += 1;
    console.log(`${ok ? "OK  " : "FAIL"} ${label}`);
  };
  const expectStatus = (label: string, actual: number, expected: number) =>
    check(actual === expected, `${label}: ${actual} (expected ${expected})`);

  const range = "?from=2026-01&to=2026-03";

  expectStatus("no token", (await get(range, null)).status, 401);
  expectStatus(
    "tenant",
    (await get(range, "aisyah@northwind.test")).status,
    403,
  );
  expectStatus("staff", (await get(range, "staff@northwind.test")).status, 200);

  const manager = await get(range, "manager@northwind.test");
  expectStatus("Northwind manager", manager.status, 200);
  const rows = (Array.isArray(manager.body) ? manager.body : []) as Row[];
  const months = rows.map((r) => r.month).join(",");
  check(
    months === "2026-01,2026-02,2026-03",
    `one entry per month, in order: ${months}`,
  );
  const amounts = rows.map((r) => r.collectedSen);
  const seeded =
    JSON.stringify(amounts) === JSON.stringify([300000, 0, 200000]);
  if (seeded) {
    check(
      true,
      "Northwind 2026-01..03 = [300000, 0, 200000] (the March payment is Feb 28 in UTC, March in Malaysia)",
    );
  } else {
    console.log(
      `WARN Northwind numbers are [${amounts.join(", ")}], expected [300000, 0, 200000].`,
    );
    console.log(
      "     Run `npx supabase db reset && pnpm seed` first, then run this check again.",
    );
    failures += 1;
  }

  const beta = (await get(range, "manager@beta.test")).body as Row[] | null;
  check(
    Array.isArray(beta) &&
      beta.length === 3 &&
      beta.every((r) => r.collectedSen === 0),
    `Beta manager sees only Beta: [${(beta ?? []).map((r) => r.collectedSen).join(", ")}] (expected zeros)`,
  );

  const single = (
    await get("?from=2026-03&to=2026-03", "manager@northwind.test")
  ).body as Row[] | null;
  check(
    Array.isArray(single) &&
      single.length === 1 &&
      single[0]?.month === "2026-03",
    "from == to gives one entry",
  );
  const longRange = (
    await get("?from=2025-11&to=2026-02", "manager@northwind.test")
  ).body as Row[] | null;
  check(
    Array.isArray(longRange) &&
      longRange.map((r) => r.month).join() ===
        "2025-11,2025-12,2026-01,2026-02",
    "year rollover lists 2025-11..2026-02",
  );

  for (const [label, query] of [
    ["from after to", "?from=2026-03&to=2026-01"],
    ["month 13", "?from=2026-13&to=2026-14"],
    ["not a month", "?from=abc&to=def"],
    ["full dates", "?from=2026-01-01&to=2026-03-31"],
    ["61 months", "?from=2021-01&to=2026-01"],
    ["missing to", "?from=2026-01"],
    ["no params", ""],
    ["repeated from", "?from=2026-01&from=2026-02&to=2026-03"],
  ] as const) {
    expectStatus(
      `400: ${label}`,
      (await get(query, "manager@northwind.test")).status,
      400,
    );
  }
  expectStatus(
    "tenant with an invalid range is still 403",
    (await get("?from=bad&to=bad", "aisyah@northwind.test")).status,
    403,
  );

  if (failures > 0) throw new Error(`${failures} check(s) failed`);
  console.log("reports check passed");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    message.includes("fetch failed")
      ? "Could not reach the app. Start it with `pnpm dev`."
      : message,
  );
  process.exitCode = 1;
});
