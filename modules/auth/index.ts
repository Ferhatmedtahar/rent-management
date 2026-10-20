/**
 * PUBLIC API of the auth module. Client-safe: types only. Server code imports
 * the guards from `@/modules/auth/api/guards` (deep path allowed for api/).
 */
export type { Actor, Role } from "./types/actor.types";
