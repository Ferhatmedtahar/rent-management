import { describe, expect, it } from "vitest";
import type { Actor } from "@/modules/auth";
import { HttpError } from "@/shared/lib/http-error";
import {
  LEASE,
  ORG_A,
  ORG_B,
  TENANT_ROW,
  TOTAL,
  setup,
  type FakePayment,
} from "./fake-store";
import { recordPayment } from "./payment.service";
import { approvePayment, rejectPayment, voidPayment } from "./review.service";

const manager: Actor = {
  userId: "00000000-0000-4000-8000-0000000000a1",
  orgId: ORG_A,
  role: "manager",
};
const staff: Actor = {
  userId: "00000000-0000-4000-8000-0000000000a2",
  orgId: ORG_A,
  role: "staff",
};
const ownTenant: Actor = {
  userId: "00000000-0000-4000-8000-0000000000a3",
  orgId: ORG_A,
  role: "tenant",
  tenantId: TENANT_ROW,
};
const otherTenant: Actor = {
  ...ownTenant,
  tenantId: "dddddddd-0000-4000-8000-000000000099",
};
const otherOrgManager: Actor = { ...manager, orgId: ORG_B };

const PAY = "ffffffff-0000-4000-8000-000000000001";
const PAY2 = "ffffffff-0000-4000-8000-000000000002";
const ONLINE = "ffffffff-0000-4000-8000-000000000003";

const row = (
  id: string,
  amountSen: number,
  status: FakePayment["status"],
  extra: Partial<FakePayment> = {},
): FakePayment => ({
  id,
  orgId: ORG_A,
  leaseId: LEASE,
  amountSen,
  unappliedSen: 0,
  method: "cash",
  status,
  receivedAt: new Date("2026-03-01T00:00:00Z"),
  slipPath: null,
  recordedBy: staff.userId,
  reviewedBy: status === "pending_verification" ? null : manager.userId,
  reviewedAt: status === "pending_verification" ? null : new Date(),
  ...extra,
});

const pending = (amount = 200000) =>
  setup({ seedPayments: [row(PAY, amount, "pending_verification")] });
const REASON = { reason: "Slip does not match" };

async function statusOf(promise: Promise<unknown>) {
  try {
    await promise;
    return "ok";
  } catch (error) {
    if (error instanceof HttpError) return error.status;
    throw error;
  }
}

describe("roles and visibility (every action)", () => {
  const actions: [
    string,
    (
      d: ReturnType<typeof setup>["deps"],
      a: Actor,
      id: string,
    ) => Promise<unknown>,
  ][] = [
    ["approve", (d, a, id) => approvePayment(d, a, id)],
    ["reject", (d, a, id) => rejectPayment(d, a, id, REASON)],
    ["void", (d, a, id) => voidPayment(d, a, id, REASON)],
  ];
  describe.each(actions)("%s", (_name, run) => {
    it("staff -> 403", async () => {
      const { deps, db } = pending();
      expect(await statusOf(run(deps, staff, PAY))).toBe(403);
      expect(db.payments[0]?.status).toBe("pending_verification");
      expect(db.audits).toHaveLength(0);
    });
    it("a tenant who owns the lease -> 403", async () => {
      const { deps } = pending();
      expect(await statusOf(run(deps, ownTenant, PAY))).toBe(403);
    });
    it("a tenant who does not own it -> 404 (not 403)", async () => {
      const { deps } = pending();
      expect(await statusOf(run(deps, otherTenant, PAY))).toBe(404);
    });
    it("another organization's manager -> 404", async () => {
      const { deps } = pending();
      expect(await statusOf(run(deps, otherOrgManager, PAY))).toBe(404);
    });
    it("unknown and malformed payment ids -> 404", async () => {
      const { deps } = pending();
      expect(await statusOf(run(deps, manager, PAY2))).toBe(404);
      expect(await statusOf(run(deps, manager, "nope"))).toBe(404);
    });
    it("an invalid body from someone who cannot see it is still 404/403, never 400", async () => {
      const { deps } = pending();
      expect(
        await statusOf(rejectPayment(deps, otherOrgManager, PAY, undefined)),
      ).toBe(404);
      expect(await statusOf(voidPayment(deps, staff, PAY, undefined))).toBe(
        403,
      );
    });
  });
});

describe("approvePayment", () => {
  it("approves, sets the reviewer, allocates (deposit first) and audits", async () => {
    const { deps, db } = pending(200000);
    expect(await approvePayment(deps, manager, PAY)).toEqual({
      status: "approved",
    });
    expect(db.payments[0]).toMatchObject({
      status: "approved",
      reviewedBy: manager.userId,
    });
    expect(db.payments[0]?.reviewedAt).toBeInstanceOf(Date);
    expect(db.allocations.map((a) => [a.invoiceId, a.amountSen])).toEqual([
      ["DEP", 200000],
    ]);
    expect(db.audits).toHaveLength(1);
    expect(db.audits[0]).toMatchObject({
      action: "payment.approved",
      entityId: PAY,
      actorId: manager.userId,
      orgId: ORG_A,
    });
  });

  it("the brief's flow: cash 300000, then staff bank transfer 200000 approved -> DEP, P0, P1", async () => {
    const { deps, db } = setup();
    await recordPayment(deps, manager, LEASE, {
      amountSen: 300000,
      method: "cash",
      receivedAt: "2026-01-31T10:00:00+08:00",
    });
    const staffPayment = await recordPayment(deps, staff, LEASE, {
      amountSen: 200000,
      method: "bank_transfer",
      receivedAt: "2026-03-01T00:30:00+08:00",
      slipPath: `${ORG_A}/slip.pdf`,
    });
    expect(staffPayment.status).toBe("pending_verification");
    await approvePayment(deps, manager, staffPayment.id);
    expect(db.allocations.map((a) => [a.invoiceId, a.amountSen])).toEqual([
      ["DEP", 300000],
      ["P0", 150000],
      ["P1", 50000],
    ]);
    expect(db.audits.map((a) => a.action)).toEqual([
      "payment.approved",
      "payment.approved",
    ]);
    expect(db.payments.every((p) => p.unappliedSen === 0)).toBe(true);
  });

  it("amount over the remaining balance -> 422, stays pending, nothing written", async () => {
    const { deps, db } = setup({
      seedPayments: [row(PAY, TOTAL + 1, "pending_verification")],
    });
    expect(await statusOf(approvePayment(deps, manager, PAY))).toBe(422);
    expect(db.payments[0]?.status).toBe("pending_verification");
    expect(db.allocations).toHaveLength(0);
    expect(db.audits).toHaveLength(0);
  });

  it("amount == remaining balance is approved (its own pending amount is not subtracted)", async () => {
    const { deps } = setup({
      seedPayments: [row(PAY, TOTAL, "pending_verification")],
    });
    expect(await statusOf(approvePayment(deps, manager, PAY))).toBe("ok");
  });

  it("other pending payments do not block an approval", async () => {
    const { deps } = setup({
      seedPayments: [
        row(PAY, 600000, "pending_verification"),
        row(PAY2, 600000, "pending_verification"),
      ],
    });
    expect(await statusOf(approvePayment(deps, manager, PAY))).toBe("ok");
    // 1,127,419 - 600,000 = 527,419 left; the second 600,000 no longer fits.
    expect(await statusOf(approvePayment(deps, manager, PAY2))).toBe(422);
  });

  it("approving twice -> the second is 409 and allocates nothing more", async () => {
    const { deps, db } = pending();
    await approvePayment(deps, manager, PAY);
    expect(await statusOf(approvePayment(deps, manager, PAY))).toBe(409);
    expect(db.allocations).toHaveLength(1);
    expect(db.audits).toHaveLength(1);
  });

  it("two simultaneous approvals: exactly one 200, one 409, allocated once", async () => {
    const { deps, db } = pending(200000);
    const results = await Promise.all([
      approvePayment(deps, manager, PAY).then(
        () => 200,
        (e: HttpError) => e.status,
      ),
      approvePayment(deps, manager, PAY).then(
        () => 200,
        (e: HttpError) => e.status,
      ),
    ]);
    expect(results.sort()).toEqual([200, 409]);
    expect(db.allocations.reduce((s, a) => s + a.amountSen, 0)).toBe(200000);
    expect(db.audits).toHaveLength(1);
  });

  it.each([["approved"], ["rejected"], ["voided"]] as const)(
    "a %s payment -> 409",
    async (status) => {
      const { deps } = setup({ seedPayments: [row(PAY, 1000, status)] });
      expect(await statusOf(approvePayment(deps, manager, PAY))).toBe(409);
    },
  );

  it("takes the lease lock before reading the payment", async () => {
    const { deps, calls } = pending();
    await approvePayment(deps, manager, PAY);
    expect(calls.order.indexOf("lock")).toBeLessThan(
      calls.order.indexOf("getPayment"),
    );
  });

  it("a failing step rolls everything back", async () => {
    const { deps, db } = setup({
      seedPayments: [row(PAY, 1000, "pending_verification")],
      failAt: "audit",
    });
    await expect(approvePayment(deps, manager, PAY)).rejects.toThrow(
      "boom audit",
    );
    expect(db.payments[0]?.status).toBe("pending_verification");
    expect(db.allocations).toHaveLength(0);
  });
});

describe("rejectPayment", () => {
  it("rejects with the reason, reviewer and audit; no allocation", async () => {
    const { deps, db } = pending();
    expect(
      await rejectPayment(deps, manager, PAY, { reason: "  Slip is blurry  " }),
    ).toEqual({ status: "rejected" });
    expect(db.payments[0]).toMatchObject({
      status: "rejected",
      reviewedBy: manager.userId,
      rejectReason: "Slip is blurry",
    });
    expect(db.allocations).toHaveLength(0);
    expect(db.audits[0]).toMatchObject({
      action: "payment.rejected",
      details: expect.objectContaining({
        reason: "Slip is blurry",
        status: "rejected",
      }),
    });
  });

  it.each([
    ["missing", undefined],
    ["not an object", "x"],
    ["empty", { reason: "" }],
    ["4 chars", { reason: "abcd" }],
    ["5 spaces", { reason: "     " }],
    ["4 chars padded", { reason: "  abcd  " }],
    ["not a string", { reason: 12345 }],
  ])("reason %s -> 400, still pending", async (_n, body) => {
    const { deps, db } = pending();
    expect(await statusOf(rejectPayment(deps, manager, PAY, body))).toBe(400);
    expect(db.payments[0]?.status).toBe("pending_verification");
  });

  it("exactly 5 characters is enough", async () => {
    const { deps } = pending();
    expect(
      await statusOf(rejectPayment(deps, manager, PAY, { reason: "abcde" })),
    ).toBe("ok");
  });

  it.each([["approved"], ["rejected"], ["voided"]] as const)(
    "a %s payment -> 409",
    async (status) => {
      const { deps } = setup({ seedPayments: [row(PAY, 1000, status)] });
      expect(await statusOf(rejectPayment(deps, manager, PAY, REASON))).toBe(
        409,
      );
    },
  );

  it("rejecting twice -> 409", async () => {
    const { deps } = pending();
    await rejectPayment(deps, manager, PAY, REASON);
    expect(await statusOf(rejectPayment(deps, manager, PAY, REASON))).toBe(409);
  });
});

describe("voidPayment", () => {
  const twoApproved = async () => {
    const s = setup();
    const a = await recordPayment(s.deps, manager, LEASE, {
      amountSen: 300000,
      method: "cash",
      receivedAt: "2026-01-31T10:00:00+08:00",
    });
    const b = await recordPayment(s.deps, manager, LEASE, {
      amountSen: 200000,
      method: "cash",
      receivedAt: "2026-03-01T10:00:00+08:00",
    });
    return { ...s, a: a.id, b: b.id };
  };

  it("voids an approved payment, sets voided_*, zero unapplied, and audits with a snapshot", async () => {
    const { deps, db, b } = await twoApproved();
    expect(
      await voidPayment(deps, manager, b, { reason: "Entered twice" }),
    ).toEqual({ status: "voided" });
    expect(db.payments.find((p) => p.id === b)).toMatchObject({
      status: "voided",
      voidedBy: manager.userId,
      voidReason: "Entered twice",
      unappliedSen: 0,
    });
    const audit = db.audits.at(-1);
    expect(audit).toMatchObject({ action: "payment.voided", entityId: b });
    expect(audit?.details).toMatchObject({
      reason: "Entered twice",
      previousUnappliedSen: 0,
      removedAllocations: [
        { invoiceId: "P0", amountSen: 150000 },
        { invoiceId: "P1", amountSen: 50000 },
      ],
    });
  });

  it("removes ONLY this payment's allocations; the other payment's rows survive", async () => {
    const { deps, db, a, b } = await twoApproved();
    await voidPayment(deps, manager, b, REASON);
    expect(db.allocations.every((x) => x.paymentId === a)).toBe(true);
    expect(db.allocations.map((x) => [x.invoiceId, x.amountSen])).toEqual([
      ["DEP", 300000],
    ]);
  });

  it("a void reopens invoices, and a new payment allocates into them", async () => {
    const { deps, db, b } = await twoApproved();
    await voidPayment(deps, manager, b, REASON);
    const again = await recordPayment(deps, manager, LEASE, {
      amountSen: 100000,
      method: "cash",
      receivedAt: "2026-04-01T10:00:00+08:00",
    });
    expect(
      db.allocations
        .filter((x) => x.paymentId === again.id)
        .map((x) => [x.invoiceId, x.amountSen]),
    ).toEqual([["P0", 100000]]);
  });

  it("voiding frees the cap again", async () => {
    const { deps, b } = await twoApproved();
    expect(
      await statusOf(
        recordPayment(deps, manager, LEASE, {
          amountSen: TOTAL - 500000 + 1,
          method: "cash",
          receivedAt: "2026-04-01T10:00:00+08:00",
        }),
      ),
    ).toBe(422);
    await voidPayment(deps, manager, b, REASON);
    expect(
      await statusOf(
        recordPayment(deps, manager, LEASE, {
          amountSen: TOTAL - 300000,
          method: "cash",
          receivedAt: "2026-04-01T10:00:00+08:00",
        }),
      ),
    ).toBe("ok");
  });

  it("an online payment with unapplied credit: its credit goes to 0 on that payment, is kept in the audit, others untouched", async () => {
    const online = row(ONLINE, 1_200_000, "approved", {
      method: "online",
      unappliedSen: 122_581,
      recordedBy: null as unknown as string,
      reviewedBy: null as unknown as string,
    });
    const other = row(PAY2, 50000, "approved", { unappliedSen: 0 });
    const { deps, db } = setup({
      seedPayments: [online, other],
      seedAllocations: [
        { paymentId: ONLINE, invoiceId: "DEP", amountSen: 300000 },
        { paymentId: ONLINE, invoiceId: "P0", amountSen: 150000 },
        { paymentId: ONLINE, invoiceId: "P1", amountSen: 150000 },
        { paymentId: ONLINE, invoiceId: "P2", amountSen: 150000 },
        { paymentId: ONLINE, invoiceId: "P3", amountSen: 150000 },
        { paymentId: ONLINE, invoiceId: "P4", amountSen: 150000 },
        { paymentId: ONLINE, invoiceId: "P5", amountSen: 27419 },
        { paymentId: PAY2, invoiceId: "P5", amountSen: 50000 },
      ],
    });
    await voidPayment(deps, manager, ONLINE, REASON);
    expect(db.payments.find((p) => p.id === ONLINE)).toMatchObject({
      status: "voided",
      unappliedSen: 0,
    });
    expect(db.audits[0]?.details).toMatchObject({
      previousUnappliedSen: 122_581,
    });
    expect(db.payments.find((p) => p.id === PAY2)?.unappliedSen).toBe(0);
    expect(db.allocations.filter((x) => x.paymentId === PAY2)).toHaveLength(1);
    expect(db.allocations.some((x) => x.paymentId === ONLINE)).toBe(false);
  });

  it.each([["pending_verification"], ["rejected"], ["voided"]] as const)(
    "a %s payment -> 409",
    async (status) => {
      const { deps } = setup({ seedPayments: [row(PAY, 1000, status)] });
      expect(await statusOf(voidPayment(deps, manager, PAY, REASON))).toBe(409);
    },
  );

  it.each([
    ["missing", undefined],
    ["4 chars", { reason: "abcd" }],
    ["blank", { reason: "      " }],
  ])("reason %s -> 400, still approved", async (_n, body) => {
    const { deps, db } = await twoApproved();
    expect(
      await statusOf(voidPayment(deps, manager, db.payments[0]!.id, body)),
    ).toBe(400);
    expect(db.payments[0]?.status).toBe("approved");
    expect(db.allocations.length).toBeGreaterThan(0);
  });

  it("voiding twice -> second is 409", async () => {
    const { deps, b } = await twoApproved();
    await voidPayment(deps, manager, b, REASON);
    expect(await statusOf(voidPayment(deps, manager, b, REASON))).toBe(409);
  });

  it("nothing is written when a step fails", async () => {
    const { deps, db } = setup({
      seedPayments: [row(PAY, 1000, "approved")],
      seedAllocations: [{ paymentId: PAY, invoiceId: "DEP", amountSen: 1000 }],
      failAt: "audit",
    });
    await expect(voidPayment(deps, manager, PAY, REASON)).rejects.toThrow(
      "boom audit",
    );
    expect(db.payments[0]?.status).toBe("approved");
    expect(db.allocations).toHaveLength(1);
  });
});
