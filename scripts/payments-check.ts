/**
 * Checks for POST /api/leases/:leaseId/payments, including a REAL concurrency test.
 * Run with: pnpm payments:check   (start `pnpm dev` first; the seed must have run)
 * Optional argument: base URL (default http://localhost:3000).
 *
 * It CREATES DATA: two throwaway leases on unit D-03-2 (Probe tenant, a free
 * one-month window starting 2035+) with RM 1,000.00 of rent, and up to two
 * pending staff payments on it. Seeded leases are untouched, but run
 * `npx supabase db reset && pnpm seed` afterwards to get a pristine database.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main(): Promise<void> {
  const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
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
  const post = async (path: string, email: string | null, body: unknown) => {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (email) headers.authorization = `Bearer ${await tokenFor(email)}`;
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    return {
      status: response.status,
      body: (await response.json().catch(() => null)) as Record<
        string,
        unknown
      > | null,
    };
  };

  let failures = 0;
  const expectStatus = (label: string, actual: number, expected: number) => {
    const ok = actual === expected;
    if (!ok) failures += 1;
    console.log(
      `${ok ? "OK  " : "FAIL"} ${label}: ${actual} (expected ${expected})`,
    );
  };

  try {
    const aisyahLease = await prisma.lease.findFirstOrThrow({
      where: { tenant: { fullName: "Aisyah Rahman" } },
    });
    const cashBody = {
      amountSen: 100,
      method: "cash",
      receivedAt: "2026-03-01T00:30:00+08:00",
    };
    const aisyahPath = `/api/leases/${aisyahLease.id}/payments`;

    // --- Checks that create no data ---
    expectStatus(
      "no token",
      (await post(aisyahPath, null, cashBody)).status,
      401,
    );
    expectStatus(
      "tenant on own lease",
      (await post(aisyahPath, "aisyah@northwind.test", cashBody)).status,
      403,
    );
    expectStatus(
      "another tenant (Probe) on Aisyah's lease",
      (await post(aisyahPath, "probe@northwind.test", cashBody)).status,
      404,
    );
    expectStatus(
      "Beta manager on a Northwind lease",
      (await post(aisyahPath, "manager@beta.test", cashBody)).status,
      404,
    );
    expectStatus(
      "unknown lease",
      (
        await post(
          "/api/leases/00000000-0000-4000-8000-000000000000/payments",
          "manager@northwind.test",
          cashBody,
        )
      ).status,
      404,
    );
    expectStatus(
      "receivedAt without offset",
      (
        await post(aisyahPath, "staff@northwind.test", {
          ...cashBody,
          receivedAt: "2026-03-01T00:30:00",
        })
      ).status,
      400,
    );
    expectStatus(
      "cash with a slip",
      (
        await post(aisyahPath, "staff@northwind.test", {
          ...cashBody,
          slipPath: "x/y.pdf",
        })
      ).status,
      400,
    );
    expectStatus(
      "bank transfer without a slip",
      (
        await post(aisyahPath, "staff@northwind.test", {
          ...cashBody,
          method: "bank_transfer",
        })
      ).status,
      400,
    );
    expectStatus(
      "amount over the cap",
      (
        await post(aisyahPath, "staff@northwind.test", {
          ...cashBody,
          amountSen: 99_999_999,
        })
      ).status,
      422,
    );

    // --- Throwaway lease for the race: RM 1,000.00 total, no deposit ---
    const unit = await prisma.unit.findFirstOrThrow({
      where: { name: "D-03-2" },
    });
    const probe = await prisma.tenant.findFirstOrThrow({
      where: { fullName: "Probe Tenant" },
    });
    const existing = await prisma.lease.count({ where: { unitId: unit.id } });
    const year = 2035 + existing;
    const created = await post("/api/leases", "manager@northwind.test", {
      unitId: unit.id,
      tenantId: probe.id,
      startDate: `${year}-01-01`,
      endDate: `${year}-01-31`,
      monthlyRentSen: 100000,
      depositSen: 0,
    });
    expectStatus(
      `create throwaway lease ${year}-01 on D-03-2`,
      created.status,
      201,
    );
    const leaseId = String(created.body?.id ?? "");
    if (!leaseId) throw new Error("lease was not created");
    const racePath = `/api/leases/${leaseId}/payments`;
    const body = (amountSen: number) => ({
      amountSen,
      method: "cash",
      receivedAt: "2026-03-01T00:30:00+08:00",
    });

    const [first, second] = await Promise.all([
      post(racePath, "staff@northwind.test", body(80000)),
      post(racePath, "staff@northwind.test", body(70000)),
    ]);
    const statuses = [first.status, second.status].sort((a, b) => a - b);
    const oneEach = statuses[0] === 201 && statuses[1] === 422;
    if (!oneEach) failures += 1;
    console.log(
      `${oneEach ? "OK  " : "FAIL"} race RM 800 + RM 700 on RM 1,000: statuses ${statuses.join(" / ")} (expected 201 / 422)`,
    );

    const pending = await prisma.payment.aggregate({
      where: { leaseId, status: "pending_verification" },
      _sum: { amountSen: true },
      _count: true,
    });
    const sum = Number(pending._sum.amountSen ?? 0);
    const sane = pending._count === 1 && sum <= 100000;
    if (!sane) failures += 1;
    console.log(
      `${sane ? "OK  " : "FAIL"} database: ${pending._count} pending payment(s), total ${sum} sen (must be 1 and <= 100000)`,
    );

    // A manager payment for exactly what is left must still fit, one sen more must not.
    const left = 100000 - sum;
    expectStatus(
      "manager pays cap + 1",
      (await post(racePath, "manager@northwind.test", body(left + 1))).status,
      422,
    );
    expectStatus(
      "manager pays exactly the cap",
      (await post(racePath, "manager@northwind.test", body(left))).status,
      201,
    );

    // --- approve / reject / void: checks that change no data ---
    const aisyahPayment = await prisma.payment.findFirstOrThrow({
      where: { leaseId: aisyahLease.id, status: "approved" },
    });
    const act = (
      action: string,
      email: string | null,
      id: string,
      body: unknown = {},
    ) => post(`/api/payments/${id}/${action}`, email, body);
    const reason = { reason: "Checking the rules" };
    expectStatus(
      "approve: no token",
      (await act("approve", null, aisyahPayment.id)).status,
      401,
    );
    expectStatus(
      "approve: staff",
      (await act("approve", "staff@northwind.test", aisyahPayment.id)).status,
      403,
    );
    expectStatus(
      "approve: tenant who owns it",
      (await act("approve", "aisyah@northwind.test", aisyahPayment.id)).status,
      403,
    );
    expectStatus(
      "approve: another tenant (Probe)",
      (await act("approve", "probe@northwind.test", aisyahPayment.id)).status,
      404,
    );
    expectStatus(
      "approve: Beta manager",
      (await act("approve", "manager@beta.test", aisyahPayment.id)).status,
      404,
    );
    expectStatus(
      "approve: unknown payment",
      (
        await act(
          "approve",
          "manager@northwind.test",
          "00000000-0000-4000-8000-000000000000",
        )
      ).status,
      404,
    );
    expectStatus(
      "approve: malformed id",
      (await act("approve", "manager@northwind.test", "nope")).status,
      404,
    );
    expectStatus(
      "approve: already approved",
      (await act("approve", "manager@northwind.test", aisyahPayment.id)).status,
      409,
    );
    expectStatus(
      "reject: reason too short",
      (
        await act("reject", "manager@northwind.test", aisyahPayment.id, {
          reason: "no",
        })
      ).status,
      400,
    );
    expectStatus(
      "reject: approved payment",
      (await act("reject", "manager@northwind.test", aisyahPayment.id, reason))
        .status,
      409,
    );
    expectStatus(
      "void: staff",
      (await act("void", "staff@northwind.test", aisyahPayment.id, reason))
        .status,
      403,
    );
    expectStatus(
      "void: Beta manager",
      (await act("void", "manager@beta.test", aisyahPayment.id, reason)).status,
      404,
    );
    expectStatus(
      "void: reason too short",
      (
        await act("void", "manager@northwind.test", aisyahPayment.id, {
          reason: "   ",
        })
      ).status,
      400,
    );

    // --- Concurrent double approve of ONE pending payment (the race lease's cap is spent, so use a fresh one) ---
    const year2 = year + 1;
    const created2 = await post("/api/leases", "manager@northwind.test", {
      unitId: unit.id,
      tenantId: probe.id,
      startDate: `${year2}-01-01`,
      endDate: `${year2}-01-31`,
      monthlyRentSen: 100000,
      depositSen: 0,
    });
    expectStatus(
      `create second throwaway lease ${year2}-01`,
      created2.status,
      201,
    );
    const lease2 = String(created2.body?.id ?? "");
    const recorded = await post(
      `/api/leases/${lease2}/payments`,
      "staff@northwind.test",
      body(60000),
    );
    expectStatus("staff records a pending payment", recorded.status, 201);
    const paymentId = String(recorded.body?.id ?? "");
    const [a, b] = await Promise.all([
      act("approve", "manager@northwind.test", paymentId),
      act("approve", "manager@northwind.test", paymentId),
    ]);
    const approvals = [a.status, b.status].sort((x, y) => x - y);
    const oneApproval = approvals[0] === 200 && approvals[1] === 409;
    if (!oneApproval) failures += 1;
    console.log(
      `${oneApproval ? "OK  " : "FAIL"} double approve: statuses ${approvals.join(" / ")} (expected 200 / 409)`,
    );
    const allocated = await prisma.paymentAllocation.aggregate({
      where: { paymentId },
      _sum: { amountSen: true },
      _count: true,
    });
    const once =
      allocated._count === 1 && Number(allocated._sum.amountSen) === 60000;
    if (!once) failures += 1;
    console.log(
      `${once ? "OK  " : "FAIL"} allocated once: ${allocated._count} row(s), ${allocated._sum.amountSen} sen (expected 1 row, 60000)`,
    );

    // Void it again: allocation rows go, the payment stays as a voided record.
    expectStatus(
      "void the approved payment",
      (await act("void", "manager@northwind.test", paymentId, reason)).status,
      200,
    );
    expectStatus(
      "void it again",
      (await act("void", "manager@northwind.test", paymentId, reason)).status,
      409,
    );
    const rows = await prisma.paymentAllocation.count({ where: { paymentId } });
    const gone = rows === 0;
    if (!gone) failures += 1;
    console.log(
      `${gone ? "OK  " : "FAIL"} void removed the allocation rows: ${rows} left (expected 0)`,
    );

    if (failures > 0) throw new Error(`${failures} check(s) failed`);
    console.log(
      "payments check passed (now run `npx supabase db reset && pnpm seed` for a clean database)",
    );
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
