# Docker

Two separate stacks:

| Stack            | Started by                  | Contains                                                  |
| ---------------- | --------------------------- | --------------------------------------------------------- |
| Supabase (local) | `supabase start` (CLI)      | Postgres :54322, API :54321, Studio :54323, Auth, Storage |
| App              | `docker compose up --build` | The Next.js standalone server on :3000                    |

Keeping them separate means the grader's `supabase start` works exactly as in
the Supabase docs, and the app image stays small.

## Image (`Dockerfile`)

Multi-stage build: `deps` (lockfile install, cached) → `builder` (Prisma
generate, `next build`, standalone output) → `runner` (minimal, non-root
`node` user). `SKIP_ENV_VALIDATION=true` applies at build time only; the
container validates its environment at runtime via `env.ts`.
`NEXT_PUBLIC_*` values are inlined into the browser bundle at build time, so
they are passed as build args (see `docker-compose.yml`).

## Reaching the host's Supabase from the container

Inside the container `localhost` is the container. `docker-compose.yml` maps
`host.docker.internal` to the host and overrides `DATABASE_URL` accordingly.

Known limitation: server-side Supabase Auth calls use
`NEXT_PUBLIC_SUPABASE_URL`, which the browser also needs as
`http://127.0.0.1:54321`. If the containerised app needs server-side Auth, add
a separate server-only `SUPABASE_INTERNAL_URL` rather than changing the public
one. Not required until Auth is implemented.

## Not done by agents

`docker compose up/down` and `supabase start/stop` are run by the human only
(see `AGENTS.md`).
