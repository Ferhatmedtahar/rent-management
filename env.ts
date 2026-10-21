import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Single source of truth for environment variables.
 * Import `env` from here. Never read `process.env` anywhere else (ESLint-enforced).
 */
export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    /** Prisma runtime connection (Postgres, via pg driver adapter). */
    DATABASE_URL: z.string().url(),
    /** Direct connection used by the Prisma CLI for migrations. */
    DIRECT_URL: z.string().url().optional(),
    /**
     * Supabase secret (service role) key. Server-only, bypasses RLS, never
     * exposed to the browser. From `npx supabase status` ("Secret").
     */
    SUPABASE_SECRET_KEY: z.string().min(1),
    /**
     * HMAC-SHA256 key that signs payment-gateway webhooks (x_signature).
     * Local value: test_x_signature_key (the brief's test vector).
     */
    GATEWAY_X_SIGNATURE_KEY: z.string().min(1),
    /**
     * Shared password the seed gives every seeded account. Used only by
     * `npm run seed`, so optional at runtime. Local-only value.
     */
    SEED_PASSWORD: z.string().min(8).optional(),
  },
  client: {
    NEXT_PUBLIC_SITE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },

  // CI/Docker image builds run without a database; skip validation there only.
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
  emptyStringAsUndefined: true,
});
