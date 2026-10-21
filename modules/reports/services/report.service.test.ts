import { describe, expect, it } from "vitest";
import type { Actor } from "@/modules/auth";
import { HttpError } from "@/shared/lib/http-error";
import type { PaymentForReport, ReportStore } from "../types/report.types";
import { getCollections, getOverdueReport } from "./report.service";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const manager: Actor = { userId: "m", orgId: ORG_A, role: "manager" };
const staff: Actor = { userId: "s", orgId: ORG_A, role: "staff" };
const tenant: Actor = {
  userId: "t",
  orgId: ORG_A,
  role: "tenant",
  tenantId: "x",
};
const betaManager: Actor = { userId: "b", orgId: ORG_B, role: "manager" };

type Row = PaymentForReport & { orgId: string };
const row = (
  iso: string,
  amount: number,
  status: Row["status"] = "approved",
  orgId = ORG_A,
): Row => ({
  receivedAt: new Date(iso),
  amountSen: BigInt(amount),
  status,
  orgId,
});

/** Applies org and half-open range filters like the real query; leaves status filtering to the service. */
function storeOf(rows: Row[]) {
  const calls: { orgId: string; start: string; end: string }[] = [];
  const store: ReportStore = {
    listPaymentsReceivedBetween: async (orgId, start, end) => {
      calls.push({ orgId, start: start.toISOString(), end: end.toISOString() });
      return rows.filter(
        (r) => r.orgId === orgId && r.receivedAt >= start && r.receivedAt < end,
      );
    },
    countOverdueInvoices: async () => 0,
  };
  return { store, calls };
}

const q = (from: string, to: string) => ({ from: [from], to: [to] });
const seeded = () => [
  row("2026-01-31T10:00:00+08:00", 300000),
  row("2026-03-01T00:30:00+08:00", 200000), // = 2026-02-28T16:30Z
  row("2026-03-01T10:00:00+08:00", 999, "approved", ORG_B),
];

async function statusOf(promise: Promise<unknown>) {
  try {
    await promise;
    return "ok";
  } catch (error) {
    if (error instanceof HttpError) return error.status;
    throw error;
  }
}

describe("the seeded case", () => {
  it("Jan 300000, Feb 0, Mar 200000 (the Mar payment is Feb 28 in UTC but March in Malaysia)", async () => {
    const { store } = storeOf(seeded());
    expect(
      await getCollections(store, manager, q("2026-01", "2026-03")),
    ).toEqual([
      { month: "2026-01", collectedSen: 300000 },
      { month: "2026-02", collectedSen: 0 },
      { month: "2026-03", collectedSen: 200000 },
    ]);
  });

  it("staff gets the same numbers", async () => {
    const { store } = storeOf(seeded());
    expect(
      (await getCollections(store, staff, q("2026-01", "2026-03"))).map(
        (r) => r.collectedSen,
      ),
    ).toEqual([300000, 0, 200000]);
  });

  it("queries the +08:00 month bounds as one range", async () => {
    const { store, calls } = storeOf(seeded());
    await getCollections(store, manager, q("2026-01", "2026-03"));
    expect(calls).toEqual([
      {
        orgId: ORG_A,
        start: "2025-12-31T16:00:00.000Z",
        end: "2026-03-31T16:00:00.000Z",
      },
    ]);
  });
});

describe("month boundaries", () => {
  it("exactly 2026-03-01T00:00:00+08:00 is March", async () => {
    const { store } = storeOf([row("2026-03-01T00:00:00+08:00", 5)]);
    expect(
      (await getCollections(store, manager, q("2026-02", "2026-03"))).map(
        (r) => r.collectedSen,
      ),
    ).toEqual([0, 5]);
  });
  it("2026-02-28T23:59:59.999+08:00 is February", async () => {
    const { store } = storeOf([row("2026-02-28T23:59:59.999+08:00", 5)]);
    expect(
      (await getCollections(store, manager, q("2026-02", "2026-03"))).map(
        (r) => r.collectedSen,
      ),
    ).toEqual([5, 0]);
  });
  it("payments outside the range are ignored (just before the first month, at the end bound)", async () => {
    const { store } = storeOf([
      row("2025-12-31T23:59:59.999+08:00", 7),
      row("2026-04-01T00:00:00+08:00", 9),
    ]);
    expect(
      (await getCollections(store, manager, q("2026-01", "2026-03"))).map(
        (r) => r.collectedSen,
      ),
    ).toEqual([0, 0, 0]);
  });
  it("a leap-day payment lands in February 2024", async () => {
    const { store } = storeOf([row("2024-02-29T23:00:00+08:00", 3)]);
    expect(
      await getCollections(store, manager, q("2024-02", "2024-03")),
    ).toEqual([
      { month: "2024-02", collectedSen: 3 },
      { month: "2024-03", collectedSen: 0 },
    ]);
  });
});

describe("what counts", () => {
  it("excludes pending, rejected and voided payments; includes approved (online too)", async () => {
    const { store } = storeOf([
      row("2026-01-10T10:00:00+08:00", 100),
      row("2026-01-11T10:00:00+08:00", 1000, "voided"),
      row("2026-01-12T10:00:00+08:00", 2000, "pending_verification"),
      row("2026-01-13T10:00:00+08:00", 4000, "rejected"),
      row("2026-01-14T10:00:00+08:00", 8, "approved"),
    ]);
    expect(
      await getCollections(store, manager, q("2026-01", "2026-01")),
    ).toEqual([{ month: "2026-01", collectedSen: 108 }]);
  });
  it("sums several payments in a month in bigint (no precision loss near 2^53)", async () => {
    const big = 9_007_199_254_740_000;
    const { store } = storeOf([
      row("2026-01-01T10:00:00+08:00", big),
      row("2026-01-02T10:00:00+08:00", 991),
    ]);
    expect(
      (await getCollections(store, manager, q("2026-01", "2026-01")))[0]
        ?.collectedSen,
    ).toBe(9_007_199_254_740_991);
  });
});

describe("the month list", () => {
  it("every month appears, empty ones as 0, in order", async () => {
    const { store } = storeOf([]);
    const rows = await getCollections(store, manager, q("2026-01", "2026-06"));
    expect(rows.map((r) => r.month)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
    ]);
    expect(rows.every((r) => r.collectedSen === 0)).toBe(true);
  });
  it("year rollover 2025-11 .. 2026-02", async () => {
    const { store } = storeOf([
      row("2025-12-31T23:30:00+08:00", 1),
      row("2026-01-01T00:30:00+08:00", 2),
    ]);
    expect(
      await getCollections(store, manager, q("2025-11", "2026-02")),
    ).toEqual([
      { month: "2025-11", collectedSen: 0 },
      { month: "2025-12", collectedSen: 1 },
      { month: "2026-01", collectedSen: 2 },
      { month: "2026-02", collectedSen: 0 },
    ]);
  });
  it("from == to gives one entry", async () => {
    const { store } = storeOf(seeded());
    expect(
      await getCollections(store, manager, q("2026-01", "2026-01")),
    ).toEqual([{ month: "2026-01", collectedSen: 300000 }]);
  });
  it("exactly 60 months is allowed", async () => {
    const { store } = storeOf([]);
    expect(
      await getCollections(store, manager, q("2021-01", "2025-12")),
    ).toHaveLength(60);
  });
});

describe("validation -> 400", () => {
  it.each([
    ["61 months", q("2021-01", "2026-01")],
    ["from after to", q("2026-03", "2026-02")],
    ["month 13", q("2026-13", "2026-14")],
    ["month 00", q("2026-00", "2026-01")],
    ["single-digit month", q("2026-1", "2026-3")],
    ["full dates", q("2026-01-01", "2026-03-31")],
    ["two-digit year", q("26-01", "26-03")],
    ["year 0000", q("0000-01", "0000-02")],
    ["empty values", q("", "")],
    ["garbage", q("abc", "def")],
    ["missing from", { from: [], to: ["2026-03"] }],
    ["missing to", { from: ["2026-01"], to: [] }],
    ["both missing", { from: [], to: [] }],
    ["repeated from", { from: ["2026-01", "2026-02"], to: ["2026-03"] }],
    ["repeated to", { from: ["2026-01"], to: ["2026-03", "2026-04"] }],
  ])("%s", async (_n, query) => {
    const { store, calls } = storeOf(seeded());
    expect(await statusOf(getCollections(store, manager, query))).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

describe("roles and organization isolation", () => {
  it("a tenant gets 403, even with an invalid query (role first)", async () => {
    const { store, calls } = storeOf(seeded());
    expect(
      await statusOf(getCollections(store, tenant, q("2026-01", "2026-03"))),
    ).toBe(403);
    expect(await statusOf(getCollections(store, tenant, q("bad", "bad")))).toBe(
      403,
    );
    expect(calls).toHaveLength(0);
  });

  it("the organization comes from the actor, so a Beta manager sees only Beta's rows, none of Northwind's 300000 / 200000", async () => {
    const { store, calls } = storeOf(seeded());
    expect(
      (await getCollections(store, betaManager, q("2026-01", "2026-03"))).map(
        (r) => r.collectedSen,
      ),
    ).toEqual([0, 0, 999]);
    expect(calls[0]?.orgId).toBe(ORG_B);
  });

  it("Beta's own payment appears only for Beta", async () => {
    const { store } = storeOf(seeded());
    expect(
      (await getCollections(store, betaManager, q("2026-03", "2026-03")))[0]
        ?.collectedSen,
    ).toBe(999);
    expect(
      (await getCollections(store, manager, q("2026-03", "2026-03")))[0]
        ?.collectedSen,
    ).toBe(200000);
  });
});

describe("getOverdueReport", () => {
  type FakeInvoice = {
    id: string;
    orgId: string;
    dueDate: string; // YYYY-MM-DD
    amountSen: bigint;
    allocations: { amountSen: bigint }[];
  };

  function overdueStoreOf(invoices: FakeInvoice[]): ReportStore {
    return {
      listPaymentsReceivedBetween: async () => [],
      countOverdueInvoices: async (orgId: string, asOfMalaysiaDate: string) => {
        return invoices
          .filter(
            (inv) => inv.orgId === orgId && inv.dueDate < asOfMalaysiaDate,
          )
          .filter((inv) => {
            const paid = inv.allocations.reduce(
              (sum, a) => sum + a.amountSen,
              BigInt(0),
            );
            return paid < inv.amountSen;
          }).length;
      },
    };
  }

  it("manager and staff can view; tenant gets 403", async () => {
    const store = overdueStoreOf([]);
    expect(await statusOf(getOverdueReport(store, manager))).toBe("ok");
    expect(await statusOf(getOverdueReport(store, staff))).toBe("ok");
    expect(await statusOf(getOverdueReport(store, tenant))).toBe(403);
  });

  it("due today in MYT is NOT overdue", async () => {
    const store = overdueStoreOf([
      {
        id: "inv-today",
        orgId: ORG_A,
        dueDate: "2026-03-15",
        amountSen: BigInt(150000),
        allocations: [],
      },
    ]);
    // 2026-03-15T04:00:00Z is 12:00:00 MYT on 2026-03-15
    const report = await getOverdueReport(
      store,
      manager,
      new Date("2026-03-15T04:00:00Z"),
    );
    expect(report.overdueCount).toBe(0);
  });

  it("due yesterday is overdue", async () => {
    const store = overdueStoreOf([
      {
        id: "inv-yesterday",
        orgId: ORG_A,
        dueDate: "2026-03-14",
        amountSen: BigInt(150000),
        allocations: [],
      },
    ]);
    const report = await getOverdueReport(
      store,
      manager,
      new Date("2026-03-15T04:00:00Z"),
    );
    expect(report.overdueCount).toBe(1);
  });

  it("fully paid is not overdue even if past due", async () => {
    const store = overdueStoreOf([
      {
        id: "inv-paid",
        orgId: ORG_A,
        dueDate: "2026-03-14",
        amountSen: BigInt(150000),
        allocations: [{ amountSen: BigInt(150000) }],
      },
    ]);
    const report = await getOverdueReport(
      store,
      manager,
      new Date("2026-03-15T04:00:00Z"),
    );
    expect(report.overdueCount).toBe(0);
  });

  it("partially paid and past due is overdue", async () => {
    const store = overdueStoreOf([
      {
        id: "inv-partial",
        orgId: ORG_A,
        dueDate: "2026-03-14",
        amountSen: BigInt(150000),
        allocations: [{ amountSen: BigInt(50000) }],
      },
    ]);
    const report = await getOverdueReport(
      store,
      manager,
      new Date("2026-03-15T04:00:00Z"),
    );
    expect(report.overdueCount).toBe(1);
  });

  it("Beta data never counts for Northwind", async () => {
    const store = overdueStoreOf([
      {
        id: "inv-beta",
        orgId: ORG_B,
        dueDate: "2026-03-14",
        amountSen: BigInt(150000),
        allocations: [],
      },
    ]);
    const northwind = await getOverdueReport(
      store,
      manager,
      new Date("2026-03-15T04:00:00Z"),
    );
    expect(northwind.overdueCount).toBe(0);

    const beta = await getOverdueReport(
      store,
      betaManager,
      new Date("2026-03-15T04:00:00Z"),
    );
    expect(beta.overdueCount).toBe(1);
  });

  it("clock at 2026-03-01T15:59:59Z vs 16:00:00Z for an invoice due 2026-03-01", async () => {
    const store = overdueStoreOf([
      {
        id: "inv-boundary",
        orgId: ORG_A,
        dueDate: "2026-03-01",
        amountSen: BigInt(150000),
        allocations: [],
      },
    ]);

    // 15:59:59Z + 8h = 23:59:59 on March 1 -> todayInMalaysia is 2026-03-01 -> NOT overdue
    const beforeMidnight = await getOverdueReport(
      store,
      manager,
      new Date("2026-03-01T15:59:59Z"),
    );
    expect(beforeMidnight.overdueCount).toBe(0);

    // 16:00:00Z + 8h = 00:00:00 on March 2 -> todayInMalaysia is 2026-03-02 -> OVERDUE
    const atMidnight = await getOverdueReport(
      store,
      manager,
      new Date("2026-03-01T16:00:00Z"),
    );
    expect(atMidnight.overdueCount).toBe(1);
  });
});
