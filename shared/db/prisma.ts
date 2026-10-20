import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/env";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * The only Prisma client. Importable from `modules/<name>/repositories/` only
 * (ESLint-enforced). Prisma connects as the table owner and BYPASSES RLS, so
 * every query must be authorized in the service layer. See docs/adr/0010.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });

if (env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
