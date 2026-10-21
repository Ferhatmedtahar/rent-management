/**
 * PUBLIC API of the health module. Other modules and app/ import from here only.
 * Keep this client-safe: never re-export server-only code (services/, repositories/).
 */
export { HealthScreenContainer } from "./screens/health-screen-container";
export type { HealthStatus } from "./types/health.types";
