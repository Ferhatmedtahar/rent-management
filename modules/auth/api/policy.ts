import "server-only";

/**
 * The pure authorization outcomes (403 / 404), free of Prisma and Next.js so
 * domain services and their unit tests can import them cheaply.
 * Handlers get them via `./guards` too.
 */
export { notFound, requireRole } from "../services/auth.service";
