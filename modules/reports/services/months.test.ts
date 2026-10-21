import { describe, expect, it } from "vitest";
import {
  formatMonth,
  listMonths,
  malaysiaMonthOf,
  monthCount,
  monthEndExclusive,
  monthStartInstant,
  parseMonth,
} from "./months";

describe("parseMonth", () => {
  it.each([
    ["2026-01", 2026, 1],
    ["2026-12", 2026, 12],
    ["1000-06", 1000, 6],
    ["9999-12", 9999, 12],
  ])("%s", (v, year, month) => {
    expect(parseMonth(v)).toEqual({ year, month });
  });
  it.each([
    [""],
    ["2026-00"],
    ["2026-13"],
    ["2026-1"],
    ["26-01"],
    ["0000-01"],
    ["0999-12"],
    ["2026-01-01"],
    ["2026/01"],
    [" 2026-01"],
    ["2026-01 "],
    ["abcd-ef"],
    ["2026-1a"],
  ])("rejects %j", (v) => {
    expect(parseMonth(v)).toBeNull();
  });
});

describe("listMonths / monthCount", () => {
  it("is inclusive and ordered, with year rollover", () => {
    expect(
      listMonths({ year: 2025, month: 11 }, { year: 2026, month: 2 }),
    ).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
  it("from == to is one month", () => {
    expect(
      listMonths({ year: 2026, month: 3 }, { year: 2026, month: 3 }),
    ).toEqual(["2026-03"]);
    expect(monthCount({ year: 2026, month: 3 }, { year: 2026, month: 3 })).toBe(
      1,
    );
  });
  it("counts across years and reports reversed ranges as < 1", () => {
    expect(
      monthCount({ year: 2021, month: 1 }, { year: 2025, month: 12 }),
    ).toBe(60);
    expect(monthCount({ year: 2026, month: 3 }, { year: 2026, month: 2 })).toBe(
      0,
    );
  });
  it("formatMonth pads", () => {
    expect(formatMonth({ year: 2026, month: 3 })).toBe("2026-03");
  });
});

describe("Malaysia month bounds", () => {
  it("a month starts at 16:00Z the day before", () => {
    expect(monthStartInstant({ year: 2026, month: 3 }).toISOString()).toBe(
      "2026-02-28T16:00:00.000Z",
    );
    expect(monthStartInstant({ year: 2026, month: 1 }).toISOString()).toBe(
      "2025-12-31T16:00:00.000Z",
    );
  });
  it("the end is the next month's start, across a year end and a leap February", () => {
    expect(monthEndExclusive({ year: 2025, month: 12 }).toISOString()).toBe(
      "2025-12-31T16:00:00.000Z",
    );
    expect(monthEndExclusive({ year: 2024, month: 2 }).toISOString()).toBe(
      "2024-02-29T16:00:00.000Z",
    );
  });
  it("malaysiaMonthOf respects the boundary to the millisecond", () => {
    expect(malaysiaMonthOf(new Date("2026-02-28T15:59:59.999Z"))).toBe(
      "2026-02",
    );
    expect(malaysiaMonthOf(new Date("2026-02-28T16:00:00.000Z"))).toBe(
      "2026-03",
    );
    expect(malaysiaMonthOf(new Date("2025-12-31T16:00:00Z"))).toBe("2026-01");
  });
});
