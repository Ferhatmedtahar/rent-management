import { describe, expect, it } from "vitest";
import type { Actor } from "@/modules/auth";
import { HttpError } from "@/shared/lib/http-error";
import type { BillReadStore } from "../types/gateway.types";
import { getBill } from "./bill-read.service";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const TENANT = "dddddddd-0000-4000-8000-000000000001";
const BILL = "bill_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const store: BillReadStore = {
  findBillInOrg: async (id, orgId) =>
    id === BILL && orgId === ORG_A
      ? { id, amountSen: 250000, status: "paid", leaseTenantId: TENANT }
      : null,
};
const owner: Actor = {
  userId: "t",
  orgId: ORG_A,
  role: "tenant",
  tenantId: TENANT,
};
const manager: Actor = { userId: "m", orgId: ORG_A, role: "manager" };
const staff: Actor = { ...manager, role: "staff" };

async function statusOf(promise: Promise<unknown>) {
  try {
    await promise;
    return "ok";
  } catch (error) {
    if (error instanceof HttpError) return error.status;
    throw error;
  }
}

describe("getBill", () => {
  it.each([
    ["owning tenant", owner],
    ["manager", manager],
    ["staff", staff],
  ])("%s sees the real status", async (_n, actor) => {
    expect(await getBill(store, actor, BILL)).toEqual({
      billId: BILL,
      amountSen: 250000,
      status: "paid",
    });
  });
  it("another tenant -> 404", async () => {
    expect(
      await statusOf(getBill(store, { ...owner, tenantId: "other" }, BILL)),
    ).toBe(404);
  });
  it("a tenant actor without a tenant id -> 404", async () => {
    expect(
      await statusOf(getBill(store, { ...owner, tenantId: undefined }, BILL)),
    ).toBe(404);
  });
  it("another organization -> 404", async () => {
    expect(
      await statusOf(getBill(store, { ...manager, orgId: ORG_B }, BILL)),
    ).toBe(404);
  });
  it.each([
    ["unknown", "bill_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"],
    ["malformed", "nope"],
    ["short", "bill_abc"],
    ["injection", "bill_' OR 1=1 --xxxxxxxxxxxxxxxxxxxxxxxxxxxx"],
  ])("%s id -> 404", async (_n, id) => {
    expect(await statusOf(getBill(store, manager, id))).toBe(404);
  });
});
