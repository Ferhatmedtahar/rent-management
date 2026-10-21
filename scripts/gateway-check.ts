/**
 * HTTP checks for GET /api/leases/:leaseId and POST /api/leases/:leaseId/gateway-bills.
 * Run with: pnpm gateway:check   (start `pnpm dev` first; the seed must have run)
 * Optional argument: base URL (default http://localhost:3000).
 *
 * Creates NO data except ONE pending gateway bill for Aisyah. Bill ids are
 * secrets, so only a short prefix is printed.
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
  const call = async (
    method: "GET" | "POST",
    path: string,
    email: string | null,
  ) => {
    const headers: Record<string, string> = {};
    if (email) headers.authorization = `Bearer ${await tokenFor(email)}`;
    const response = await fetch(`${baseUrl}${path}`, { method, headers });
    return {
      status: response.status,
      body: (await response.json().catch(() => null)) as Record<
        string,
        unknown
      > | null,
    };
  };

  let failures = 0;
  const check = (ok: boolean, label: string) => {
    if (!ok) failures += 1;
    console.log(`${ok ? "OK  " : "FAIL"} ${label}`);
  };
  const expectStatus = (label: string, actual: number, expected: number) =>
    check(actual === expected, `${label}: ${actual} (expected ${expected})`);

  try {
    const lease = await prisma.lease.findFirstOrThrow({
      where: { tenant: { fullName: "Aisyah Rahman" } },
    });
    const getPath = `/api/leases/${lease.id}`;
    const billPath = `${getPath}/gateway-bills`;

    // --- GET /api/leases/:leaseId ---
    expectStatus(
      "GET no token",
      (await call("GET", getPath, null)).status,
      401,
    );
    expectStatus(
      "GET manager",
      (await call("GET", getPath, "manager@northwind.test")).status,
      200,
    );
    expectStatus(
      "GET staff",
      (await call("GET", getPath, "staff@northwind.test")).status,
      200,
    );
    const own = await call("GET", getPath, "aisyah@northwind.test");
    expectStatus("GET own tenant (Aisyah)", own.status, 200);
    expectStatus(
      "GET another tenant (Ben), 404 not 403",
      (await call("GET", getPath, "ben@northwind.test")).status,
      404,
    );
    expectStatus(
      "GET Beta manager",
      (await call("GET", getPath, "manager@beta.test")).status,
      404,
    );
    expectStatus(
      "GET unknown lease",
      (
        await call(
          "GET",
          "/api/leases/00000000-0000-4000-8000-000000000000",
          "manager@northwind.test",
        )
      ).status,
      404,
    );
    expectStatus(
      "GET malformed id",
      (await call("GET", "/api/leases/nope", "manager@northwind.test")).status,
      404,
    );

    const view = own.body as {
      lease?: Record<string, unknown>;
      invoices?: {
        kind: string;
        dueDate: string;
        paidSen: number;
        status: string;
        amountSen: number;
      }[];
      payments?: { receivedAt: string; status: string }[];
    } | null;
    check(
      Object.keys(view ?? {})
        .sort()
        .join() === "invoices,lease,payments",
      "GET body has exactly lease, invoices, payments",
    );
    check(
      view?.invoices?.length === 7,
      `GET has 7 invoices (got ${view?.invoices?.length})`,
    );
    const first = view?.invoices?.[0];
    check(
      first?.kind === "deposit" &&
        first.paidSen === 300000 &&
        first.status === "paid",
      "GET first invoice is the paid deposit",
    );
    const sorted = view?.invoices?.every(
      (inv, i, all) => i === 0 || all[i - 1]!.dueDate <= inv.dueDate,
    );
    check(sorted === true, "GET invoices are in due-date order");
    const march = view?.payments?.find((p) =>
      p.receivedAt.startsWith("2026-03-01T00:30:00"),
    );
    check(
      march?.receivedAt.endsWith("+08:00") === true,
      `GET bank transfer receivedAt is Malaysia time: ${march?.receivedAt}`,
    );

    // --- POST gateway-bills ---
    expectStatus(
      "bill: no token",
      (await call("POST", billPath, null)).status,
      401,
    );
    expectStatus(
      "bill: staff",
      (await call("POST", billPath, "staff@northwind.test")).status,
      403,
    );
    expectStatus(
      "bill: manager",
      (await call("POST", billPath, "manager@northwind.test")).status,
      403,
    );
    expectStatus(
      "bill: another tenant (Ben)",
      (await call("POST", billPath, "ben@northwind.test")).status,
      404,
    );
    expectStatus(
      "bill: Beta manager",
      (await call("POST", billPath, "manager@beta.test")).status,
      404,
    );
    expectStatus(
      "bill: Chen (other organization)",
      (await call("POST", billPath, "chen@beta.test")).status,
      404,
    );

    // Expected amount, computed independently: unpaid part of invoices due <= today in Malaysia.
    const today = new Date(Date.now() + 8 * 3_600_000)
      .toISOString()
      .slice(0, 10);
    const invoices = await prisma.invoice.findMany({
      where: { leaseId: lease.id },
    });
    const allocations = await prisma.paymentAllocation.groupBy({
      by: ["invoiceId"],
      where: { leaseId: lease.id },
      _sum: { amountSen: true },
    });
    const paid = new Map(
      allocations.map((a) => [a.invoiceId, a._sum.amountSen ?? BigInt(0)]),
    );
    let expected = BigInt(0);
    for (const inv of invoices) {
      const unpaid = inv.amountSen - (paid.get(inv.id) ?? BigInt(0));
      if (inv.dueDate.toISOString().slice(0, 10) <= today && unpaid > 0)
        expected += unpaid;
    }

    const bill = await call("POST", billPath, "aisyah@northwind.test");
    if (expected === BigInt(0)) {
      expectStatus("bill: Aisyah (nothing due today)", bill.status, 422);
    } else {
      expectStatus("bill: Aisyah", bill.status, 201);
      const billId = String(bill.body?.billId ?? "");
      check(
        /^bill_[A-Za-z0-9_-]{32,128}$/.test(billId),
        `bill id format ok (${billId.slice(0, 9)}...)`,
      );
      check(
        BigInt(Number(bill.body?.amountSen ?? -1)) === expected,
        `bill amount ${bill.body?.amountSen} sen equals the independent calculation ${expected}`,
      );
      const stored = await prisma.gatewayBill.findUnique({
        where: { id: billId },
      });
      check(
        stored?.status === "pending" && stored.leaseId === lease.id,
        "bill is stored as pending on Aisyah's lease",
      );
    }

    if (failures > 0) throw new Error(`${failures} check(s) failed`);
    console.log("gateway check passed");
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
