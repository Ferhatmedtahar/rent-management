import { describe, expect, it } from "vitest";
import type { AllocatableInvoice } from "../types/payment.types";
import { allocatePayment } from "./allocation";

const inv = (
  id: string,
  kind: "deposit" | "rent",
  periodIndex: number | null,
  dueDate: string,
  amountSen: number,
  allocatedSen = 0,
): AllocatableInvoice => ({
  id,
  kind,
  periodIndex,
  dueDate,
  amountSen,
  allocatedSen,
});

// Aisyah's schedule (deposit 300000, rents 150000, last 77419).
const aisyah = (allocated: Record<string, number> = {}) => [
  inv("P0", "rent", 0, "2026-01-31", 150000, allocated.P0),
  inv("DEP", "deposit", null, "2026-01-31", 300000, allocated.DEP),
  inv("P1", "rent", 1, "2026-02-28", 150000, allocated.P1),
  inv("P2", "rent", 2, "2026-03-31", 150000, allocated.P2),
  inv("P3", "rent", 3, "2026-04-30", 150000, allocated.P3),
  inv("P4", "rent", 4, "2026-05-31", 150000, allocated.P4),
  inv("P5", "rent", 5, "2026-06-30", 77419, allocated.P5),
];

describe("allocatePayment", () => {
  it("Aisyah: RM 3,000 cash goes entirely to the deposit (deposit before rent on the same due date)", () => {
    expect(allocatePayment(300000, aisyah())).toEqual({
      allocations: [{ invoiceId: "DEP", amountSen: 300000 }],
      unappliedSen: 0,
    });
  });

  it("Aisyah: the RM 2,000 bank transfer then fills P0 and part of P1", () => {
    expect(allocatePayment(200000, aisyah({ DEP: 300000 }))).toEqual({
      allocations: [
        { invoiceId: "P0", amountSen: 150000 },
        { invoiceId: "P1", amountSen: 50000 },
      ],
      unappliedSen: 0,
    });
  });

  it("exact fill of one invoice leaves nothing for the next", () => {
    expect(
      allocatePayment(150000, [
        inv("A", "rent", 0, "2026-01-01", 150000),
        inv("B", "rent", 1, "2026-02-01", 150000),
      ]),
    ).toEqual({
      allocations: [{ invoiceId: "A", amountSen: 150000 }],
      unappliedSen: 0,
    });
  });

  it("a partial payment leaves the invoice partly paid", () => {
    expect(
      allocatePayment(40000, [inv("A", "rent", 0, "2026-01-01", 150000)]),
    ).toEqual({
      allocations: [{ invoiceId: "A", amountSen: 40000 }],
      unappliedSen: 0,
    });
  });

  it("continues from a partly paid invoice (only the unpaid part is filled)", () => {
    expect(
      allocatePayment(120000, [
        inv("A", "rent", 0, "2026-01-01", 150000, 100000),
        inv("B", "rent", 1, "2026-02-01", 150000),
      ]),
    ).toEqual({
      allocations: [
        { invoiceId: "A", amountSen: 50000 },
        { invoiceId: "B", amountSen: 70000 },
      ],
      unappliedSen: 0,
    });
  });

  it("the remainder after every invoice is full becomes unapplied", () => {
    expect(
      allocatePayment(500, [inv("A", "rent", 0, "2026-01-01", 200)]),
    ).toEqual({
      allocations: [{ invoiceId: "A", amountSen: 200 }],
      unappliedSen: 300,
    });
  });

  it("fills invoices that are not yet due (future periods)", () => {
    const result = allocatePayment(400000, aisyah({ DEP: 300000 }));
    expect(result.allocations.map((a) => a.invoiceId)).toEqual([
      "P0",
      "P1",
      "P2",
    ]);
    expect(result.allocations.at(-1)).toEqual({
      invoiceId: "P2",
      amountSen: 100000,
    });
  });

  it("orders by due date first, whatever the input order", () => {
    const result = allocatePayment(300, [
      inv("LATE", "rent", 1, "2026-03-01", 100),
      inv("EARLY", "rent", 0, "2026-01-01", 100),
      inv("MID", "rent", 5, "2026-02-01", 100),
    ]);
    expect(result.allocations.map((a) => a.invoiceId)).toEqual([
      "EARLY",
      "MID",
      "LATE",
    ]);
  });

  it("with equal due dates, deposit goes before rent, then period index", () => {
    const result = allocatePayment(1000, [
      inv("R1", "rent", 1, "2026-01-01", 100),
      inv("R0", "rent", 0, "2026-01-01", 100),
      inv("DEP", "deposit", null, "2026-01-01", 100),
    ]);
    expect(result.allocations.map((a) => a.invoiceId)).toEqual([
      "DEP",
      "R0",
      "R1",
    ]);
  });

  it("skips fully paid invoices", () => {
    expect(
      allocatePayment(100, [
        inv("A", "rent", 0, "2026-01-01", 100, 100),
        inv("B", "rent", 1, "2026-02-01", 100),
      ]),
    ).toEqual({
      allocations: [{ invoiceId: "B", amountSen: 100 }],
      unappliedSen: 0,
    });
  });

  it("does not mutate its input", () => {
    const input = aisyah();
    const copy = JSON.stringify(input);
    allocatePayment(100000, input);
    expect(JSON.stringify(input)).toBe(copy);
  });

  it("allocations plus unapplied always equal the payment", () => {
    for (const amount of [1, 99999, 300000, 1127419, 2000000]) {
      const { allocations, unappliedSen } = allocatePayment(amount, aisyah());
      expect(
        allocations.reduce((sum, a) => sum + a.amountSen, 0) + unappliedSen,
      ).toBe(amount);
    }
  });
});
