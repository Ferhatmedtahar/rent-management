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
} as const;
