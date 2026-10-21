import { describe, expect, it, vi } from "vitest";
import { HttpError } from "@/shared/lib/http-error";
import type { Actor, ActorLookup, Role } from "../types/actor.types";
import {
  authenticateRequest,
  notFound,
  requireRole,
  resolveActor,
  type AuthenticateDeps,
  type VerifiedIdentity,
} from "./auth.service";

const ORG_A = "11111111-1111-1111-1111-111111111111";
const ORG_B = "22222222-2222-2222-2222-222222222222";
const MANAGER = "00000000-0000-0000-0000-0000000000a1";
const STAFF = "00000000-0000-0000-0000-0000000000a2";
const TENANT = "00000000-0000-0000-0000-0000000000a3";
const BOTH = "00000000-0000-0000-0000-0000000000a4";
const STRANGER = "00000000-0000-0000-0000-0000000000ff";
const TENANT_ROW = "dddddddd-0000-0000-0000-000000000001";

/** In-memory stand-in for the memberships and tenants tables. */
function fakeLookup(): ActorLookup & {
  findMembershipByUserId: ReturnType<typeof vi.fn>;
  findTenantByUserId: ReturnType<typeof vi.fn>;
} {
  const memberships = new Map<
    string,
    { orgId: string; role: "manager" | "staff" }
  >([
    [MANAGER, { orgId: ORG_A, role: "manager" }],
    [STAFF, { orgId: ORG_A, role: "staff" }],
    [BOTH, { orgId: ORG_B, role: "staff" }],
  ]);
  const tenants = new Map<string, { id: string; orgId: string }>([
    [TENANT, { id: TENANT_ROW, orgId: ORG_A }],
    [BOTH, { id: "dddddddd-0000-0000-0000-000000000009", orgId: ORG_A }],
  ]);
  return {
    findMembershipByUserId: vi.fn(
      async (userId: string) => memberships.get(userId) ?? null,
    ),
    findTenantByUserId: vi.fn(
      async (userId: string) => tenants.get(userId) ?? null,
    ),
  };
}

const headers = (authorization?: string) =>
  new Headers(authorization === undefined ? {} : { authorization });

function deps(overrides: Partial<AuthenticateDeps> = {}) {
  const verifyBearer = vi.fn(
    async (token: string): Promise<VerifiedIdentity | null> =>
      token === "good-token" ? { id: TENANT } : null,
  );
  const verifyCookieSession = vi.fn(
    async (): Promise<VerifiedIdentity | null> => ({ id: MANAGER }),
  );
  const lookup = fakeLookup();
  return {
    verifyBearer,
    verifyCookieSession,
    lookup,
    ...overrides,
  } satisfies AuthenticateDeps;
}

async function statusOf(
  promise: Promise<unknown> | (() => unknown),
): Promise<number | "no error"> {
  try {
    await (typeof promise === "function" ? promise() : promise);
    return "no error";
  } catch (error) {
    if (error instanceof HttpError) return error.status;
    throw error;
  }
}

describe("resolveActor", () => {
  it("returns a manager from memberships, with the organization from the database", async () => {
    expect(await resolveActor(fakeLookup(), MANAGER)).toEqual({
      userId: MANAGER,
      orgId: ORG_A,
      role: "manager",
    });
  });

  it("returns staff from memberships", async () => {
    expect(await resolveActor(fakeLookup(), STAFF)).toEqual({
      userId: STAFF,
      orgId: ORG_A,
      role: "staff",
    });
  });

  it("returns a tenant from tenants.user_id, with the tenant row id", async () => {
    expect(await resolveActor(fakeLookup(), TENANT)).toEqual({
      userId: TENANT,
      orgId: ORG_A,
      role: "tenant",
      tenantId: TENANT_ROW,
    });
  });

  it("memberships win when a user is in both tables, and tenants is not consulted", async () => {
    const lookup = fakeLookup();
    const actor = await resolveActor(lookup, BOTH);
    expect(actor).toEqual({ userId: BOTH, orgId: ORG_B, role: "staff" });
    expect(actor).not.toHaveProperty("tenantId");
    expect(lookup.findTenantByUserId).not.toHaveBeenCalled();
  });

  it("returns null for a user with no membership and no tenant row", async () => {
    const lookup = fakeLookup();
    expect(await resolveActor(lookup, STRANGER)).toBeNull();
    expect(lookup.findMembershipByUserId).toHaveBeenCalledWith(STRANGER);
    expect(lookup.findTenantByUserId).toHaveBeenCalledWith(STRANGER);
  });
});

describe("authenticateRequest: 401 when there is no valid login", () => {
  it("accepts a valid Bearer token and resolves the actor from the database", async () => {
    const d = deps();
    const actor = await authenticateRequest(headers("Bearer good-token"), d);
    expect(actor).toMatchObject({
      userId: TENANT,
      role: "tenant",
      orgId: ORG_A,
    });
    expect(d.verifyBearer).toHaveBeenCalledWith("good-token");
    expect(d.verifyCookieSession).not.toHaveBeenCalled();
  });

  it("accepts the scheme in any letter case and extra spaces", async () => {
    const d = deps();
    expect(
      await authenticateRequest(headers("bearer   good-token "), d),
    ).toMatchObject({
      userId: TENANT,
    });
  });

  it("falls back to the cookie session only when there is no Authorization header", async () => {
    const d = deps();
    const actor = await authenticateRequest(headers(), d);
    expect(actor).toMatchObject({ userId: MANAGER, role: "manager" });
    expect(d.verifyBearer).not.toHaveBeenCalled();
  });

  it("401 when there is no header and no cookie session", async () => {
    const d = deps({ verifyCookieSession: vi.fn(async () => null) });
    expect(await statusOf(authenticateRequest(headers(), d))).toBe(401);
  });

  it("401 for a garbage or expired Bearer token, and the cookie is NOT tried", async () => {
    const d = deps();
    expect(
      await statusOf(authenticateRequest(headers("Bearer garbage"), d)),
    ).toBe(401);
    expect(d.verifyCookieSession).not.toHaveBeenCalled();
  });

  it.each([
    ["Bearer"],
    ["Bearer "],
    ["Basic dXNlcjpwYXNz"],
    ["good-token"],
    ["Bearer a b"],
    [""],
  ])(
    "401 for the malformed Authorization header %j (the token is never verified)",
    async (value) => {
      const d = deps();
      expect(await statusOf(authenticateRequest(headers(value), d))).toBe(401);
      expect(d.verifyBearer).not.toHaveBeenCalled();
      expect(d.verifyCookieSession).not.toHaveBeenCalled();
    },
  );

  it("403 (not 401) for a valid login that belongs to no organization", async () => {
    const d = deps({ verifyBearer: vi.fn(async () => ({ id: STRANGER })) });
    expect(
      await statusOf(authenticateRequest(headers("Bearer good-token"), d)),
    ).toBe(403);
  });

  it("does not swallow unexpected errors: an Auth outage is not a 401", async () => {
    const d = deps({
      verifyBearer: vi.fn(async () => {
        throw new Error("Auth server unavailable");
      }),
    });
    await expect(
      authenticateRequest(headers("Bearer good-token"), d),
    ).rejects.toThrow("Auth server unavailable");
  });

  it("ignores user_metadata, app_metadata and claims: the role comes from the database", async () => {
    // A tenant whose editable metadata claims to be a manager of another org.
    const forged = {
      id: TENANT,
      user_metadata: { role: "manager", org_id: ORG_B },
      app_metadata: { role: "manager", org_id: ORG_B },
      role: "service_role",
    };
    const d = deps({ verifyBearer: vi.fn(async () => forged) });
    const actor = await authenticateRequest(headers("Bearer good-token"), d);
    expect(actor).toEqual({
      userId: TENANT,
      orgId: ORG_A,
      role: "tenant",
      tenantId: TENANT_ROW,
    });
  });

  it("never reads a role or organization from other request headers", async () => {
    const h = new Headers({
      authorization: "Bearer good-token",
      "x-role": "manager",
      "x-org-id": ORG_B,
    });
    const actor = await authenticateRequest(h, deps());
    expect(actor).toMatchObject({ role: "tenant", orgId: ORG_A });
  });
});

describe("requireRole: 403 matrix", () => {
  const actors: Record<Role, Actor> = {
    manager: { userId: MANAGER, orgId: ORG_A, role: "manager" },
    staff: { userId: STAFF, orgId: ORG_A, role: "staff" },
    tenant: {
      userId: TENANT,
      orgId: ORG_A,
      role: "tenant",
      tenantId: TENANT_ROW,
    },
  };
  const matrix: [string, readonly Role[], Record<Role, boolean>][] = [
    [
      "manager only",
      ["manager"],
      { manager: true, staff: false, tenant: false },
    ],
    ["staff only", ["staff"], { manager: false, staff: true, tenant: false }],
    ["tenant only", ["tenant"], { manager: false, staff: false, tenant: true }],
    [
      "manager or staff",
      ["manager", "staff"],
      { manager: true, staff: true, tenant: false },
    ],
    [
      "any role",
      ["manager", "staff", "tenant"],
      { manager: true, staff: true, tenant: true },
    ],
    ["nobody", [], { manager: false, staff: false, tenant: false }],
  ];

  describe.each(matrix)("%s", (_label, allowed, expected) => {
    it.each(["manager", "staff", "tenant"] as const)("%s", (role) => {
      const outcome = statusOf(() => requireRole(actors[role], allowed));
      return expect(outcome).resolves.toBe(expected[role] ? "no error" : 403);
    });
  });

  it("uses a plain message that reveals nothing", () => {
    try {
      requireRole(actors.tenant, ["manager"]);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).message).toBe(
        "You do not have permission to do this.",
      );
    }
  });
});

describe("notFound: 404", () => {
  it("throws HttpError(404) with the same message as a missing record", () => {
    try {
      notFound();
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(404);
      expect((error as HttpError).message).toBe("Not found.");
    }
  });
});

describe("status mapping through withErrorHandling", () => {
  // Imported lazily: api-response pulls in next/server.
  const wrap = async (thrown: () => never) => {
    const { withErrorHandling } = await import("@/shared/lib/api-response");
    const response = await withErrorHandling(async () => thrown())();
    return { status: response.status, body: await response.json() };
  };

  it("maps 401, 403 and 404 to { error } with that status", async () => {
    expect(
      await wrap(() => {
        throw new HttpError(401, "Sign in to continue.");
      }),
    ).toEqual({
      status: 401,
      body: { error: "Sign in to continue." },
    });
    expect(
      await wrap(() => {
        throw new HttpError(403, "You do not have permission to do this.");
      }),
    ).toEqual({
      status: 403,
      body: { error: "You do not have permission to do this." },
    });
    expect(await wrap(() => notFound())).toEqual({
      status: 404,
      body: { error: "Not found." },
    });
  });

  it("maps an unexpected error to a generic 500 without leaking its message", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await wrap(() => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:54322 password=secret");
    });
    expect(result).toEqual({
      status: 500,
      body: { error: "Something went wrong. Please try again." },
    });
    spy.mockRestore();
  });
});
