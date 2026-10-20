/**
 * End-to-end checks for POST /api/webhooks/gateway against a running app.
 * Run with: pnpm webhook:check   (start `pnpm dev` first; the seed must have run)
 * Optional argument: base URL (default http://localhost:3000).
 *
 * It CREATES DATA: a throwaway, PAST-dated 3-month lease on unit D-03-2 for the
 * Probe tenant (RM 1,000.00 a month, no deposit, so all of it is due now), one
 * gateway bill on it, and one online payment. Seeded leases are untouched. Run
 * `npx supabase db reset && pnpm seed` afterwards for a pristine database.
 * Secrets (the key, signatures, bill ids) are never printed in full.
 */
import { createHmac } from "node:crypto";
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
  const key = env.GATEWAY_X_SIGNATURE_KEY;

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
  const api = async (
    method: "GET" | "POST",
    path: string,
    email: string,
    body?: unknown,
  ) => {
    const headers: Record<string, string> = {
      authorization: `Bearer ${await tokenFor(email)}`,
    };
    if (body !== undefined) headers["content-type"] = "application/json";
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      body: (await response.json().catch(() => null)) as Record<
        string,
        unknown
      > | null,
    };
  };

  // Same algorithm as gateway-sim.mjs: sorted keys, key+value, joined with "|".
  const sign = (fields: Record<string, string>): string =>
    createHmac("sha256", key)
      .update(
        Object.keys(fields)
          .sort()
          .map((k) => `${k}${fields[k]}`)
          .join("|"),
      )
      .digest("hex");
  const callback = async (
    fields: Record<string, string>,
    signature: string | null = sign(fields),
  ) => {
    const form = new URLSearchParams(
      signature === null ? fields : { ...fields, x_signature: signature },
    );
    const response = await fetch(`${baseUrl}/api/webhooks/gateway`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form,
    });
    return response.status;
  };
  const myt = new Date(Date.now() + 8 * 3_600_000).toISOString();
  const fieldsFor = (
    billId: string,
    amountSen: number,
    paid = "true",
  ): Record<string, string> => ({
    id: billId,
    paid,
    paid_amount: paid === "true" ? String(amountSen) : "0",
    paid_at: `${myt.slice(0, 10)} ${myt.slice(11, 19)} +0800`,
    transaction_id: `TX-${Date.now()}`,
    transaction_status: paid === "true" ? "completed" : "failed",
  });

  let failures = 0;
  const check = (ok: boolean, label: string) => {
    if (!ok) failures += 1;
    console.log(`${ok ? "OK  " : "FAIL"} ${label}`);
  };
  const expectStatus = (label: string, actual: number, expected: number) =>
    check(actual === expected, `${label}: ${actual} (expected ${expected})`);

  try {
    // --- A past-dated throwaway lease: 3 months, RM 1,000.00 each, all due already ---
    const unit = await prisma.unit.findFirstOrThrow({
      where: { name: "D-03-2" },
    });
    const probe = await prisma.tenant.findFirstOrThrow({
      where: { fullName: "Probe Tenant" },
    });
    const year =
      2010 + (await prisma.lease.count({ where: { unitId: unit.id } }));
    const lease = await api("POST", "/api/leases", "manager@northwind.test", {
      unitId: unit.id,
      tenantId: probe.id,
      startDate: `${year}-01-01`,
      endDate: `${year}-03-31`,
      monthlyRentSen: 100000,
      depositSen: 0,
    });
    expectStatus(
      `create past-dated throwaway lease ${year}-01..03`,
      lease.status,
      201,
    );
    const leaseId = String(lease.body?.id ?? "");

    const bill = await api(
      "POST",
      `/api/leases/${leaseId}/gateway-bills`,
      "probe@northwind.test",
    );
    expectStatus("Probe creates a bill", bill.status, 201);
    const billId = String(bill.body?.billId ?? "");
    const amountSen = Number(bill.body?.amountSen ?? 0);
    check(
      amountSen === 300000,
      `bill amount ${amountSen} sen (expected 300000: three months due)`,
    );
    console.log(`     bill ${billId.slice(0, 9)}...`);

    // --- Rejections: nothing may change ---
    const good = fieldsFor(billId, amountSen);
    expectStatus("missing signature", await callback(good, null), 401);
    expectStatus("wrong signature", await callback(good, "0".repeat(64)), 401);
    expectStatus(
      "tampered amount (signed for another body)",
      await callback({ ...good, paid_amount: "1" }, sign(good)),
      401,
    );
    expectStatus(
      "unknown bill id (validly signed)",
      await callback(
        fieldsFor("bill_does_not_exist_xxxxxxxxxxxxxxxxxxxxxxxxx", amountSen),
      ),
      404,
    );
    expectStatus(
      "wrong amount (validly signed)",
      await callback(fieldsFor(billId, amountSen + 1)),
      422,
    );
    expectStatus(
      "unparseable paid_at (validly signed)",
      await callback(
        { ...good, paid_at: "not a date" },
        sign({ ...good, paid_at: "not a date" }),
      ),
      422,
    );
    const none = await prisma.payment.count({
      where: { gatewayBillId: billId },
    });
    check(
      none === 0,
      `no payment exists after the rejected callbacks (${none})`,
    );

    // --- Page endpoints before settlement ---
    const before = await api(
      "GET",
      `/api/gateway-bills/${billId}`,
      "probe@northwind.test",
    );
    check(
      before.status === 200 && before.body?.status === "pending",
      `bill reads as pending (${before.status} ${before.body?.status})`,
    );
    expectStatus(
      "another tenant reads the bill",
      (await api("GET", `/api/gateway-bills/${billId}`, "ben@northwind.test"))
        .status,
      404,
    );

    // --- A valid callback, then the SAME one five times at once ---
    expectStatus("valid callback", await callback(good), 200);
    const repeats = await Promise.all(
      Array.from({ length: 5 }, () => callback(good)),
    );
    check(
      repeats.every((s) => s === 200),
      `5 parallel repeats all 200 (${repeats.join(",")})`,
    );
    const withExtra = { ...good, future_field: "ignored" };
    expectStatus(
      "repeat carrying an extra field",
      await callback(withExtra),
      200,
    );

    const payments = await prisma.payment.findMany({
      where: { gatewayBillId: billId },
    });
    check(
      payments.length === 1,
      `exactly ONE payment for the bill (${payments.length})`,
    );
    const payment = payments[0];
    check(
      payment?.method === "online" &&
        payment.status === "approved" &&
        Number(payment.amountSen) === amountSen &&
        payment.recordedBy === null,
      "payment is online, approved, the bill's amount, no human recorder",
    );
    check(
      payment?.receivedAt.getTime() !== undefined &&
        Math.abs(payment.receivedAt.getTime() - Date.now()) < 120_000,
      "received_at is the callback's paid_at (about now)",
    );
    const allocations = payment
      ? await prisma.paymentAllocation.findMany({
          where: { paymentId: payment.id },
        })
      : [];
    const allocated = allocations.reduce(
      (sum, a) => sum + Number(a.amountSen),
      0,
    );
    check(
      allocations.length === 3 && allocated === amountSen,
      `one allocation set: ${allocations.length} rows, ${allocated} sen`,
    );
    check(Number(payment?.unappliedSen ?? -1) === 0, "unapplied_sen is 0");
    const audits = payment
      ? await prisma.auditLog.count({
          where: { entityId: payment.id, action: "payment.approved" },
        })
      : 0;
    check(audits === 1, `exactly one payment.approved audit row (${audits})`);

    // --- A paid bill never goes back ---
    expectStatus(
      "paid=false after paid",
      await callback(fieldsFor(billId, amountSen, "false")),
      200,
    );
    const stored = await prisma.gatewayBill.findUniqueOrThrow({
      where: { id: billId },
    });
    check(
      stored.status === "paid",
      `bill is still paid after paid=false (${stored.status})`,
    );
    check(
      (await prisma.payment.count({ where: { gatewayBillId: billId } })) === 1,
      "still exactly one payment",
    );

    // --- What the tenant sees ---
    const after = await api(
      "GET",
      `/api/gateway-bills/${billId}`,
      "probe@northwind.test",
    );
    check(
      after.body?.status === "paid",
      `bill reads as paid (${after.body?.status})`,
    );
    const view = await api(
      "GET",
      `/api/leases/${leaseId}`,
      "probe@northwind.test",
    );
    const data = view.body as {
      invoices?: { status: string; paidSen: number; amountSen: number }[];
      payments?: { method: string; status: string }[];
    } | null;
    check(view.status === 200, `tenant reads the lease (${view.status})`);
    check(
      data?.payments?.length === 1 &&
        data.payments[0]?.method === "online" &&
        data.payments[0].status === "approved",
      "lease shows one approved online payment",
    );
    check(
      data?.invoices?.length === 3 &&
        data.invoices.every(
          (i) => i.status === "paid" && i.paidSen === i.amountSen,
        ),
      "all three invoices are allocated and paid",
    );

    if (failures > 0) throw new Error(`${failures} check(s) failed`);
    console.log(
      "webhook check passed (now run `npx supabase db reset && pnpm seed` for a clean database)",
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
