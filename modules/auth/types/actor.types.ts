export type Role = "manager" | "staff" | "tenant";

/**
 * Who is calling, as decided by the DATABASE (memberships / tenants.user_id).
 * Never built from user_metadata, app_metadata, JWT claims or the request.
 */
export type Actor = {
  userId: string;
  orgId: string;
  role: Role;
  /** Set for tenants only: the caller's `tenants.id`, to scope their own records. */
  tenantId?: string;
};

/** What the service needs from storage. The repository implements it; tests fake it. */
export interface ActorLookup {
  findMembershipByUserId(
    userId: string,
  ): Promise<{ orgId: string; role: "manager" | "staff" } | null>;
  findTenantByUserId(
    userId: string,
  ): Promise<{ id: string; orgId: string } | null>;
}
