/**
 * Checks for GET /api/leases and GET /api/reports/overdue. Writes NO data.
 * Run with: pnpm ui-reads:check   (start `pnpm dev` first)
 * Optional argument: base URL (default http://localhost:3000).
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

type LeaseRow = {
  id: string;
  unitName: string;
  tenantName: string;
  startDate: string;
  endDate: string;
  monthlyRentSen: number;
  depositSen: number;
};

type OverdueBody = {
  overdueCount: number;
};

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

  const get = async (path: string, email: string | null) => {
    const headers: Record<string, string> = {};
    if (email) headers.authorization = `Bearer ${await tokenFor(email)}`;
    const response = await fetch(`${baseUrl}${path}`, { headers });
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

  console.log("--- Checking GET /api/leases ---");
  expectStatus("no token -> 401", (await get("/api/leases", null)).status, 401);
  expectStatus(
    "tenant -> 403",
    (await get("/api/leases", "aisyah@northwind.test")).status,
    403,
  );
  expectStatus(
    "staff -> 200",
    (await get("/api/leases", "staff@northwind.test")).status,
    200,
  );

  const nwLeasesRes = await get("/api/leases", "manager@northwind.test");
  expectStatus("Northwind manager -> 200", nwLeasesRes.status, 200);
  const nwLeases = (
    Array.isArray(nwLeasesRes.body) ? nwLeasesRes.body : []
  ) as LeaseRow[];

  check(
    nwLeases.length >= 3,
    `Northwind has ${nwLeases.length} lease(s) (expected at least 3 seeded)`,
  );

  const nwUnitNames = nwLeases.map((l) => l.unitName);
  const hasExpectedUnits = ["A-12-3", "B-05-1", "C-01-7"].every((name) =>
    nwUnitNames.includes(name),
  );
  check(
    hasExpectedUnits,
    `Northwind leases contain seeded units A-12-3, B-05-1, C-01-7: [${nwUnitNames.join(", ")}]`,
  );

  const sample = nwLeases[0];
  const fieldsValid =
    Boolean(sample) &&
    typeof sample?.id === "string" &&
    typeof sample?.unitName === "string" &&
    typeof sample?.tenantName === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(sample?.startDate ?? "") &&
    /^\d{4}-\d{2}-\d{2}$/.test(sample?.endDate ?? "") &&
    typeof sample?.monthlyRentSen === "number" &&
    typeof sample?.depositSen === "number";
  check(fieldsValid, "Lease rows have valid field shapes, dates, and amounts");

  const betaLeasesRes = await get("/api/leases", "manager@beta.test");
  expectStatus("Beta manager -> 200", betaLeasesRes.status, 200);
  const betaLeases = (
    Array.isArray(betaLeasesRes.body) ? betaLeasesRes.body : []
  ) as LeaseRow[];
  check(
    betaLeases.length === 1 && betaLeases[0]?.unitName === "KL-1",
    `Beta manager sees only KL-1: [${betaLeases.map((l) => l.unitName).join(", ")}]`,
  );

  console.log("--- Checking GET /api/reports/overdue ---");
  expectStatus(
    "no token -> 401",
    (await get("/api/reports/overdue", null)).status,
    401,
  );
  expectStatus(
    "tenant -> 403",
    (await get("/api/reports/overdue", "aisyah@northwind.test")).status,
    403,
  );
  expectStatus(
    "staff -> 200",
    (await get("/api/reports/overdue", "staff@northwind.test")).status,
    200,
  );

  const nwOverdueRes = await get(
    "/api/reports/overdue",
    "manager@northwind.test",
  );
  expectStatus("Northwind manager -> 200", nwOverdueRes.status, 200);
  const nwOverdue = nwOverdueRes.body as OverdueBody | null;
  const nwCountValid =
    typeof nwOverdue?.overdueCount === "number" &&
    Number.isInteger(nwOverdue.overdueCount) &&
    nwOverdue.overdueCount >= 0;
  check(
    nwCountValid,
    `Northwind overdue count is non-negative integer: ${nwOverdue?.overdueCount}`,
  );
  console.log("Northwind overdue invoices count:", nwOverdue?.overdueCount);

  const betaOverdueRes = await get("/api/reports/overdue", "manager@beta.test");
  expectStatus("Beta manager -> 200", betaOverdueRes.status, 200);
  const betaOverdue = betaOverdueRes.body as OverdueBody | null;
  const betaCountValid =
    typeof betaOverdue?.overdueCount === "number" &&
    Number.isInteger(betaOverdue.overdueCount) &&
    betaOverdue.overdueCount >= 0;
  check(
    betaCountValid,
    `Beta overdue count is non-negative integer: ${betaOverdue?.overdueCount}`,
  );
  console.log("Beta overdue invoices count:", betaOverdue?.overdueCount);

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("\nAll UI read endpoint checks passed.");
  }
}

main().catch((err) => {
  console.error("ui-reads:check failed:", err);
  process.exitCode = 1;
});
