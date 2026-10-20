import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/shared/lib/http-error";
import type {
  BillRecord,
  BillStatus,
  OnlinePayment,
  WebhookAudit,
  WebhookDeps,
} from "../types/gateway.types";
import { parsePaidAt } from "./paid-at";
import {
  computeSignature,
  parseFormFields,
  signatureSource,
  verifySignature,
} from "./signature";
import { handleGatewayCallback } from "./webhook.service";

const KEY = "test_x_signature_key";
const ORG = "11111111-1111-4111-8111-111111111111";
const LEASE = "cccccccc-0000-4000-8000-000000000001";
const BILL = "bill_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

// ---------- the brief's test vector -------------------------------------------------
describe("signature: the brief's test vector", () => {
  const fields = new Map([
    ["id", "bill_8f3a2c"],
    ["paid", "true"],
    ["paid_amount", "210050"],
    ["paid_at", "2026-04-01 00:30:12 +0800"],
    ["transaction_id", "TX-000123"],
    ["transaction_status", "completed"],
  ]);

  it("builds the documented source string", () => {
    expect(signatureSource(fields)).toBe(
      "idbill_8f3a2c|paidtrue|paid_amount210050|paid_at2026-04-01 00:30:12 +0800|transaction_idTX-000123|transaction_statuscompleted",
    );
  });

  it("produces the documented signature", () => {
    expect(computeSignature(fields, KEY)).toBe(
      "06994fab2d674e7829144eaa2204631716d3c099b503d38945e92b6296531641",
    );
  });

  it("verifies it, ignoring the x_signature field itself and field order", () => {
    const signed = new Map([
      ["x_signature", computeSignature(fields, KEY)],
      ...[...fields].reverse(),
    ]);
    expect(verifySignature(signed, KEY)).toBe(true);
  });

  it("sorts keys by character code, not by locale (underscore sorts after uppercase, before lowercase)", () => {
    const f = new Map([
      ["b", "1"],
      ["B", "2"],
      ["_", "3"],
      ["a", "4"],
    ]);
    expect(signatureSource(f)).toBe("B2|_3|a4|b1");
  });

  it("extra unknown fields are part of the source and still verify", () => {
    const withExtra = new Map([...fields, ["future_field", "x"]]);
    const signed = new Map([
      ...withExtra,
      ["x_signature", computeSignature(withExtra, KEY)],
    ]);
    expect(verifySignature(signed, KEY)).toBe(true);
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["wrong", "0".repeat(64)],
    ["uppercase hex", computeSignature(fields, KEY).toUpperCase()],
    ["too short", "abc"],
    ["too long", computeSignature(fields, KEY) + "00"],
    ["with spaces", ` ${computeSignature(fields, KEY)}`],
  ])("rejects a %s signature without throwing", (_n, sig) => {
    const f = new Map(fields);
    if (sig !== undefined) f.set("x_signature", sig);
    expect(verifySignature(f, KEY)).toBe(false);
  });

  it("rejects a signature made with another key, and a tampered field", () => {
    expect(
      verifySignature(
        new Map([
          ...fields,
          ["x_signature", computeSignature(fields, "other")],
        ]),
        KEY,
      ),
    ).toBe(false);
    const tampered = new Map([
      ...fields,
      ["x_signature", computeSignature(fields, KEY)],
    ]);
    tampered.set("paid_amount", "1");
    expect(verifySignature(tampered, KEY)).toBe(false);
  });

  it("parseFormFields: a repeated key makes the body invalid", () => {
    expect(parseFormFields("a=1&b=2")?.get("b")).toBe("2");
    expect(parseFormFields("a=1&a=2")).toBeNull();
    expect(parseFormFields("x_signature=a&x_signature=b")).toBeNull();
  });

  it("parseFormFields decodes + and %20 in values", () => {
    expect(
      parseFormFields("paid_at=2026-04-01+00%3A30%3A12+%2B0800")?.get(
        "paid_at",
      ),
    ).toBe("2026-04-01 00:30:12 +0800");
  });
});

// ---------- paid_at --------------------------------------------------------------------
describe("parsePaidAt", () => {
  it("parses the brief's format as Malaysia time", () => {
    expect(parsePaidAt("2026-04-01 00:30:12 +0800")?.toISOString()).toBe(
      "2026-03-31T16:30:12.000Z",
    );
  });
  it("parses ISO 8601 with an offset or Z", () => {
    expect(parsePaidAt("2026-04-01T00:30:12+08:00")?.toISOString()).toBe(
      "2026-03-31T16:30:12.000Z",
    );
    expect(parsePaidAt("2026-03-31T16:30:12Z")?.toISOString()).toBe(
      "2026-03-31T16:30:12.000Z",
    );
  });
  it("handles other offsets", () => {
    expect(parsePaidAt("2026-04-01 00:30:12 -0500")?.toISOString()).toBe(
      "2026-04-01T05:30:12.000Z",
    );
  });
  it.each([
    [undefined],
    [""],
    ["yesterday"],
    ["2026-04-01 00:30:12"],
    ["2026-04-01T00:30:12"],
    ["2026-02-30 10:00:00 +0800"],
    ["2026-04-01 25:00:00 +0800"],
    ["2026-04-01"],
    ["1712000000"],
  ])("rejects %j (never falls back to now)", (value) => {
    expect(parsePaidAt(value)).toBeNull();
  });
});

// ---------- fake store ------------------------------------------------------------------
type State = {
  bills: Map<
    string,
    BillRecord & { paidAt?: Date; transactionId?: string | null }
  >;
  payments: (OnlinePayment & { id: string })[];
  allocations: { paymentId: string; invoiceId: string; amountSen: number }[];
  audits: WebhookAudit[];
};

const invoices = () => [
  {
    id: "I1",
    kind: "rent" as const,
    periodIndex: 0,
    dueDate: "2026-01-01",
    amountSen: 100000,
    allocatedSen: 0,
  },
  {
    id: "I2",
    kind: "rent" as const,
    periodIndex: 1,
    dueDate: "2026-02-01",
    amountSen: 100000,
    allocatedSen: 0,
  },
];

function setup(
  options: {
    amountSen?: number;
    status?: BillStatus;
    invoiceRows?: ReturnType<typeof invoices>;
    throwOnInsert?: unknown;
  } = {},
) {
  const state: State = {
    bills: new Map([
      [
        BILL,
        {
          id: BILL,
          orgId: ORG,
          leaseId: LEASE,
          amountSen: options.amountSen ?? 200000,
          status: options.status ?? "pending",
        },
      ],
    ]),
    payments: [],
    allocations: [],
    audits: [],
  };
  const calls = { count: 0, order: [] as string[] };
  let queue: Promise<unknown> = Promise.resolve();
  const bump = (name: string) => {
    calls.count += 1;
    calls.order.push(name);
  };

  const deps: WebhookDeps = {
    signatureKey: KEY,
    now: () => new Date("2026-04-01T00:00:00Z"),
    store: {
      findBill: async (id) => {
        bump("findBill");
        const bill = state.bills.get(id);
        return bill
          ? {
              id: bill.id,
              orgId: bill.orgId,
              leaseId: bill.leaseId,
              amountSen: bill.amountSen,
              status: bill.status,
            }
          : null;
      },
      markBillFailed: async (id) => {
        bump("markBillFailed");
        const bill = state.bills.get(id);
        if (bill && bill.status === "pending") bill.status = "failed";
      },
      transaction: (work) => {
        bump("transaction");
        // Serialized like the lease lock; copy-on-write so a throw rolls back.
        const run = async () => {
          const draft = structuredClone({
            bills: [...state.bills],
            payments: state.payments,
            allocations: state.allocations,
            audits: state.audits,
          });
          const bills = new Map(draft.bills);
          const result = await work({
            lockLease: async () => {
              calls.order.push("lock");
              return true;
            },
            markBillPaid: async (id, paidAt, transactionId) => {
              calls.order.push("markBillPaid");
              const bill = bills.get(id);
              if (!bill || bill.status === "paid") return false;
              bill.status = "paid";
              bill.paidAt = paidAt;
              bill.transactionId = transactionId;
              return true;
            },
            listInvoicesForAllocation: async () =>
              (options.invoiceRows ?? invoices()).map((i) => ({
                ...i,
                allocatedSen: draft.allocations
                  .filter((a) => a.invoiceId === i.id)
                  .reduce((s, a) => s + a.amountSen, 0),
              })),
            insertOnlinePayment: async (p) => {
              if (options.throwOnInsert) throw options.throwOnInsert;
              if (
                draft.payments.some((x) => x.gatewayBillId === p.gatewayBillId)
              )
                throw Object.assign(new Error("dup"), { code: "P2002" });
              const row = { ...p, id: `pay-${draft.payments.length + 1}` };
              draft.payments.push(row);
              return { id: row.id };
            },
            insertAllocations: async (_o, _l, paymentId, rows) => {
              draft.allocations.push(...rows.map((r) => ({ ...r, paymentId })));
            },
            insertAudit: async (e) => {
              draft.audits.push(e);
            },
          });
          state.bills = bills;
          state.payments = draft.payments;
          state.allocations = draft.allocations;
          state.audits = draft.audits;
          return result;
        };
        const next = queue.then(run, run);
        queue = next.catch(() => undefined);
        return next;
      },
    },
  };
  return { deps, state, calls };
}

/** Builds a signed urlencoded body the way gateway-sim.mjs does. */
function body(
  overrides: Record<string, string | undefined> = {},
  key = KEY,
  extra: Record<string, string> = {},
): string {
  const fields = new Map<string, string>(
    Object.entries({
      id: BILL,
      paid: "true",
      paid_amount: "200000",
      paid_at: "2026-04-01 00:30:12 +0800",
      transaction_id: "TX-1",
      transaction_status: "completed",
      ...extra,
      ...overrides,
    }).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  fields.set("x_signature", computeSignature(fields, key));
  return new URLSearchParams([...fields]).toString();
}

async function statusOf(promise: Promise<unknown>) {
  try {
    await promise;
    return 200;
  } catch (error) {
    if (error instanceof HttpError) return error.status;
    throw error;
  }
}

afterEach(() => vi.restoreAllMocks());

// ---------- the table ----------------------------------------------------------------------
describe("signature failures: 401 with zero store calls", () => {
  const unsigned = new URLSearchParams({
    id: BILL,
    paid: "true",
    paid_amount: "200000",
    paid_at: "2026-04-01 00:30:12 +0800",
  }).toString();
  it.each([
    ["no signature field", unsigned],
    ["empty signature", `${unsigned}&x_signature=`],
    ["wrong signature", `${unsigned}&x_signature=${"0".repeat(64)}`],
    ["signed with another key", body({}, "other-key")],
    [
      "tampered after signing",
      body().replace("paid_amount=200000", "paid_amount=1"),
    ],
    ["duplicate x_signature", `${body()}&x_signature=${"0".repeat(64)}`],
    ["duplicate field", `${body()}&paid=false`],
    ["empty body", ""],
    ["garbage body", "%%%not form data"],
  ])("%s", async (_n, raw) => {
    const { deps, calls, state } = setup();
    expect(await statusOf(handleGatewayCallback(deps, raw))).toBe(401);
    expect(calls.count).toBe(0);
    expect(state.payments).toHaveLength(0);
    expect(state.bills.get(BILL)?.status).toBe("pending");
  });
});

describe("unknown bill and bad values", () => {
  it("unknown bill id -> 404, no effect", async () => {
    const { deps, state } = setup();
    expect(
      await statusOf(handleGatewayCallback(deps, body({ id: "bill_unknown" }))),
    ).toBe(404);
    expect(
      await statusOf(handleGatewayCallback(deps, body({ id: undefined }))),
    ).toBe(404);
    expect(state.payments).toHaveLength(0);
  });

  it("a hostile id is just an unknown bill (never cast, never injected)", async () => {
    const { deps } = setup();
    expect(
      await statusOf(handleGatewayCallback(deps, body({ id: "x' OR '1'='1" }))),
    ).toBe(404);
  });

  it.each([
    ["different"],
    ["199999"],
    ["200001"],
    ["0"],
    [""],
    ["200000.0"],
    ["2e5"],
    ["-200000"],
    ["abc"],
    [" 200000"],
    ["0200000x"],
  ])("paid_amount %j -> 422, no effect", async (amount) => {
    const { deps, state } = setup();
    expect(
      await statusOf(
        handleGatewayCallback(deps, body({ paid_amount: amount })),
      ),
    ).toBe(422);
    expect(state.payments).toHaveLength(0);
    expect(state.bills.get(BILL)?.status).toBe("pending");
  });

  it("a paid_amount with leading zeros that equals the amount is accepted", async () => {
    const { deps, state } = setup();
    expect(
      await statusOf(
        handleGatewayCallback(deps, body({ paid_amount: "0200000" })),
      ),
    ).toBe(200);
    expect(state.payments).toHaveLength(1);
  });

  it.each([
    ["not a date"],
    ["2026-04-01 00:30:12"],
    ["2026-02-30 10:00:00 +0800"],
    [""],
  ])("paid_at %j -> 422, never falls back to now", async (paidAt) => {
    const { deps, state } = setup();
    expect(
      await statusOf(handleGatewayCallback(deps, body({ paid_at: paidAt }))),
    ).toBe(422);
    expect(state.payments).toHaveLength(0);
    expect(state.bills.get(BILL)?.status).toBe("pending");
  });

  it("missing paid_at -> 422", async () => {
    const { deps } = setup();
    expect(
      await statusOf(handleGatewayCallback(deps, body({ paid_at: undefined }))),
    ).toBe(422);
  });

  it.each([["yes"], ["TRUE"], ["1"], [""], [" true"]])(
    "paid %j -> 422",
    async (paid) => {
      const { deps, state } = setup();
      expect(await statusOf(handleGatewayCallback(deps, body({ paid })))).toBe(
        422,
      );
      expect(state.bills.get(BILL)?.status).toBe("pending");
    },
  );

  it("missing paid -> 422", async () => {
    const { deps } = setup();
    expect(
      await statusOf(handleGatewayCallback(deps, body({ paid: undefined }))),
    ).toBe(422);
  });
});

describe("paid=true", () => {
  it("creates exactly one approved online payment, received_at = paid_at, allocated, audited", async () => {
    const { deps, state } = setup();
    expect(await handleGatewayCallback(deps, body())).toEqual({ ok: true });
    expect(state.bills.get(BILL)).toMatchObject({
      status: "paid",
      transactionId: "TX-1",
    });
    expect(state.bills.get(BILL)?.paidAt?.toISOString()).toBe(
      "2026-03-31T16:30:12.000Z",
    );
    expect(state.payments).toHaveLength(1);
    expect(state.payments[0]).toMatchObject({
      orgId: ORG,
      leaseId: LEASE,
      amountSen: 200000,
      unappliedSen: 0,
      gatewayBillId: BILL,
      receivedAt: new Date("2026-03-31T16:30:12.000Z"),
      reviewedAt: new Date("2026-04-01T00:00:00Z"),
    });
    expect(state.allocations.map((a) => [a.invoiceId, a.amountSen])).toEqual([
      ["I1", 100000],
      ["I2", 100000],
    ]);
    expect(state.audits).toEqual([
      expect.objectContaining({
        orgId: ORG,
        action: "payment.approved",
        entityType: "payment",
        entityId: "pay-1",
        details: expect.objectContaining({ source: "gateway", billId: BILL }),
      }),
    ]);
  });

  it("the remainder after every invoice is paid becomes unapplied_sen", async () => {
    const { deps, state } = setup({ amountSen: 250000 });
    await handleGatewayCallback(deps, body({ paid_amount: "250000" }));
    expect(state.payments[0]?.unappliedSen).toBe(50000);
    expect(state.allocations.reduce((s, a) => s + a.amountSen, 0)).toBe(200000);
  });

  it("extra unknown fields still verify and are ignored", async () => {
    const { deps, state } = setup();
    expect(
      await statusOf(
        handleGatewayCallback(
          deps,
          body({}, KEY, { gateway_region: "my", future_flag: "1" }),
        ),
      ),
    ).toBe(200);
    expect(state.payments).toHaveLength(1);
  });

  it("an over-long or empty transaction_id is stored as null, not rejected", async () => {
    const { deps, state } = setup();
    await handleGatewayCallback(
      deps,
      body({ transaction_id: "x".repeat(300) }),
    );
    expect(state.bills.get(BILL)?.transactionId).toBeNull();
  });

  it("transaction_status is not used to decide (the brief's table decides on paid and paid_amount)", async () => {
    const { deps, state } = setup();
    expect(
      await statusOf(
        handleGatewayCallback(deps, body({ transaction_status: "pending" })),
      ),
    ).toBe(200);
    expect(state.payments).toHaveLength(1);
  });

  it("takes the lease lock before touching the bill", async () => {
    const { deps, calls } = setup();
    await handleGatewayCallback(deps, body());
    expect(calls.order.indexOf("lock")).toBeLessThan(
      calls.order.indexOf("markBillPaid"),
    );
  });

  it("repeat delivery -> 200, no second payment, allocation or audit row", async () => {
    const { deps, state } = setup();
    await handleGatewayCallback(deps, body());
    expect(await statusOf(handleGatewayCallback(deps, body()))).toBe(200);
    expect(state.payments).toHaveLength(1);
    expect(state.allocations).toHaveLength(2);
    expect(state.audits).toHaveLength(1);
  });

  it("an already-paid bill delivered a different transaction_id/paid_at changes nothing", async () => {
    const { deps, state } = setup();
    await handleGatewayCallback(deps, body());
    await handleGatewayCallback(
      deps,
      body({ transaction_id: "TX-2", paid_at: "2026-05-01 00:00:00 +0800" }),
    );
    expect(state.bills.get(BILL)?.transactionId).toBe("TX-1");
    expect(state.payments).toHaveLength(1);
  });

  it("five concurrent identical callbacks -> exactly one payment and one allocation set", async () => {
    const { deps, state } = setup();
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        statusOf(handleGatewayCallback(deps, body())),
      ),
    );
    expect(results).toEqual([200, 200, 200, 200, 200]);
    expect(state.payments).toHaveLength(1);
    expect(state.allocations).toHaveLength(2);
    expect(state.audits).toHaveLength(1);
  });

  it("a unique violation on gateway_bill_id means a concurrent winner: 200, no effect, no error log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps, state } = setup({
      throwOnInsert: Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
      }),
    });
    expect(await statusOf(handleGatewayCallback(deps, body()))).toBe(200);
    expect(state.payments).toHaveLength(0);
    expect(log).not.toHaveBeenCalled();
  });

  it("an unexpected database error -> generic 500, rolled back", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { deps, state } = setup({
      throwOnInsert: new Error("connection refused"),
    });
    expect(await statusOf(handleGatewayCallback(deps, body()))).toBe(500);
    expect(state.bills.get(BILL)?.status).toBe("pending");
  });
});

describe("paid=false and out-of-order delivery", () => {
  const failed = (extra: Record<string, string | undefined> = {}) =>
    body({
      paid: "false",
      paid_amount: "0",
      transaction_status: "failed",
      ...extra,
    });

  it("pending -> failed, 200", async () => {
    const { deps, state } = setup();
    expect(await handleGatewayCallback(deps, failed())).toEqual({ ok: true });
    expect(state.bills.get(BILL)?.status).toBe("failed");
    expect(state.payments).toHaveLength(0);
  });

  it("already failed -> 200, still failed", async () => {
    const { deps, state } = setup({ status: "failed" });
    expect(await statusOf(handleGatewayCallback(deps, failed()))).toBe(200);
    expect(state.bills.get(BILL)?.status).toBe("failed");
  });

  it("a paid bill never goes back: paid=false after paid -> 200, still paid, payment kept", async () => {
    const { deps, state } = setup();
    await handleGatewayCallback(deps, body());
    expect(await statusOf(handleGatewayCallback(deps, failed()))).toBe(200);
    expect(state.bills.get(BILL)?.status).toBe("paid");
    expect(state.payments).toHaveLength(1);
  });

  it("failed -> paid later (late success) works and creates the payment", async () => {
    const { deps, state } = setup();
    await handleGatewayCallback(deps, failed());
    expect(await statusOf(handleGatewayCallback(deps, body()))).toBe(200);
    expect(state.bills.get(BILL)?.status).toBe("paid");
    expect(state.payments).toHaveLength(1);
  });

  it("out of order: paid then failed then paid again ends paid with one payment", async () => {
    const { deps, state } = setup();
    for (const raw of [body(), failed(), body(), failed()])
      await handleGatewayCallback(deps, raw);
    expect(state.bills.get(BILL)?.status).toBe("paid");
    expect(state.payments).toHaveLength(1);
  });

  it("paid=false ignores paid_amount and paid_at entirely", async () => {
    const { deps, state } = setup();
    expect(
      await statusOf(
        handleGatewayCallback(
          deps,
          failed({ paid_amount: "999", paid_at: "garbage" }),
        ),
      ),
    ).toBe(200);
    expect(state.bills.get(BILL)?.status).toBe("failed");
  });

  it("concurrent paid=true and paid=false: the bill is never left failed after a payment exists", async () => {
    const { deps, state } = setup();
    await Promise.all([
      handleGatewayCallback(deps, body()),
      handleGatewayCallback(deps, failed()),
      handleGatewayCallback(deps, body()),
    ]);
    expect(state.payments).toHaveLength(1);
    expect(state.bills.get(BILL)?.status).toBe("paid");
  });
});

describe("logging", () => {
  it("never logs the key, the signature or any callback field", async () => {
    const spies = [
      vi.spyOn(console, "error"),
      vi.spyOn(console, "log"),
      vi.spyOn(console, "warn"),
      vi.spyOn(console, "info"),
    ].map((s) => s.mockImplementation(() => {}));
    const raw = body();
    const signature = new URLSearchParams(raw).get("x_signature") ?? "";

    const bad = setup();
    await statusOf(
      handleGatewayCallback(bad.deps, `${raw}&x_signature=${"0".repeat(64)}`),
    );
    await statusOf(handleGatewayCallback(bad.deps, body({ paid_amount: "1" })));
    const ok = setup();
    await handleGatewayCallback(ok.deps, raw);
    const broken = setup({
      throwOnInsert: new Error(
        `driver error quoting ${BILL} ${signature} ${KEY}`,
      ),
    });
    await statusOf(handleGatewayCallback(broken.deps, raw));

    const logged = spies
      .flatMap((s) => s.mock.calls)
      .flat()
      .map(String)
      .join("\n");
    for (const secret of [
      KEY,
      signature,
      BILL,
      "TX-1",
      "200000",
      "2026-04-01",
    ]) {
      expect(logged).not.toContain(secret);
    }
  });
});
