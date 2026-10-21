import "server-only";

import { randomBytes } from "node:crypto";

/**
 * An unguessable bill id: "bill_" + 32 CSPRNG bytes as base64url (43 characters,
 * 256 bits). Matches the database CHECK ^bill_[A-Za-z0-9_-]{32,128}$.
 */
export function newBillId(): string {
  return `bill_${randomBytes(32).toString("base64url")}`;
}
