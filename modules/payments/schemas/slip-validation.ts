export const MAX_SLIP_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_SLIP_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;

export type SlipValidationResult =
  { valid: true } | { valid: false; error: string };

export function validateSlipFile(file: {
  type: string;
  size: number;
}): SlipValidationResult {
  if (
    !ALLOWED_SLIP_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_SLIP_MIME_TYPES)[number],
    )
  ) {
    return {
      valid: false,
      error: "Only JPEG, PNG, or PDF files are accepted for payment slips.",
    };
  }
  if (file.size > MAX_SLIP_SIZE_BYTES) {
    return {
      valid: false,
      error: "Payment slip must not exceed 5 MB.",
    };
  }
  if (file.size <= 0) {
    return {
      valid: false,
      error: "Payment slip file is empty.",
    };
  }
  return { valid: true };
}
