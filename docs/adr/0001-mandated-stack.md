# 0001. Mandated stack (Next.js, React, Radix, Supabase, Prisma)

- Status: Accepted
- Date: 2026-10-20

## Context

The assessment brief fixes the stack: Next.js 16 (App Router) with TypeScript,
Supabase (PostgreSQL, Auth, Row Level Security, Storage), Prisma ORM, shadcn/ui
and Tailwind CSS. These are requirements, not preferences. The decision here is
how to use them well, not whether to use them.

## Decision

Adopt the stack as specified:

- **Next.js 16 + React + TypeScript (strict):** App Router for routing and
  layouts; Route Handlers for the API (ADR 0003).
- **shadcn/ui (Radix primitives) + Tailwind 4:** shadcn gives accessible Radix
  primitives that we own as source files, so behaviour is auditable and there is
  no component-library lock-in. Tailwind keeps styling colocated.
- **Supabase (local stack):** Postgres, Auth (Google sign-in), RLS and Storage
  from one platform. Runs locally in Docker so graders can reproduce it.
- **Prisma:** typed queries and a migration history. Used through the `pg`
  driver adapter (Prisma 7).

Everything else (React Query, Zustand, zod, react-hook-form) is our choice and
has its own ADR or is justified in `AGENTS.md`.

## Alternatives considered

Not applicable for the mandated pieces. Within them we chose Prisma over the
Supabase JS data client for queries (ADR 0010 explains the security trade-off).

## Consequences

- We inherit Prisma's RLS bypass and must authorize in code (ADR 0010).
- Versions are newer than most documentation; read the installed docs
  (`node_modules/next/dist/docs/`) rather than rely on memory.
- Behaviour must be reproducible on a grader's machine: local Supabase plus
  committed migrations and seed (ADR 0013).
