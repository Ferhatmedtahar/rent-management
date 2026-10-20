import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  generateSchedule,
  invoiceStatus,
  parseRinggitToSen,
  type ScheduledInvoice,
} from "./billing";

type Lease = Parameters<typeof generateSchedule>[0];

const lease = (overrides: Partial<Lease> = {}): Lease => ({
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  monthlyRentSen: 100000,
  depositSen: 0,
  ...overrides,
});

const rent = (
  periodIndex: number,
  periodStart: string,
  periodEnd: string,
  amountSen: number,
  dueDate = periodStart,
): ScheduledInvoice => ({
  kind: "rent",
  periodIndex,
  periodStart,
  periodEnd,
  dueDate,
  amountSen,
});

const deposit = (dueDate: string, amountSen: number): ScheduledInvoice => ({
  kind: "deposit",
  periodIndex: null,
  periodStart: null,
  periodEnd: null,
  dueDate,
  amountSen,
});

// Test-side calendar helper (UTC only, so it is timezone independent too).
const addDays = (isoDate: string, days: number): string => {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
};

describe("generateSchedule: seeded leases from the brief", () => {
  it("Aisyah: deposit + 6 rent periods, last prorated to 77419 sen", () => {
    expect(
      generateSchedule({
        startDate: "2026-01-31",
        endDate: "2026-07-15",
        monthlyRentSen: 150000,
        depositSen: 300000,
      }),
    ).toEqual([
      deposit("2026-01-31", 300000),
      rent(0, "2026-01-31", "2026-02-27", 150000),
      rent(1, "2026-02-28", "2026-03-30", 150000),
      rent(2, "2026-03-31", "2026-04-29", 150000),
      rent(3, "2026-04-30", "2026-05-30", 150000),
      rent(4, "2026-05-31", "2026-06-29", 150000),
      rent(5, "2026-06-30", "2026-07-15", 77419),
    ]);
  });

  it("Ben: 4 invoices, last 50015 = half-up of 50014.5 (100029 x 15 / 30)", () => {
    expect(
      generateSchedule({
        startDate: "2026-01-01",
        endDate: "2026-04-15",
        monthlyRentSen: 100029,
        depositSen: 0,
      }),
    ).toEqual([
      rent(0, "2026-01-01", "2026-01-31", 100029),
      rent(1, "2026-02-01", "2026-02-28", 100029),
      rent(2, "2026-03-01", "2026-03-31", 100029),
      rent(3, "2026-04-01", "2026-04-15", 50015),
    ]);
  });

  it("Probe: 13 invoices, the last period ends on the lease end day and is full", () => {
    const schedule = generateSchedule({
      startDate: "2026-02-28",
      endDate: "2027-02-27",
      monthlyRentSen: 200000,
      depositSen: 400000,
    });
    expect(schedule).toHaveLength(13);
    expect(schedule[0]).toEqual(deposit("2026-02-28", 400000));
    expect(schedule[1]).toEqual(rent(0, "2026-02-28", "2026-03-27", 200000));
    expect(schedule[12]).toEqual(rent(11, "2027-01-28", "2027-02-27", 200000));
  });

  it("Chen: 13 invoices, the last period ends on the lease end day and is full", () => {
    const schedule = generateSchedule({
      startDate: "2026-03-15",
      endDate: "2027-03-14",
      monthlyRentSen: 220000,
      depositSen: 440000,
    });
    expect(schedule).toHaveLength(13);
    expect(schedule[0]).toEqual(deposit("2026-03-15", 440000));
    expect(schedule[12]).toEqual(rent(11, "2027-02-15", "2027-03-14", 220000));
  });

  it("the four seeded leases give 37 invoices in total", () => {
    const counts = [
      generateSchedule({
        startDate: "2026-01-31",
        endDate: "2026-07-15",
        monthlyRentSen: 150000,
        depositSen: 300000,
      }).length,
      generateSchedule({
        startDate: "2026-01-01",
        endDate: "2026-04-15",
        monthlyRentSen: 100029,
        depositSen: 0,
      }).length,
      generateSchedule({
        startDate: "2026-02-28",
        endDate: "2027-02-27",
        monthlyRentSen: 200000,
        depositSen: 400000,
      }).length,
      generateSchedule({
        startDate: "2026-03-15",
        endDate: "2027-03-14",
        monthlyRentSen: 220000,
        depositSen: 440000,
      }).length,
    ];
    expect(counts.reduce((a, b) => a + b, 0)).toBe(37);
  });
});

describe("generateSchedule: anchors and month ends", () => {
  it("Jan 31 anchors in a leap year: Feb 29, Mar 31, Apr 30, ... never drifting", () => {
    const schedule = generateSchedule(
      lease({ startDate: "2024-01-31", endDate: "2024-06-30" }),
    );
    expect(schedule.map((i) => i.periodStart)).toEqual([
      "2024-01-31",
      "2024-02-29",
      "2024-03-31",
      "2024-04-30",
      "2024-05-31",
      "2024-06-30",
    ]);
    expect(schedule.map((i) => i.periodEnd)).toEqual([
      "2024-02-28",
      "2024-03-30",
      "2024-04-29",
      "2024-05-30",
      "2024-06-29",
      "2024-06-30",
    ]);
    expect(schedule.map((i) => i.dueDate)).toEqual(
      schedule.map((i) => i.periodStart),
    );
    // Last period: 1 day of the 31-day period 06-30..07-30 => 100000 / 31 = 3225.8 -> 3226.
    expect(schedule.at(-1)?.amountSen).toBe(3226);
  });

  it("Jan 31 anchors in a non-leap year: Feb 28, Mar 31", () => {
    const schedule = generateSchedule(
      lease({ startDate: "2025-01-31", endDate: "2025-04-29" }),
    );
    expect(schedule.map((i) => i.periodStart)).toEqual([
      "2025-01-31",
      "2025-02-28",
      "2025-03-31",
    ]);
    expect(schedule.map((i) => i.periodEnd)).toEqual([
      "2025-02-27",
      "2025-03-30",
      "2025-04-29",
    ]);
    expect(schedule.every((i) => i.amountSen === 100000)).toBe(true);
  });

  it("anchors are counted from the start date: a Dec 30 start clamps Feb but returns to the 30th in Jan and Mar", () => {
    const schedule = generateSchedule(
      lease({ startDate: "2025-12-30", endDate: "2026-04-29" }),
    );
    expect(schedule.map((i) => i.periodStart)).toEqual([
      "2025-12-30",
      "2026-01-30",
      "2026-02-28",
      "2026-03-30",
    ]);
  });

  it("crosses a year boundary", () => {
    const schedule = generateSchedule(
      lease({ startDate: "2026-11-15", endDate: "2027-02-14" }),
    );
    expect(schedule.map((i) => i.periodStart)).toEqual([
      "2026-11-15",
      "2026-12-15",
      "2027-01-15",
    ]);
  });
});

describe("generateSchedule: last period and edge leases", () => {
  it("a one-day lease is one prorated period (1/31 of 3100 = 100)", () => {
    expect(
      generateSchedule(
        lease({
          startDate: "2026-05-10",
          endDate: "2026-05-10",
          monthlyRentSen: 3100,
        }),
      ),
    ).toEqual([rent(0, "2026-05-10", "2026-05-10", 100)]);
  });

  it("a one-day lease with a deposit has the deposit first", () => {
    expect(
      generateSchedule(
        lease({
          startDate: "2026-05-10",
          endDate: "2026-05-10",
          monthlyRentSen: 3100,
          depositSen: 5000,
        }),
      ),
    ).toEqual([
      deposit("2026-05-10", 5000),
      rent(0, "2026-05-10", "2026-05-10", 100),
    ]);
  });

  it("end date exactly on an anchor gets a one-day prorated last period", () => {
    // Anchors: Jan 15, Feb 15, Mar 15. Last period Mar 15..Mar 15 = 1 of 31 days.
    // 90000 / 31 = 2903.2 -> 2903.
    expect(
      generateSchedule(
        lease({
          startDate: "2026-01-15",
          endDate: "2026-03-15",
          monthlyRentSen: 90000,
        }),
      ),
    ).toEqual([
      rent(0, "2026-01-15", "2026-02-14", 90000),
      rent(1, "2026-02-15", "2026-03-14", 90000),
      rent(2, "2026-03-15", "2026-03-15", 2903),
    ]);
  });

  it("end date on the last day of a full period is not prorated", () => {
    expect(
      generateSchedule(
        lease({
          startDate: "2026-01-15",
          endDate: "2026-02-14",
          monthlyRentSen: 90000,
        }),
      ),
    ).toEqual([rent(0, "2026-01-15", "2026-02-14", 90000)]);
  });

  it("a lease shorter than one period is a single prorated period", () => {
    // 10 of 28 days (Feb 1..Feb 28): 100000 x 10 / 28 = 35714.28 -> 35714.
    expect(
      generateSchedule(
        lease({ startDate: "2026-02-01", endDate: "2026-02-10" }),
      ),
    ).toEqual([rent(0, "2026-02-01", "2026-02-10", 35714)]);
  });

  it("proration rounds half up, never half even or down", () => {
    // 1 of 2 days is impossible in a calendar month; use 15/30: 3 x 15 / 30 = 1.5 -> 2.
    expect(
      generateSchedule(
        lease({
          startDate: "2026-04-01",
          endDate: "2026-04-15",
          monthlyRentSen: 3,
        }),
      )[0]?.amountSen,
    ).toBe(2);
    // 1 x 15 / 30 = 0.5 -> 1.
    expect(
      generateSchedule(
        lease({
          startDate: "2026-04-01",
          endDate: "2026-04-15",
          monthlyRentSen: 1,
        }),
      )[0]?.amountSen,
    ).toBe(1);
  });

  it("uses exact integer math for amounts near the safe-integer limit", () => {
    const rentSen = Number.MAX_SAFE_INTEGER; // 9007199254740991
    const [only] = generateSchedule(
      lease({
        startDate: "2026-04-01",
        endDate: "2026-04-30",
        monthlyRentSen: rentSen,
      }),
    );
    expect(only?.amountSen).toBe(rentSen); // full period: untouched
    const [part] = generateSchedule(
      lease({
        startDate: "2026-04-01",
        endDate: "2026-04-15",
        monthlyRentSen: rentSen,
      }),
    );
    // 15/30 of an odd number: exactly half rounded up.
    expect(part?.amountSen).toBe((rentSen + 1) / 2);
  });
});

describe("generateSchedule: deposit", () => {
  it("depositSen 0 produces no deposit invoice", () => {
    const schedule = generateSchedule(lease({ depositSen: 0 }));
    expect(schedule.some((i) => i.kind === "deposit")).toBe(false);
    expect(schedule[0]?.kind).toBe("rent");
  });

  it("depositSen > 0 produces exactly one deposit, first, due on the start date", () => {
    const schedule = generateSchedule(
      lease({ startDate: "2026-03-20", depositSen: 12345 }),
    );
    expect(schedule[0]).toEqual(deposit("2026-03-20", 12345));
    expect(schedule.filter((i) => i.kind === "deposit")).toHaveLength(1);
    expect(schedule[1]?.kind).toBe("rent");
    expect(schedule[1]?.periodIndex).toBe(0);
  });
});

describe("generateSchedule: invariants over every start day", () => {
  it("periods are contiguous, indexed from 0, start at the start date and end at the end date", () => {
    for (let offset = 0; offset < 731; offset += 1) {
      const startDate = addDays("2024-01-01", offset);
      for (const days of [0, 27, 30, 58, 364, 400]) {
        const endDate = addDays(startDate, days);
        const rentRows = generateSchedule(
          lease({ startDate, endDate, monthlyRentSen: 123457 }),
        );
        expect(rentRows[0]?.periodStart).toBe(startDate);
        expect(rentRows.at(-1)?.periodEnd).toBe(endDate);
        rentRows.forEach((row, index) => {
          expect(row.periodIndex).toBe(index);
          expect(row.dueDate).toBe(row.periodStart);
          expect(row.amountSen).toBeGreaterThanOrEqual(0);
          expect(row.amountSen).toBeLessThanOrEqual(123457);
          const next = rentRows[index + 1];
          if (next) expect(next.periodStart).toBe(addDays(row.periodEnd!, 1));
        });
      }
    }
  });
});

describe("generateSchedule: validation", () => {
  const invalid: [string, unknown][] = [
    ["2026-02-30", "2026-02-30"],
    ["2026-13-01", "2026-13-01"],
    ["2026-00-10", "2026-00-10"],
    ["2026-01-00", "2026-01-00"],
    ["2026-01-32", "2026-01-32"],
    ["2025-02-29 (not a leap year)", "2025-02-29"],
    ["1900-02-29 (century, not a leap year)", "1900-02-29"],
    ["2026-1-1", "2026-1-1"],
    ["20260101", "20260101"],
    ["2026/01/01", "2026/01/01"],
    ["2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"],
    [" 2026-01-01", " 2026-01-01"],
    ["2026-01-01 ", "2026-01-01 "],
    ["empty string", ""],
    ["a number", 20260101],
    ["null", null],
    ["undefined", undefined],
    ["a Date", new Date("2026-01-01T00:00:00Z")],
  ];

  it.each(invalid)("rejects startDate %s", (_label, value) => {
    expect(() =>
      generateSchedule(lease({ startDate: value as never })),
    ).toThrow(Error);
  });

  it.each(invalid)("rejects endDate %s", (_label, value) => {
    expect(() => generateSchedule(lease({ endDate: value as never }))).toThrow(
      Error,
    );
  });

  it("accepts real leap days", () => {
    expect(() =>
      generateSchedule(
        lease({ startDate: "2024-02-29", endDate: "2024-03-01" }),
      ),
    ).not.toThrow();
    expect(() =>
      generateSchedule(
        lease({ startDate: "2000-02-29", endDate: "2000-03-01" }),
      ),
    ).not.toThrow();
  });

  it("rejects endDate before startDate", () => {
    expect(() =>
      generateSchedule(
        lease({ startDate: "2026-05-10", endDate: "2026-05-09" }),
      ),
    ).toThrow(Error);
  });

  it("accepts endDate equal to startDate", () => {
    expect(() =>
      generateSchedule(
        lease({ startDate: "2026-05-10", endDate: "2026-05-10" }),
      ),
    ).not.toThrow();
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["fractional", 1.5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["above the safe-integer range", 2 ** 53],
    ["a numeric string", "1000"],
    ["null", null],
    ["undefined", undefined],
  ])("rejects monthlyRentSen that is %s", (_label, value) => {
    expect(() =>
      generateSchedule(lease({ monthlyRentSen: value as never })),
    ).toThrow(Error);
  });

  it.each([
    ["negative", -1],
    ["fractional", 0.5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["above the safe-integer range", 2 ** 53],
    ["a numeric string", "1000"],
    ["null", null],
    ["undefined", undefined],
  ])("rejects depositSen that is %s", (_label, value) => {
    expect(() =>
      generateSchedule(lease({ depositSen: value as never })),
    ).toThrow(Error);
  });

  it("rejects a non-object lease", () => {
    expect(() => generateSchedule(null as never)).toThrow(Error);
    expect(() => generateSchedule(undefined as never)).toThrow(Error);
  });

  it("accepts the largest safe amounts", () => {
    expect(() =>
      generateSchedule(
        lease({
          monthlyRentSen: Number.MAX_SAFE_INTEGER,
          depositSen: Number.MAX_SAFE_INTEGER,
        }),
      ),
    ).not.toThrow();
  });
});

describe("invoiceStatus", () => {
  // Due 2026-03-01 => overdue from 2026-03-02 00:00 Malaysia = 2026-03-01T16:00:00Z.
  const due = { dueDate: "2026-03-01", amountSen: 100000 };

  it("is unpaid one second before the overdue boundary", () => {
    expect(
      invoiceStatus({ ...due, paidSen: 0 }, new Date("2026-03-01T15:59:59Z")),
    ).toBe("unpaid");
  });

  it("is overdue exactly at 2026-03-01T16:00:00Z", () => {
    expect(
      invoiceStatus({ ...due, paidSen: 0 }, new Date("2026-03-01T16:00:00Z")),
    ).toBe("overdue");
  });

  it("is overdue one millisecond after the boundary", () => {
    expect(
      invoiceStatus(
        { ...due, paidSen: 0 },
        new Date("2026-03-01T16:00:00.001Z"),
      ),
    ).toBe("overdue");
  });

  it("is unpaid on the due day itself, from its first to its last Malaysia second", () => {
    // 2026-03-01 00:00 MYT = 2026-02-28T16:00:00Z.
    expect(
      invoiceStatus({ ...due, paidSen: 0 }, new Date("2026-02-28T16:00:00Z")),
    ).toBe("unpaid");
    expect(
      invoiceStatus(
        { ...due, paidSen: 0 },
        new Date("2026-03-01T15:59:59.999Z"),
      ),
    ).toBe("unpaid");
  });

  it("is unpaid before the due date", () => {
    expect(
      invoiceStatus({ ...due, paidSen: 0 }, new Date("2026-02-28T15:59:59Z")),
    ).toBe("unpaid");
  });

  it("is paid when paidSen equals amountSen, before or after the due date", () => {
    const invoice = { ...due, paidSen: 100000 };
    expect(invoiceStatus(invoice, new Date("2026-01-01T00:00:00Z"))).toBe(
      "paid",
    );
    expect(invoiceStatus(invoice, new Date("2026-06-01T00:00:00Z"))).toBe(
      "paid",
    );
  });

  it("is paid when paidSen exceeds amountSen", () => {
    expect(
      invoiceStatus(
        { ...due, paidSen: 100001 },
        new Date("2026-06-01T00:00:00Z"),
      ),
    ).toBe("paid");
  });

  it("is partially_paid when something is paid and the invoice is not yet overdue", () => {
    expect(
      invoiceStatus({ ...due, paidSen: 1 }, new Date("2026-03-01T15:59:59Z")),
    ).toBe("partially_paid");
    expect(
      invoiceStatus(
        { ...due, paidSen: 99999 },
        new Date("2026-02-01T00:00:00Z"),
      ),
    ).toBe("partially_paid");
  });

  it("overdue wins over partially_paid", () => {
    expect(
      invoiceStatus(
        { ...due, paidSen: 99999 },
        new Date("2026-03-01T16:00:00Z"),
      ),
    ).toBe("overdue");
  });

  it("handles a year boundary: due 2026-12-31 is overdue from 2026-12-31T16:00:00Z", () => {
    const invoice = { dueDate: "2026-12-31", amountSen: 5, paidSen: 0 };
    expect(invoiceStatus(invoice, new Date("2026-12-31T15:59:59Z"))).toBe(
      "unpaid",
    );
    expect(invoiceStatus(invoice, new Date("2026-12-31T16:00:00Z"))).toBe(
      "overdue",
    );
  });

  it("handles a leap day: due 2024-02-28 is overdue on Malaysia's Feb 29", () => {
    const invoice = { dueDate: "2024-02-28", amountSen: 5, paidSen: 0 };
    expect(invoiceStatus(invoice, new Date("2024-02-28T15:59:59Z"))).toBe(
      "unpaid",
    );
    expect(invoiceStatus(invoice, new Date("2024-02-28T16:00:00Z"))).toBe(
      "overdue",
    );
  });

  it("uses Malaysia's date, not UTC's: late evening UTC is already tomorrow in Malaysia", () => {
    // 2026-03-01T20:00Z is 2026-03-02 04:00 MYT => overdue, although UTC date == due date.
    expect(
      invoiceStatus({ ...due, paidSen: 0 }, new Date("2026-03-01T20:00:00Z")),
    ).toBe("overdue");
  });

  it("throws on a malformed or impossible dueDate", () => {
    for (const dueDate of ["2026-02-30", "03/01/2026", "", "2026-3-1"]) {
      expect(() =>
        invoiceStatus(
          { dueDate, amountSen: 1, paidSen: 0 },
          new Date("2026-03-01T00:00:00Z"),
        ),
      ).toThrow(Error);
    }
  });

  it("throws on an invalid Date", () => {
    expect(() =>
      invoiceStatus({ ...due, paidSen: 0 }, new Date("not a date")),
    ).toThrow(Error);
  });
});

describe("parseRinggitToSen: valid input", () => {
  it.each([
    ["1,500.50", 150050],
    ["1.15", 115],
    ["7", 700],
    ["  7  ", 700],
    ["\t1,500.50\n", 150050],
    ["0", 0],
    ["0.5", 50],
    ["0.05", 5],
    ["0.00", 0],
    ["1.5", 150],
    ["1.50", 150],
    ["1,500", 150000],
    ["1000", 100000],
    ["1,234,567.89", 123456789],
    ["999", 99900],
    ["999,999,999", 99999999900],
    // Documented choice: a leading group of 1 to 3 digits is allowed, even "01"; same as "007".
    ["01,500", 150000],
    ["007", 700],
    ["90071992547409.91", 9007199254740991],
  ])("parses %j to %d sen", (input, expected) => {
    expect(parseRinggitToSen(input)).toBe(expected);
  });
});

describe("parseRinggitToSen: invalid input", () => {
  it.each([
    [""],
    ["   "],
    ["-5"],
    ["+5"],
    ["1.234"],
    ["1,234.567"],
    ["1e3"],
    ["RM 10"],
    ["RM10"],
    ["10 RM"],
    ["1,23"],
    ["1,50"],
    ["1,5000"],
    ["1,,500"],
    [",500"],
    ["1,500,"],
    [".5"],
    ["5."],
    ["1.2.3"],
    ["1 500"],
    ["1, 500"],
    ["1_000"],
    ["0x10"],
    ["abc"],
    ["NaN"],
    ["Infinity"],
    ["１２"], // full-width digits
    ["9007199254740993"],
    ["90071992547409.92"],
    ["99999999999999999999"],
  ])("throws on %j", (input) => {
    expect(() => parseRinggitToSen(input)).toThrow(Error);
  });

  it("throws on non-string input", () => {
    for (const value of [5, null, undefined, {}, [], true]) {
      expect(() => parseRinggitToSen(value as never)).toThrow(Error);
    }
  });
});

describe("lib/billing.ts stays pure", () => {
  const source = readFileSync(resolve(process.cwd(), "lib/billing.ts"), "utf8")
    // Comments may mention anything; only code is checked.
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("has no imports or requires", () => {
    expect(source).not.toMatch(/^\s*import\s/m);
    expect(source).not.toMatch(/\brequire\s*\(/);
    expect(source).not.toMatch(/\bimport\s*\(/);
  });

  it("uses no local-time Date API or machine-dependent global", () => {
    for (const forbidden of [
      "getDate",
      "getDay",
      "getFullYear",
      "getHours",
      "getMinutes",
      "getMonth",
      "getSeconds",
      "getMilliseconds",
      "getTimezoneOffset",
      "setDate",
      "setFullYear",
      "setHours",
      "setMonth",
      "toLocaleDateString",
      "toLocaleString",
      "toLocaleTimeString",
      "toDateString",
      "toTimeString",
      "Intl",
      "Date.now",
      "new Date",
    ]) {
      expect(source, forbidden).not.toContain(forbidden);
    }
  });
});
