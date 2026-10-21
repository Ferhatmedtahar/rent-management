import { describe, expect, it } from "vitest";
import type { Actor } from "@/modules/auth";
import { HttpError } from "@/shared/lib/http-error";
import { LEASE, ORG_A, ORG_B, TENANT_ROW, TOTAL, setup } from "./fake-store";
import { recordPayment } from "./payment.service";

const OTHER_LEASE = "cccccccc-0000-4000-8000-000000000002";

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

const FIRST_ID = "ffffffff-0000-4000-8000-000000000100";

const cash = (amountSen: number, extra: Record<string, unknown> = {}) => ({
  amountSen,
  method: "cash",
  receivedAt: "2026-01-31T10:00:00+08:00",
  ...extra,
});
const SLIP = `${ORG_A}/slips/a.pdf`;
const bank = (amountSen: number, slipPath: unknown = SLIP) => ({
  amountSen,
  method: "bank_transfer",
  receivedAt: "2026-03-01T00:30:00+08:00",
  slipPath,
});

async function statusOf(promise: Promise<unknown>) {
  try {
    await promise;
    return "ok";
  } catch (error) {
    if (error instanceof HttpError) return error.status;
    throw error;
  }
}

describe("recordPayment: roles and visibility", () => {
  it("manager: approved, allocated, audited, recorded_by and reviewed_by set", async () => {
    const { deps, db } = setup();
    expect(await recordPayment(deps, manager, LEASE, cash(300000))).toEqual({
      id: FIRST_ID,
      status: "approved",
    });
    expect(db.payments[0]).toMatchObject({
      status: "approved",
      recordedBy: manager.userId,
      reviewedBy: manager.userId,
      orgId: ORG_A,
      unappliedSen: 0,
    });
    expect(db.payments[0]?.reviewedAt).toBeInstanceOf(Date);
    expect(db.allocations).toEqual([
      { invoiceId: "DEP", amountSen: 300000, paymentId: FIRST_ID },
    ]);
    expect(db.audits).toHaveLength(1);
    expect(db.audits[0]).toMatchObject({
      action: "payment.approved",
      entityType: "payment",
      entityId: "ffffffff-0000-4000-8000-000000000100",
      actorId: manager.userId,
      orgId: ORG_A,
    });
  });

  it("the brief's two payments allocate to deposit, then P0 and P1", async () => {
    const { deps, db } = setup();
    await recordPayment(deps, manager, LEASE, cash(300000));
    await recordPayment(deps, manager, LEASE, bank(200000));
    expect(db.allocations.map((a) => [a.invoiceId, a.amountSen])).toEqual([
      ["DEP", 300000],
      ["P0", 150000],
      ["P1", 50000],
    ]);
  });

  it("staff: pending_verification, no allocation, no audit row, no reviewer", async () => {
    const { deps, db } = setup();
    expect(await recordPayment(deps, staff, LEASE, cash(1000))).toEqual({
      id: FIRST_ID,
      status: "pending_verification",
    });
    expect(db.payments[0]).toMatchObject({
      status: "pending_verification",
      recordedBy: staff.userId,
      reviewedBy: null,
      reviewedAt: null,
    });
    expect(db.allocations).toHaveLength(0);
    expect(db.audits).toHaveLength(0);
  });

  it("tenant who owns the lease: 403", async () => {
    const { deps, db } = setup();
    expect(
      await statusOf(recordPayment(deps, ownTenant, LEASE, cash(1000))),
    ).toBe(403);
    expect(db.payments).toHaveLength(0);
  });

  it("another tenant: 404, not 403 (existence is not revealed)", async () => {
    const { deps } = setup();
    expect(
      await statusOf(recordPayment(deps, otherTenant, LEASE, cash(1000))),
    ).toBe(404);
  });

  it("other-organization manager: 404", async () => {
    const { deps } = setup();
    expect(
      await statusOf(recordPayment(deps, otherOrgManager, LEASE, cash(1000))),
    ).toBe(404);
  });

  it("unknown lease and malformed lease id: 404", async () => {
    const { deps } = setup();
    expect(
      await statusOf(recordPayment(deps, manager, OTHER_LEASE, cash(1000))),
    ).toBe(404);
    expect(
      await statusOf(recordPayment(deps, manager, "not-a-uuid", cash(1000))),
    ).toBe(404);
  });

  it("an invalid body from a caller who cannot see the lease is still 404", async () => {
    const { deps } = setup();
    expect(
      await statusOf(recordPayment(deps, otherOrgManager, LEASE, undefined)),
    ).toBe(404);
  });
});

describe("recordPayment: the cap", () => {
  it("amount == remaining balance is accepted", async () => {
    const { deps } = setup();
    expect(
      await statusOf(recordPayment(deps, manager, LEASE, cash(TOTAL))),
    ).toBe("ok");
  });

  it("amount == cap + 1 is 422 and nothing is written", async () => {
    const { deps, db } = setup();
    expect(
      await statusOf(recordPayment(deps, manager, LEASE, cash(TOTAL + 1))),
    ).toBe(422);
    expect(db.payments).toHaveLength(0);
  });

  it("pending payments count against the cap", async () => {
    const { deps } = setup();
    await recordPayment(deps, staff, LEASE, cash(TOTAL - 1000)); // pending
    expect(
      await statusOf(recordPayment(deps, manager, LEASE, cash(1000))),
    ).toBe("ok");
    expect(await statusOf(recordPayment(deps, manager, LEASE, cash(1)))).toBe(
      422,
    );
  });

  it("approved allocations reduce the remaining balance", async () => {
    const { deps } = setup();
    await recordPayment(deps, manager, LEASE, cash(300000));
    expect(
      await statusOf(
        recordPayment(deps, manager, LEASE, cash(TOTAL - 300000 + 1)),
      ),
    ).toBe(422);
    expect(
      await statusOf(recordPayment(deps, manager, LEASE, cash(TOTAL - 300000))),
    ).toBe("ok");
  });

  it("takes the lease lock before reading the balance", async () => {
    const { deps, calls } = setup();
    await recordPayment(deps, manager, LEASE, cash(1000));
    expect(calls.order.slice(0, 2)).toEqual(["lock", "balance"]);
  });
});

describe("recordPayment: validation -> 400", () => {
  const bad: [string, unknown][] = [
    ["zero amount", cash(0)],
    ["negative amount", cash(-5)],
    ["fractional amount", cash(1.5)],
    ["amount above 1e12", cash(1_000_000_000_001)],
    ["string amount", cash("100" as unknown as number)],
    ["unknown method", { ...cash(100), method: "online" }],
    [
      "receivedAt without offset",
      cash(100, { receivedAt: "2026-03-01T00:30:00" }),
    ],
    ["receivedAt date only", cash(100, { receivedAt: "2026-03-01" })],
    [
      "receivedAt impossible date",
      cash(100, { receivedAt: "2026-02-30T10:00:00+08:00" }),
    ],
    ["receivedAt garbage", cash(100, { receivedAt: "yesterday" })],
    ["bank transfer without slip", { ...bank(100), slipPath: undefined }],
    ["cash with a slip", cash(100, { slipPath: SLIP })],
    ["non-object body", "x"],
    ["missing body", undefined],
  ];
  it.each(bad)("%s", async (_n, body) => {
    const { deps, db } = setup();
    expect(await statusOf(recordPayment(deps, manager, LEASE, body))).toBe(400);
    expect(db.payments).toHaveLength(0);
  });

  it("accepts Z and offset forms, and strips unknown keys", async () => {
    const { deps, db } = setup();
    await recordPayment(
      deps,
      manager,
      LEASE,
      cash(100, {
        receivedAt: "2026-01-31T02:00:00Z",
        orgId: ORG_B,
        status: "voided",
      }),
    );
    expect(db.payments[0]?.receivedAt.toISOString()).toBe(
      "2026-01-31T02:00:00.000Z",
    );
    expect(db.payments[0]).toMatchObject({ orgId: ORG_A, status: "approved" });
  });

  it("MYT receivedAt keeps the instant: 2026-03-01T00:30+08:00 is 2026-02-28T16:30Z", async () => {
    const { deps, db } = setup();
    await recordPayment(deps, manager, LEASE, bank(100));
    expect(db.payments[0]?.receivedAt.toISOString()).toBe(
      "2026-02-28T16:30:00.000Z",
    );
  });
});

describe("recordPayment: bank-transfer slip", () => {
  it.each([
    ["other org's folder", `${ORG_B}/a.pdf`],
    ["no folder", "a.pdf"],
    ["prefix only", `${ORG_A}/`],
    ["path traversal", `${ORG_A}/../${ORG_B}/a.pdf`],
    ["dot segment", `${ORG_A}/./a.pdf`],
    ["sibling prefix", `${ORG_A}x/a.pdf`],
  ])(
    "invalid slip path (%s) -> 400 and storage is not even asked",
    async (_n, path) => {
      const { deps, calls } = setup();
      expect(
        await statusOf(recordPayment(deps, manager, LEASE, bank(100, path))),
      ).toBe(400);
      expect(calls.exists).toHaveLength(0);
      expect(calls.removed).toHaveLength(0);
    },
  );

  it("a slip that does not exist in storage -> 400, nothing to clean up", async () => {
    const { deps, calls, db } = setup({ slipExists: false });
    expect(await statusOf(recordPayment(deps, manager, LEASE, bank(100)))).toBe(
      400,
    );
    expect(calls.exists).toEqual([SLIP]);
    expect(calls.removed).toHaveLength(0);
    expect(db.payments).toHaveLength(0);
  });

  it("success keeps the file and stores the slip path", async () => {
    const { deps, calls, db } = setup();
    await recordPayment(deps, manager, LEASE, bank(100));
    expect(db.payments[0]?.slipPath).toBe(SLIP);
    expect(calls.removed).toHaveLength(0);
  });

  it("cleanup: the file is removed when the cap check fails", async () => {
    const { deps, calls } = setup();
    expect(
      await statusOf(recordPayment(deps, manager, LEASE, bank(TOTAL + 1))),
    ).toBe(422);
    expect(calls.removed).toEqual([SLIP]);
  });

  it("cleanup: the file is removed when the database step fails, and the ORIGINAL error is rethrown", async () => {
    const { deps, calls, db } = setup({ failAt: "insert" });
    await expect(
      recordPayment(deps, manager, LEASE, bank(100)),
    ).rejects.toThrow("boom insert");
    expect(calls.removed).toEqual([SLIP]);
    expect(db.payments).toHaveLength(0);
  });

  it("cleanup: a late audit failure rolls everything back and removes the file", async () => {
    const { deps, calls, db } = setup({ failAt: "audit" });
    await expect(
      recordPayment(deps, manager, LEASE, bank(100)),
    ).rejects.toThrow("boom audit");
    expect(calls.removed).toEqual([SLIP]);
    expect(db.payments).toHaveLength(0);
    expect(db.allocations).toHaveLength(0);
  });

  it("cleanup never masks the original error, even if removing the file fails", async () => {
    const { deps } = setup({ failAt: "insert" });
    deps.slips.remove = async () => {
      throw new Error("storage down");
    };
    await expect(
      recordPayment(deps, manager, LEASE, bank(100)),
    ).rejects.toThrow("boom insert");
  });

  it("cleanup keeps a file that another payment already references", async () => {
    const { deps, calls } = setup({ failAt: "insert", slipReferenced: true });
    await expect(
      recordPayment(deps, manager, LEASE, bank(100)),
    ).rejects.toThrow("boom insert");
    expect(calls.removed).toHaveLength(0);
  });
});
