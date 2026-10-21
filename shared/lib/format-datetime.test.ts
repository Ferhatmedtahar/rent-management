import { describe, expect, it } from "vitest";
import {
  defaultMalaysiaNowInput,
  formatDateMyt,
  formatDateTimeMyt,
  formatMonthMyt,
  getLastNMonthsMyt,
  malaysiaInputToIso,
} from "./format-datetime";

describe("formatDateMyt", () => {
  it("formats date-only strings into 'D Mon YYYY' format without leading zeros", () => {
    expect(formatDateMyt("2026-01-31")).toBe("31 Jan 2026");
    expect(formatDateMyt("2026-03-01")).toBe("1 Mar 2026");
    expect(formatDateMyt("2024-02-29")).toBe("29 Feb 2024");
    expect(formatDateMyt("2026-12-25")).toBe("25 Dec 2026");
  });

  it("throws on malformed or out-of-range date strings", () => {
    expect(() => formatDateMyt("invalid")).toThrow(/Invalid date-only format/);
    expect(() => formatDateMyt("2026-1-31")).toThrow(
      /Invalid date-only format/,
    );
    expect(() => formatDateMyt("2026-13-01")).toThrow(/Date out of bounds/);
    expect(() => formatDateMyt("2026-00-10")).toThrow(/Date out of bounds/);
    expect(() => formatDateMyt("2026-05-32")).toThrow(/Date out of bounds/);
  });
});

describe("formatDateTimeMyt", () => {
  it("formats ISO timestamps in Malaysia time (UTC+8)", () => {
    // 12:30 AM MYT
    expect(formatDateTimeMyt("2026-03-01T00:30:00+08:00")).toBe(
      "1 Mar 2026, 12:30 AM",
    );
    // Same instant in UTC (Feb 28 16:30Z) produces identical output
    expect(formatDateTimeMyt("2026-02-28T16:30:00Z")).toBe(
      "1 Mar 2026, 12:30 AM",
    );
  });

  it("formats noon, midnight, and afternoon times correctly", () => {
    expect(formatDateTimeMyt("2026-06-15T00:00:00+08:00")).toBe(
      "15 Jun 2026, 12:00 AM",
    );
    expect(formatDateTimeMyt("2026-06-15T12:00:00+08:00")).toBe(
      "15 Jun 2026, 12:00 PM",
    );
    expect(formatDateTimeMyt("2026-06-15T15:45:00+08:00")).toBe(
      "15 Jun 2026, 3:45 PM",
    );
    expect(formatDateTimeMyt("2026-06-15T23:59:00+08:00")).toBe(
      "15 Jun 2026, 11:59 PM",
    );
  });

  it("throws on invalid ISO strings", () => {
    expect(() => formatDateTimeMyt("not-a-date")).toThrow(/Invalid ISO date/);
  });
});

describe("malaysiaInputToIso", () => {
  it("converts datetime-local value to ISO with +08:00 offset", () => {
    expect(malaysiaInputToIso("2026-03-01T00:30")).toBe(
      "2026-03-01T00:30:00+08:00",
    );
    expect(malaysiaInputToIso("2026-03-01T15:45:20")).toBe(
      "2026-03-01T15:45:20+08:00",
    );
  });

  it("rejects malformed or out-of-range datetime-local inputs", () => {
    expect(() => malaysiaInputToIso("")).toThrow(
      /Invalid datetime-local value/,
    );
    expect(() => malaysiaInputToIso("2026-03-01")).toThrow(
      /Invalid datetime-local value/,
    );
    expect(() => malaysiaInputToIso("2026-13-01T00:00")).toThrow(
      /Datetime-local values out of range/,
    );
    expect(() => malaysiaInputToIso("2026-03-01T25:00")).toThrow(
      /Datetime-local values out of range/,
    );
    expect(() => malaysiaInputToIso("2026-03-01T12:65")).toThrow(
      /Datetime-local values out of range/,
    );
  });
});

describe("defaultMalaysiaNowInput", () => {
  it("produces YYYY-MM-DDTHH:mm representing Malaysia local time", () => {
    // 2026-03-01 16:30 UTC -> 2026-03-02 00:30 MYT
    const instant1 = new Date("2026-03-01T16:30:00.000Z");
    expect(defaultMalaysiaNowInput(instant1)).toBe("2026-03-02T00:30");

    // 2026-01-31 02:00 UTC -> 2026-01-31 10:00 MYT
    const instant2 = new Date("2026-01-31T02:00:00.000Z");
    expect(defaultMalaysiaNowInput(instant2)).toBe("2026-01-31T10:00");
  });
});

describe("formatMonthMyt", () => {
  it("formats YYYY-MM strings correctly", () => {
    expect(formatMonthMyt("2026-01")).toBe("Jan 2026");
    expect(formatMonthMyt("2026-03")).toBe("Mar 2026");
    expect(formatMonthMyt("2025-12")).toBe("Dec 2025");
  });

  it("throws on malformed inputs", () => {
    expect(() => formatMonthMyt("2026-1")).toThrow();
    expect(() => formatMonthMyt("2026-13")).toThrow();
  });
});

describe("getLastNMonthsMyt", () => {
  it("computes last 6 months range across new year boundary", () => {
    // 2026-02-15 10:00 MYT -> last 6 months: Sep 2025 to Feb 2026
    const now = new Date("2026-02-15T02:00:00Z");
    const range = getLastNMonthsMyt(now, 6);
    expect(range.from).toBe("2025-09");
    expect(range.to).toBe("2026-02");
    expect(range.months).toEqual([
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
});
