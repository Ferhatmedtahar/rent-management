import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Same file Next.js and docker-compose use. The Prisma CLI does not load it on
// its own. `.env` is a fallback and never overrides `.env.local`.
config({ path: ".env.local" });
config({ path: ".env" });

// Prisma CLI reads DIRECT_URL (session connection, no pooler) for migrations.
// The app itself connects with DATABASE_URL through the pg driver adapter.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
