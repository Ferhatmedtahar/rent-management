import { describe, expect, it } from "vitest";
import { formatSen } from "./format-money";

describe("formatSen", () => {
  it.each([
    [0, "RM 0.00"],
    [5, "RM 0.05"],
    [50, "RM 0.50"],
    [100, "RM 1.00"],
    [150050, "RM 1,500.50"],
    [77419, "RM 774.19"],
    [100029, "RM 1,000.29"],
    [123456789, "RM 1,234,567.89"],
    [Number.MAX_SAFE_INTEGER, "RM 90,071,992,547,409.91"],
    [-150050, "-RM 1,500.50"],
  ])("%d -> %s", (sen, expected) => {
    expect(formatSen(sen)).toBe(expected);
  });
  it.each([[1.5], [Number.NaN], [Number.POSITIVE_INFINITY], [2 ** 53]])(
    "rejects %s",
    (value) => {
      expect(() => formatSen(value)).toThrow();
    },
  );
});
