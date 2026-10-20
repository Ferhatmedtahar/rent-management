# Rent Collection System

Rent collection for property managers: leases, invoices, cash / bank transfer /
online payments, and access control for managers, staff and tenants.

Next.js 16 (App Router) · TypeScript · Supabase (Postgres, Auth, RLS, Storage) ·
Prisma · shadcn/ui · Tailwind CSS · TanStack Query · zod.

Architecture and decisions: [`docs/`](docs/README.md) · rules for contributors
and AI agents: [`AGENTS.md`](AGENTS.md).

## Prerequisites

- Node.js 22 (20.9+ works) and pnpm (`corepack enable`)
- Docker (running) and the [Supabase CLI](https://supabase.com/docs/guides/local-development)

## Run locally

```bash
# 1. dependencies (also generates the Prisma client)
pnpm install

# 2. start the local Supabase stack (Postgres :54322, API :54321, Studio :54323)
supabase start            # prints the keys; copy them into .env.local

# 3. environment
cp .env.example .env.local   # fill NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY

# 4. database: apply committed migrations, then seed
pnpm db:migrate:deploy
pnpm db:seed

# 5. app
pnpm dev                  # http://localhost:3000  (health check: /api/v1/health)
```

## Run in Docker

The app image runs the Next.js server only. Supabase keeps running from the
CLI (step 2 above). See [`docs/docker.md`](docs/docker.md).

```bash
docker compose up --build
```

## Scripts

| Command           | Purpose                                   |
| ----------------- | ----------------------------------------- |
| `pnpm lint`       | ESLint, including architecture rules      |
| `pnpm type-check` | TypeScript strict                         |
| `pnpm test`       | Vitest                                    |
| `pnpm format`     | Prettier                                  |
| `pnpm commit`     | Commitizen (Conventional Commits)         |
| `pnpm db:*`       | Prisma generate / migrate / seed / studio |

## Git workflow

`main` (production) ← `staging` ← `dev` ← `feat/*`. Conventional Commits,
enforced by commitlint and Husky. Details in
[`docs/git-workflow.md`](docs/git-workflow.md).
