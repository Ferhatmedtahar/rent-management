/**
 * HTTP checks for POST /api/leases. Creates NO data: every request is rejected.
 * Run with: pnpm leases:check   (start `pnpm dev` first; the seed must have run)
 * Optional argument: base URL (default http://localhost:3000).
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const BASE_DEFAULT = "http://localhost:3000";

async function main(): Promise<void> {
  const baseUrl = (process.argv[2] ?? BASE_DEFAULT).replace(/\/$/, "");
  const { env } = await import("@/env");
  const { prisma } = await import("@/shared/db/prisma");
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

  try {
    const idOf = async (
      kind: "unit" | "tenant",
      name: string,
    ): Promise<string> =>
      kind === "unit"
        ? (await prisma.unit.findFirstOrThrow({ where: { name } })).id
        : (await prisma.tenant.findFirstOrThrow({ where: { fullName: name } }))
            .id;

    const unitA = await idOf("unit", "A-12-3");
    const unitFree = await idOf("unit", "D-03-2");
    const unitBeta = await idOf("unit", "KL-1");
    const tenantAisyah = await idOf("tenant", "Aisyah Rahman");
    const tenantChen = await idOf("tenant", "Chen Wei");

    const base = {
      unitId: unitFree,
      tenantId: tenantAisyah,
      startDate: "2027-01-01",
      endDate: "2027-06-30",
      monthlyRentSen: 100000,
      depositSen: 0,
    };
    let failures = 0;
    const check = async (
      label: string,
      expected: number,
      email: string | null,
      body: unknown,
    ) => {
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      if (email) headers.authorization = `Bearer ${await tokenFor(email)}`;
      const response = await fetch(`${baseUrl}/api/leases`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const text = await response.text();
      const ok = response.status === expected;
      if (!ok) failures += 1;
      console.log(
        `${ok ? "OK  " : "FAIL"} ${label}: ${response.status} (expected ${expected}) ${ok ? "" : text.slice(0, 120)}`,
      );
    };

    await check("no token", 401, null, base);
    await check("staff", 403, "staff@northwind.test", base);
    await check("tenant", 403, "aisyah@northwind.test", base);
    await check("Beta manager, Northwind unit", 404, "manager@beta.test", {
      ...base,
      tenantId: tenantChen,
      unitId: unitFree,
    });
    await check(
      "Northwind manager, Beta tenant",
      404,
      "manager@northwind.test",
      { ...base, tenantId: tenantChen },
    );
    await check("Northwind manager, Beta unit", 404, "manager@northwind.test", {
      ...base,
      unitId: unitBeta,
    });
    await check("overlap on A-12-3", 409, "manager@northwind.test", {
      ...base,
      unitId: unitA,
      startDate: "2026-06-01",
      endDate: "2026-12-31",
    });
    await check("impossible date", 400, "manager@northwind.test", {
      ...base,
      startDate: "2026-02-30",
    });
    await check("end before start", 400, "manager@northwind.test", {
      ...base,
      startDate: "2027-02-01",
      endDate: "2027-01-01",
    });
    await check("rent 0", 400, "manager@northwind.test", {
      ...base,
      monthlyRentSen: 0,
    });
    await check("longer than 120 months", 400, "manager@northwind.test", {
      ...base,
      endDate: "2040-01-01",
    });

    const leases = await prisma.lease.count();
    console.log(
      `leases in the database: ${leases} (should be unchanged, 4 after the seed)`,
    );
    if (failures > 0) throw new Error(`${failures} check(s) failed`);
    console.log("leases check passed");
  } finally {
    await prisma.$disconnect();
  }
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
