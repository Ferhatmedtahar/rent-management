import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_FIELD = "x_signature";

/**
 * The string the gateway signs: every field except x_signature, sorted by key
 * ascending by character code (default string sort, NOT localeCompare), each
 * written key+value, joined with "|".
 */
export function signatureSource(fields: ReadonlyMap<string, string>): string {
  return [...fields.keys()]
    .filter((key) => key !== SIGNATURE_FIELD)
    .sort()
    .map((key) => `${key}${fields.get(key) ?? ""}`)
    .join("|");
}

/** HMAC-SHA256 of the source with the key, lowercase hex. */
export function computeSignature(
  fields: ReadonlyMap<string, string>,
  key: string,
): string {
  return createHmac("sha256", key)
    .update(signatureSource(fields))
    .digest("hex");
}

/**
 * Parses a form-urlencoded body into a field map. Returns null when any key
 * appears twice: a repeated key is ambiguous (which value is signed?), so the
 * request is treated as invalid rather than guessing.
 */
export function parseFormFields(raw: string): Map<string, string> | null {
  const fields = new Map<string, string>();
  for (const [key, value] of new URLSearchParams(raw)) {
    if (fields.has(key)) return null;
    fields.set(key, value);
  }
  return fields;
}

/** Constant-time comparison. Missing or different length -> false, never throws. */
export function verifySignature(
  fields: ReadonlyMap<string, string>,
  key: string,
): boolean {
  const supplied = fields.get(SIGNATURE_FIELD);
  if (!supplied) return false;
  const expected = Buffer.from(computeSignature(fields, key), "utf8");
  const actual = Buffer.from(supplied, "utf8");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
