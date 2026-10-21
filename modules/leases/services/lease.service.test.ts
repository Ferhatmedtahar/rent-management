import { describe, expect, it } from "vitest";
import { generateSchedule, type ScheduledInvoice } from "@/lib/billing";
import type { Actor } from "@/modules/auth";
import { HttpError } from "@/shared/lib/http-error";
import { isExclusionViolation } from "../repositories/db-errors";
import type {
  AuditEntry,
  LeaseStore,
  LeaseTx,
  NewLease,
} from "../types/lease.types";
import { createLease } from "./lease.service";

const ORG_A = "11111111-1111-1111-1111-111111111111";
const ORG_B = "22222222-2222-2222-2222-222222222222";
const UNIT_A = "aaaaaaaa-0000-4000-8000-000000000001";
const UNIT_B = "bbbbbbbb-0000-4000-8000-000000000001";
const TENANT_A = "dddddddd-0000-4000-8000-000000000001";
const TENANT_B = "dddddddd-0000-4000-8000-000000000002";
const LEASE_ID = "cccccccc-0000-4000-8000-000000000001";

const manager: Actor = {
  userId: "00000000-0000-4000-8000-0000000000a1",
  orgId: ORG_A,
  role: "manager",
};
const staff: Actor = { ...manager, role: "staff" };
const tenant: Actor = { ...manager, role: "tenant", tenantId: TENANT_A };

const valid = {
  unitId: UNIT_A,
  tenantId: TENANT_A,
  startDate: "2026-01-31",
  endDate: "2026-07-15",
  monthlyRentSen: 150000,
  depositSen: 300000,
};

type Written = {
  leases: NewLease[];
  invoices: ScheduledInvoice[];
  audits: AuditEntry[];
};

/** In-memory store. Writes are buffered and committed only if `work` resolves. */
function fakeStore(
  options: { failAt?: "invoices" | "audit"; overlap?: unknown } = {},
) {
  const committed: Written = { leases: [], invoices: [], audits: [] };
  const unitOrg = new Map([
    [UNIT_A, ORG_A],
    [UNIT_B, ORG_B],
  ]);
  const tenantOrg = new Map([
    [TENANT_A, ORG_A],
    [TENANT_B, ORG_B],
  ]);
  const store: LeaseStore = {
    async transaction(work) {
      const pending: Written = { leases: [], invoices: [], audits: [] };
      const tx: LeaseTx = {
        findUnitInOrg: async (id, orgId) =>
          unitOrg.get(id) === orgId ? { id } : null,
        findTenantInOrg: async (id, orgId) =>
          tenantOrg.get(id) === orgId ? { id } : null,
        insertLease: async (lease) => {
          if (options.overlap) throw options.overlap;
          pending.leases.push(lease);
          return { id: LEASE_ID };
        },
        insertInvoices: async (_org, _lease, invoices) => {
          if (options.failAt === "invoices") throw new Error("boom invoices");
          pending.invoices.push(...invoices);
        },
        insertAudit: async (entry) => {
          if (options.failAt === "audit") throw new Error("boom audit");
          pending.audits.push(entry);
        },
      };
      const result = await work(tx);
      committed.leases.push(...pending.leases);
      committed.invoices.push(...pending.invoices);
      committed.audits.push(...pending.audits);
      return result;
    },
  };
  return { store, committed };
}

async function statusOf(promise: Promise<unknown>) {
  try {
    await promise;
    return "ok";
  } catch (error) {
    if (error instanceof HttpError) return error.status;
    throw error;
  }
}

describe("createLease: authorization", () => {
  it.each([
    ["staff", staff],
    ["tenant", tenant],
  ])("%s gets 403 and nothing is written", async (_n, actor) => {
    const { store, committed } = fakeStore();
    expect(await statusOf(createLease(store, actor, valid))).toBe(403);
    expect(committed.leases).toHaveLength(0);
  });

  it("other-organization unit -> 404", async () => {
    const { store, committed } = fakeStore();
    expect(
      await statusOf(createLease(store, manager, { ...valid, unitId: UNIT_B })),
    ).toBe(404);
    expect(committed.leases).toHaveLength(0);
  });

  it("other-organization tenant -> 404", async () => {
    const { store, committed } = fakeStore();
    expect(
      await statusOf(
        createLease(store, manager, { ...valid, tenantId: TENANT_B }),
      ),
    ).toBe(404);
    expect(committed.leases).toHaveLength(0);
  });

  it("unknown unit id -> 404 (same as another org's)", async () => {
    const { store } = fakeStore();
    const unknown = "eeeeeeee-0000-4000-8000-000000000009";
    expect(
      await statusOf(
        createLease(store, manager, { ...valid, unitId: unknown }),
      ),
    ).toBe(404);
  });
});

describe("createLease: validation -> 400", () => {
  const bad: [string, Record<string, unknown>][] = [
    ["non-uuid unitId", { unitId: "nope" }],
    ["non-uuid tenantId", { tenantId: "nope" }],
    ["missing unitId", { unitId: undefined }],
    ["impossible date", { startDate: "2026-02-30" }],
    ["malformed date", { endDate: "2026/07/15" }],
    ["end before start", { startDate: "2026-08-01", endDate: "2026-07-01" }],
    ["zero rent", { monthlyRentSen: 0 }],
    ["fractional rent", { monthlyRentSen: 1.5 }],
    ["string rent", { monthlyRentSen: "1000" }],
    ["rent above 1e12", { monthlyRentSen: 1_000_000_000_001 }],
    ["negative deposit", { depositSen: -1 }],
    ["fractional deposit", { depositSen: 0.5 }],
    ["deposit above 1e12", { depositSen: 1_000_000_000_001 }],
    ["lease longer than 120 months", { endDate: "2036-02-01" }],
  ];
  it.each(bad)("%s", async (_label, patch) => {
    const { store, committed } = fakeStore();
    expect(
      await statusOf(createLease(store, manager, { ...valid, ...patch })),
    ).toBe(400);
    expect(committed.leases).toHaveLength(0);
  });

  it("non-object body -> 400", async () => {
    const { store } = fakeStore();
    expect(await statusOf(createLease(store, manager, null))).toBe(400);
    expect(await statusOf(createLease(store, manager, "x"))).toBe(400);
  });

  it("exactly 120 months is allowed, one day more is not", async () => {
    const { store } = fakeStore();
    expect(
      await statusOf(
        createLease(store, manager, {
          ...valid,
          startDate: "2026-01-01",
          endDate: "2036-01-01",
        }),
      ),
    ).toBe("ok");
    expect(
      await statusOf(
        createLease(store, manager, {
          ...valid,
          startDate: "2026-01-01",
          endDate: "2036-01-02",
        }),
      ),
    ).toBe(400);
  });

  it("unknown keys are stripped, not rejected, and never reach the store", async () => {
    const { store, committed } = fakeStore();
    await createLease(store, manager, {
      ...valid,
      orgId: ORG_B,
      createdBy: "x",
      extra: 1,
    });
    expect(committed.leases[0]?.orgId).toBe(ORG_A);
    expect(committed.leases[0]).not.toHaveProperty("extra");
    expect(committed.leases[0]?.createdBy).toBe(manager.userId);
  });
});

describe("createLease: success", () => {
  it("returns { id } and writes exactly the generateSchedule invoices", async () => {
    const { store, committed } = fakeStore();
    expect(await createLease(store, manager, valid)).toEqual({ id: LEASE_ID });
    expect(committed.invoices).toEqual(generateSchedule(valid));
    expect(committed.invoices).toHaveLength(7);
    expect(committed.invoices.at(-1)?.amountSen).toBe(77419);
    expect(committed.leases).toEqual([
      { ...valid, orgId: ORG_A, createdBy: manager.userId },
    ]);
  });

  it("writes the audit row with the lease id and details", async () => {
    const { store, committed } = fakeStore();
    await createLease(store, manager, valid);
    expect(committed.audits).toEqual([
      {
        orgId: ORG_A,
        actorId: manager.userId,
        action: "lease.created",
        entityType: "lease",
        entityId: LEASE_ID,
        details: { ...valid, invoiceCount: 7 },
      },
    ]);
  });
});

describe("createLease: all or nothing", () => {
  it("failing invoice insert commits nothing, error is not swallowed", async () => {
    const { store, committed } = fakeStore({ failAt: "invoices" });
    await expect(createLease(store, manager, valid)).rejects.toThrow(
      "boom invoices",
    );
    expect(committed).toEqual({ leases: [], invoices: [], audits: [] });
  });

  it("failing audit insert commits nothing", async () => {
    const { store, committed } = fakeStore({ failAt: "audit" });
    await expect(createLease(store, manager, valid)).rejects.toThrow(
      "boom audit",
    );
    expect(committed).toEqual({ leases: [], invoices: [], audits: [] });
  });
});

/** Shaped like the real Prisma 7 + pg adapter error (see db-errors.ts). */
const prismaOverlapError = Object.assign(
  new Error(
    'Database error. Code: `23P01`. Message: `conflicting key value violates exclusion constraint "leases_no_overlap"`',
  ),
  {
    name: "PrismaClientKnownRequestError",
    code: "P2039",
    meta: {
      driverAdapterError: {
        name: "DriverAdapterError",
        cause: {
          kind: "postgres",
          code: "23P01",
          severity: "ERROR",
          message:
            'conflicting key value violates exclusion constraint "leases_no_overlap"',
        },
      },
    },
  },
);

describe("overlap -> 409", () => {
  it("maps the Prisma-shaped 23P01 error to 409 and commits nothing", async () => {
    const { store, committed } = fakeStore({ overlap: prismaOverlapError });
    expect(await statusOf(createLease(store, manager, valid))).toBe(409);
    expect(committed.leases).toHaveLength(0);
  });

  it.each([
    ["Prisma P2039 shape", prismaOverlapError],
    ["raw pg error", { code: "23P01", message: "x" }],
    ["wrapped in cause", { message: "tx failed", cause: { code: "23P01" } }],
    [
      "originalCode",
      { meta: { driverAdapterError: { cause: { originalCode: "23P01" } } } },
    ],
    [
      "message only",
      new Error("Raw query failed. Code: `23P01`. Message: `x`"),
    ],
  ])("isExclusionViolation recognises %s", (_n, error) => {
    expect(isExclusionViolation(error)).toBe(true);
  });

  it.each([
    ["unique violation", { code: "23505" }],
    ["plain error", new Error("boom")],
    ["null", null],
    ["string", "23P01"],
  ])("isExclusionViolation rejects %s", (_n, error) => {
    expect(isExclusionViolation(error)).toBe(false);
  });

  it("other database errors are not turned into 409", async () => {
    const { store } = fakeStore({ overlap: { code: "23505" } });
    await expect(createLease(store, manager, valid)).rejects.toEqual({
      code: "23505",
    });
  });
});
