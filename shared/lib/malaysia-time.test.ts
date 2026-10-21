import { describe, expect, it } from "vitest";
import { todayInMalaysia, toMalaysiaIso } from "./malaysia-time";

describe("todayInMalaysia", () => {
  it("is still the same day at 15:59:59Z", () => {
    expect(todayInMalaysia(new Date("2026-03-01T15:59:59Z"))).toBe(
      "2026-03-01",
    );
  });
  it("moves to the next day at 16:00:00Z (midnight in Kuala Lumpur)", () => {
    expect(todayInMalaysia(new Date("2026-03-01T16:00:00Z"))).toBe(
      "2026-03-02",
    );
  });
  it("crosses month, year and leap-day boundaries", () => {
    expect(todayInMalaysia(new Date("2026-12-31T16:00:00Z"))).toBe(
      "2027-01-01",
    );
    expect(todayInMalaysia(new Date("2024-02-28T16:00:00Z"))).toBe(
      "2024-02-29",
    );
    expect(todayInMalaysia(new Date("2025-02-28T16:00:00Z"))).toBe(
      "2025-03-01",
    );
  });
});

describe("toMalaysiaIso", () => {
  it("formats an instant with the +08:00 offset", () => {
    expect(toMalaysiaIso(new Date("2026-02-28T16:30:00Z"))).toBe(
      "2026-03-01T00:30:00.000+08:00",
    );
    expect(toMalaysiaIso(new Date("2026-01-31T02:00:00Z"))).toBe(
      "2026-01-31T10:00:00.000+08:00",
    );
  });
  it("round-trips to the same instant", () => {
    const instant = new Date("2026-06-15T13:45:12.345Z");
    expect(new Date(toMalaysiaIso(instant)).getTime()).toBe(instant.getTime());
  });
});
