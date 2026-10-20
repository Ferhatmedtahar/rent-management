import { describe, expect, it } from "vitest";
import type { Actor } from "@/modules/auth";
import { HttpError } from "@/shared/lib/http-error";
import type {
  GatewayDeps,
  InvoiceBalance,
  NewBill,
} from "../types/gateway.types";
import { newBillId } from "./bill-id";
import { createGatewayBill } from "./gateway.service";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const LEASE = "cccccccc-0000-4000-8000-000000000001";
const TENANT = "dddddddd-0000-4000-8000-000000000001";

const owner: Actor = {
  userId: "u-t",
  orgId: ORG_A,
  role: "tenant",
  tenantId: TENANT,
};
const otherTenant: Actor = {
  ...owner,
  tenantId: "dddddddd-0000-4000-8000-000000000002",
};
const manager: Actor = { userId: "u-m", orgId: ORG_A, role: "manager" };
const staff: Actor = { userId: "u-s", orgId: ORG_A, role: "staff" };
const otherOrg: Actor = { ...owner, orgId: ORG_B };

// Aisyah after the two seeded payments: deposit + P0 paid, P1 50000/150000.
const balances = (): InvoiceBalance[] => [
  { dueDate: "2026-01-31", amountSen: 300000, allocatedSen: 300000 },
  { dueDate: "2026-01-31", amountSen: 150000, allocatedSen: 150000 },
  { dueDate: "2026-02-28", amountSen: 150000, allocatedSen: 50000 },
  { dueDate: "2026-03-31", amountSen: 150000, allocatedSen: 0 },
  { dueDate: "2026-04-30", amountSen: 150000, allocatedSen: 0 },
];

function setup(options: { now: string; invoices?: InvoiceBalance[] }) {
  const state = { bills: [] as NewBill[], order: [] as string[] };
  const deps: GatewayDeps = {
    now: () => new Date(options.now),
    newBillId: () => "bill_FIXED_FIXED_FIXED_FIXED_FIXED_FIXED_00",
    store: {
      findLeaseInOrg: async (id, orgId) =>
        id === LEASE && orgId === ORG_A ? { id, tenantId: TENANT } : null,
      transaction: async (work) => {
        const pending: NewBill[] = [];
        const result = await work({
          lockLease: async () => {
            state.order.push("lock");
            return true;
          },
          listInvoiceBalances: async () => {
            state.order.push("read");
            return options.invoices ?? balances();
          },
          insertBill: async (bill) => {
            pending.push(bill);
          },
        });
        state.bills.push(...pending);
        return result;
      },
    },
  };
  return { deps, state };
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

describe("createGatewayBill: the amount due now (Malaysia date)", () => {
  it("counts the unpaid part of invoices due on or before today", async () => {
    // Today 2026-03-01 MYT: only the 01-31 and 02-28 invoices are due. Unpaid = 100000.
    const { deps, state } = setup({ now: "2026-03-01T00:00:00Z" });
    expect(await createGatewayBill(deps, owner, LEASE)).toEqual({
      billId: "bill_FIXED_FIXED_FIXED_FIXED_FIXED_FIXED_00",
      amountSen: 100000,
    });
    expect(state.bills).toEqual([
      {
        id: "bill_FIXED_FIXED_FIXED_FIXED_FIXED_FIXED_00",
        orgId: ORG_A,
        leaseId: LEASE,
        amountSen: 100000,
        createdBy: owner.userId,
      },
    ]);
  });

  it("uses the Malaysia date: the 03-31 invoice becomes due at 2026-03-30T16:00:00Z, not a moment earlier", async () => {
    // 15:59:59Z: MYT date is still 03-30 -> the 03-31 invoice is NOT due yet.
    expect(
      (
        await createGatewayBill(
          setup({ now: "2026-03-30T15:59:59Z" }).deps,
          owner,
          LEASE,
        )
      ).amountSen,
    ).toBe(100000);
    // 16:00:00Z: MYT date is 03-31 -> due today, included (100000 + 150000).
    expect(
      (
        await createGatewayBill(
          setup({ now: "2026-03-30T16:00:00Z" }).deps,
          owner,
          LEASE,
        )
      ).amountSen,
    ).toBe(250000);
  });

  it("an invoice due today is included, and one due tomorrow is not (boundary at 16:00:00Z)", async () => {
    // 15:59:59Z on 2026-02-27: MYT date 02-27 -> only 01-31 invoices due; both are paid -> nothing due.
    expect(
      await statusOf(
        createGatewayBill(
          setup({ now: "2026-02-27T15:59:59Z" }).deps,
          owner,
          LEASE,
        ),
      ),
    ).toBe(422);
    // 16:00:00Z: MYT date is 02-28 -> P1 (due 02-28) is now due: 100000 unpaid.
    expect(
      (
        await createGatewayBill(
          setup({ now: "2026-02-27T16:00:00Z" }).deps,
          owner,
          LEASE,
        )
      ).amountSen,
    ).toBe(100000);
  });

  it("future invoices are excluded however unpaid", async () => {
    expect(
      (
        await createGatewayBill(
          setup({ now: "2026-03-01T00:00:00Z" }).deps,
          owner,
          LEASE,
        )
      ).amountSen,
    ).toBe(100000);
    expect(
      (
        await createGatewayBill(
          setup({ now: "2026-04-30T16:00:00Z" }).deps,
          owner,
          LEASE,
        )
      ).amountSen,
    ).toBe(100000 + 150000 + 150000);
  });

  it("nothing due -> 422 and no bill is written", async () => {
    const { deps, state } = setup({ now: "2026-01-01T00:00:00Z" });
    expect(await statusOf(createGatewayBill(deps, owner, LEASE))).toBe(422);
    expect(state.bills).toHaveLength(0);
  });

  it("everything due but fully paid -> 422", async () => {
    const paid = balances().map((b) => ({ ...b, allocatedSen: b.amountSen }));
    expect(
      await statusOf(
        createGatewayBill(
          setup({ now: "2027-01-01T00:00:00Z", invoices: paid }).deps,
          owner,
          LEASE,
        ),
      ),
    ).toBe(422);
  });

  it("an over-allocated invoice never yields a negative contribution", async () => {
    const odd: InvoiceBalance[] = [
      { dueDate: "2026-01-01", amountSen: 100, allocatedSen: 150 },
      { dueDate: "2026-01-02", amountSen: 500, allocatedSen: 0 },
    ];
    expect(
      (
        await createGatewayBill(
          setup({ now: "2026-06-01T00:00:00Z", invoices: odd }).deps,
          owner,
          LEASE,
        )
      ).amountSen,
    ).toBe(500);
  });

  it("takes the lease lock before reading allocations", async () => {
    const { deps, state } = setup({ now: "2026-03-01T00:00:00Z" });
    await createGatewayBill(deps, owner, LEASE);
    expect(state.order).toEqual(["lock", "read"]);
  });
});

describe("createGatewayBill: who may call it", () => {
  const now = "2026-03-01T00:00:00Z";
  it("the lease's tenant -> 201 path", async () => {
    expect(
      await statusOf(createGatewayBill(setup({ now }).deps, owner, LEASE)),
    ).toBe("ok");
  });
  it.each([
    ["manager", manager],
    ["staff", staff],
  ])("%s who can see the lease -> 403", async (_n, actor) => {
    expect(
      await statusOf(createGatewayBill(setup({ now }).deps, actor, LEASE)),
    ).toBe(403);
  });
  it("a tenant who does not own the lease -> 404", async () => {
    expect(
      await statusOf(
        createGatewayBill(setup({ now }).deps, otherTenant, LEASE),
      ),
    ).toBe(404);
  });
  it("another organization -> 404", async () => {
    expect(
      await statusOf(createGatewayBill(setup({ now }).deps, otherOrg, LEASE)),
    ).toBe(404);
    expect(
      await statusOf(
        createGatewayBill(
          setup({ now }).deps,
          { ...manager, orgId: ORG_B },
          LEASE,
        ),
      ),
    ).toBe(404);
  });
  it("unknown and malformed lease ids -> 404", async () => {
    expect(
      await statusOf(
        createGatewayBill(
          setup({ now }).deps,
          owner,
          "cccccccc-0000-4000-8000-000000000009",
        ),
      ),
    ).toBe(404);
    expect(
      await statusOf(createGatewayBill(setup({ now }).deps, owner, "nope")),
    ).toBe(404);
  });
});

describe("newBillId", () => {
  const FORMAT = /^bill_[A-Za-z0-9_-]{32,128}$/; // the database CHECK

  it("matches the database CHECK", () => {
    for (let i = 0; i < 200; i += 1) expect(newBillId()).toMatch(FORMAT);
  });
  it("carries 256 bits: 43 base64url characters after the prefix", () => {
    expect(newBillId()).toHaveLength("bill_".length + 43);
  });
  it("is not repeated", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newBillId()));
    expect(ids.size).toBe(1000);
  });
});
