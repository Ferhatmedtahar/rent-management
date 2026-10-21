/**
 * Every TanStack Query key lives here. Never inline a key in a hook.
 * Shape: [domain, scope, ...params] so `invalidateQueries({ queryKey: queryKeys.x.all })`
 * invalidates a whole domain. Add a domain per module when the module is created.
 */
export const queryKeys = {
  health: {
    all: ["health"] as const,
    status: () => [...queryKeys.health.all, "status"] as const,
  },
  gateway: {
    all: ["gateway"] as const,
    bill: (billId: string) =>
      [...queryKeys.gateway.all, "bill", billId] as const,
  },
  me: {
    all: ["me"] as const,
    info: () => [...queryKeys.me.all, "info"] as const,
  },
  leases: {
    all: ["leases"] as const,
    list: () => [...queryKeys.leases.all, "list"] as const,
  },
  lease: (id: string) => ["leases", "detail", id] as const,
  reports: {
    all: ["reports"] as const,
    collections: (from: string, to: string) =>
      [...queryKeys.reports.all, "collections", from, to] as const,
  },
  overdue: {
    all: ["overdue"] as const,
    count: () => [...queryKeys.overdue.all, "count"] as const,
  },
  tenantPortal: {
    all: ["tenantPortal"] as const,
    data: (userId?: string) =>
      [...queryKeys.tenantPortal.all, "data", userId ?? ""] as const,
  },
} as const;
