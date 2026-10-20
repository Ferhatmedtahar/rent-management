import { describe, expect, it } from "vitest";
import type { Actor } from "@/modules/auth";
import { HttpError } from "@/shared/lib/http-error";
import type { LeaseDetail, LeaseReadStore } from "../types/lease.types";
import { getLease } from "./lease-read.service";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const LEASE = "cccccccc-0000-4000-8000-000000000001";
const TENANT = "dddddddd-0000-4000-8000-000000000001";
const OTHER_TENANT = "dddddddd-0000-4000-8000-000000000002";

const manager: Actor = { userId: "u-m", orgId: ORG_A, role: "manager" };
const staff: Actor = { userId: "u-s", orgId: ORG_A, role: "staff" };
const owner: Actor = {
  userId: "u-t",
  orgId: ORG_A,
  role: "tenant",
  tenantId: TENANT,
};
const otherTenant: Actor = { ...owner, tenantId: OTHER_TENANT };
const otherOrg: Actor = { ...manager, orgId: ORG_B };

const inv = (
  id: string,
  kind: "deposit" | "rent",
  periodIndex: number | null,
  dueDate: string,
  amountSen: number,
  paidSen = 0,
) => ({
  id,
  kind,
  periodIndex,
  periodStart: kind === "rent" ? dueDate : null,
  periodEnd: kind === "rent" ? dueDate : null,
  dueDate,
  amountSen,
  paidSen,
});

const detail = (): LeaseDetail => ({
  lease: {
    id: LEASE,
    unitId: "u1",
    tenantId: TENANT,
    startDate: "2026-01-31",
    endDate: "2026-07-15",
    monthlyRentSen: 150000,
    depositSen: 300000,
  },
  // Deliberately NOT in allocation order.
  invoices: [
    inv("P1", "rent", 1, "2026-02-28", 150000, 50000),
    inv("P0", "rent", 0, "2026-01-31", 150000, 150000),
    inv("DEP", "deposit", null, "2026-01-31", 300000, 300000),
    inv("P2", "rent", 2, "2026-03-31", 150000),
  ],
  payments: [
    {
      id: "pay-2",
      amountSen: 200000,
      unappliedSen: 0,
      method: "bank_transfer",
      status: "approved",
      receivedAt: new Date("2026-02-28T16:30:00Z"),
    },
    {
      id: "pay-1",
      amountSen: 300000,
      unappliedSen: 0,
      method: "cash",
      status: "approved",
      receivedAt: new Date("2026-01-31T02:00:00Z"),
    },
  ],
});

/** Fake that applies the same scoping the real query does. */
const store: LeaseReadStore = {
  findLeaseDetail: async (leaseId, orgId, tenantId) => {
    if (leaseId !== LEASE || orgId !== ORG_A) return null;
    if (tenantId !== undefined && tenantId !== TENANT) return null;
    return detail();
  },
};

const NOW = new Date("2026-03-15T00:00:00Z");

async function statusOf(promise: Promise<unknown>) {
  try {
    await promise;
    return "ok";
  } catch (error) {
    if (error instanceof HttpError) return error.status;
    throw error;
  }
}

describe("getLease: who can see it", () => {
  it.each([
    ["manager", manager],
    ["staff", staff],
    ["the lease's own tenant", owner],
  ])("%s -> ok", async (_n, actor) => {
    expect(await statusOf(getLease(store, actor, LEASE, NOW))).toBe("ok");
  });
  it.each([
    ["another tenant", otherTenant],
    ["another organization", otherOrg],
  ])("%s -> 404, never 403", async (_n, actor) => {
    expect(await statusOf(getLease(store, actor, LEASE, NOW))).toBe(404);
  });
  it("a tenant actor without a tenant id -> 404", async () => {
    expect(
      await statusOf(
        getLease(store, { ...owner, tenantId: undefined }, LEASE, NOW),
      ),
    ).toBe(404);
  });
  it("unknown and malformed ids -> 404", async () => {
    expect(
      await statusOf(
        getLease(store, manager, "cccccccc-0000-4000-8000-000000000009", NOW),
      ),
    ).toBe(404);
    expect(await statusOf(getLease(store, manager, "nope", NOW))).toBe(404);
  });
});

describe("getLease: shape and ordering", () => {
  it("returns the lease unchanged", async () => {
    expect((await getLease(store, manager, LEASE, NOW)).lease).toEqual(
      detail().lease,
    );
  });

  it("orders invoices by due date, deposit before rent, then period index", async () => {
    const view = await getLease(store, manager, LEASE, NOW);
    expect(view.invoices.map((i) => i.id)).toEqual(["DEP", "P0", "P1", "P2"]);
  });

  it("orders equal due dates by period index", async () => {
    const s: LeaseReadStore = {
      findLeaseDetail: async () => ({
        ...detail(),
        invoices: [
          inv("B", "rent", 2, "2026-04-01", 1),
          inv("A", "rent", 1, "2026-04-01", 1),
          inv("D", "deposit", null, "2026-04-01", 1),
        ],
      }),
    };
    expect(
      (await getLease(s, manager, LEASE, NOW)).invoices.map((i) => i.id),
    ).toEqual(["D", "A", "B"]);
  });

  it("exposes exactly the documented invoice and payment keys", async () => {
    const view = await getLease(store, manager, LEASE, NOW);
    expect(Object.keys(view.invoices[0]!).sort()).toEqual([
      "amountSen",
      "dueDate",
      "id",
      "kind",
      "paidSen",
      "periodEnd",
      "periodIndex",
      "periodStart",
      "status",
    ]);
    expect(Object.keys(view.payments[0]!).sort()).toEqual([
      "amountSen",
      "id",
      "method",
      "receivedAt",
      "status",
      "unappliedSen",
    ]);
  });

  it("formats receivedAt as ISO 8601 with +08:00, whatever the server timezone", async () => {
    const view = await getLease(store, manager, LEASE, NOW);
    expect(view.payments.find((p) => p.id === "pay-2")?.receivedAt).toBe(
      "2026-03-01T00:30:00.000+08:00",
    );
    expect(view.payments.find((p) => p.id === "pay-1")?.receivedAt).toBe(
      "2026-01-31T10:00:00.000+08:00",
    );
  });

  it("keeps the payments in the order the store gave (received_at, id is the store's job)", async () => {
    const view = await getLease(store, manager, LEASE, NOW);
    expect(view.payments.map((p) => p.id)).toEqual(["pay-2", "pay-1"]);
  });
});

describe("getLease: invoice status with an injected clock", () => {
  const statusAt = async (iso: string) => {
    const view = await getLease(store, manager, LEASE, new Date(iso));
    return Object.fromEntries(view.invoices.map((i) => [i.id, i.status]));
  };

  it("paid, partially_paid(overdue wins), unpaid", async () => {
    // Mid-March: DEP and P0 paid; P1 (due 02-28, 50000/150000) is past due -> overdue; P2 due 03-31 -> unpaid.
    expect(await statusAt("2026-03-15T00:00:00Z")).toEqual({
      DEP: "paid",
      P0: "paid",
      P1: "overdue",
      P2: "unpaid",
    });
  });

  it("overdue boundary: P2 due 2026-03-31 is unpaid at 15:59:59Z and overdue at 16:00:00Z", async () => {
    expect((await statusAt("2026-03-31T15:59:59Z")).P2).toBe("unpaid");
    expect((await statusAt("2026-03-31T16:00:00Z")).P2).toBe("overdue");
  });

  it("a partly paid invoice that is not yet due is partially_paid", async () => {
    expect((await statusAt("2026-02-27T00:00:00Z")).P1).toBe("partially_paid");
  });

  it("paid invoices stay paid forever", async () => {
    expect((await statusAt("2030-01-01T00:00:00Z")).DEP).toBe("paid");
  });
});
