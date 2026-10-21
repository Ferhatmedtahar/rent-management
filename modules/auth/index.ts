/**
 * PUBLIC API of the auth module. Client-safe: types, hooks and containers only.
 * Server code imports guards from `@/modules/auth/api/guards` (deep path allowed for api/).
 */
export { LoginScreenContainer } from "./screens/login-screen-container";
export { RootRedirectScreenContainer } from "./screens/root-redirect-screen-container";
export { PortalPlaceholderContainer } from "./screens/portal-placeholder-container";
export { useMe } from "./hooks/use-me";
export type { Actor, MeResponse, Role } from "./types/actor.types";
export type { LoginInput } from "./schemas/login.schema";
