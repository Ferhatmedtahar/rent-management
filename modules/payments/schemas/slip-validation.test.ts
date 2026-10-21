import { describe, it, expect } from "vitest";
import { validateSlipFile, MAX_SLIP_SIZE_BYTES } from "./slip-validation";

describe("validateSlipFile", () => {
  it("accepts valid JPEG, PNG, and PDF files under 5 MB", () => {
    expect(validateSlipFile({ type: "image/jpeg", size: 1024 * 1024 })).toEqual(
      { valid: true },
    );
    expect(
      validateSlipFile({ type: "image/png", size: 2 * 1024 * 1024 }),
    ).toEqual({ valid: true });
    expect(
      validateSlipFile({ type: "application/pdf", size: 4 * 1024 * 1024 }),
    ).toEqual({ valid: true });
  });

  it("rejects unsupported MIME types", () => {
    const result = validateSlipFile({
      type: "image/webp",
      size: 1024 * 1024,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("Only JPEG, PNG, or PDF");
    }
  });

  it("rejects files exceeding 5 MB", () => {
    const result = validateSlipFile({
      type: "image/jpeg",
      size: MAX_SLIP_SIZE_BYTES + 1,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("5 MB");
    }
  });

  it("rejects empty files", () => {
    const result = validateSlipFile({ type: "image/png", size: 0 });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain("empty");
    }
  });
});
