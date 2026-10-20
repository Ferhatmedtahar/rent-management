# Claude Code Instructions

@AGENTS.md

The `@AGENTS.md` import above loads the full project guide at session start:
architecture, modules, money rules, security boundaries, conventions. Treat it
as authoritative. Everything below is Claude-specific only.

## Assessment override (read first)

This repo is a timed take-home. If `ASSESSMENT.md` and `HANDOFF.md` exist locally,
read both before anything else. **The brief overrides `AGENTS.md`, `DESIGN.md` and
`docs/adr/`** wherever they conflict (endpoint paths, response shapes, env names,
`lib/billing.ts`, sen not cents, Supabase SQL migrations as the schema source, npm
commands for graders). Fix the docs when you change a rule, and supersede the ADR.

## How to work in this repo

- **One small task, then stop.** Finish it, run `pnpm format`, `pnpm lint`,
  `pnpm type-check`, `pnpm test`, summarise what changed, and wait. The user
  commits between tasks so a failure never costs more than one task.
- **Never commit or stage.** No `git add`, `git commit`, `git push`, `reset`,
  `checkout`, `stash`. Read-only git (`status`, `diff`, `log`) is fine. Do not
  delegate git writes to subagents either.
- **Never run `pnpm dev` or any dev server.** Ask the user to run it.
- **Never run database or stack commands**: `prisma migrate *`, `prisma db *`,
  `pnpm db:migrate:*`, `pnpm db:seed`, `supabase start|stop|reset|db *`,
  `docker compose up|down`. Write the migration / SQL / RLS, explain it, and
  stop. The user reviews and runs it.
- **Never read `.env*`** (except `.env.example`). Verify config through
  behaviour, not by printing secrets.
- **pnpm only.** No `npm`, `npx`, `yarn`.
- **Money:** before writing anything that touches an amount, re-read AGENTS.md
  section 5. All math goes through `shared/lib/money.ts`. Write the test first.
- **Server state:** always React Query via a hook in the module's `hooks/`.
  Never `useEffect` + `fetch`. Invalidate on mutation.
- **No trust at any boundary** (AGENTS.md section 7): validate with zod and
  authorize at every layer, even if the layer above already did.
- **Reference module:** copy the shape of `modules/health/` for any new module.
- If a lint rule blocks you, fix the design. Do not disable the rule.
- Prefer reading installed docs (`node_modules/next/dist/docs/`) over memory.

## Pre-approved commands

Allowed without asking (see `.claude/settings.json`): `pnpm build`,
`pnpm lint`, `pnpm lint:fix`, `pnpm type-check`, `pnpm test`, `pnpm format`,
`pnpm format:check`, `pnpm add`, `pnpm db:generate`,
`pnpm exec prisma generate|validate|format`.

Denied by policy: git writes, dev server, migrations, Supabase/Docker stack
control, npm/npx/yarn, reading `.env*`.

## Session hygiene (the assessment submits AI session logs)

- Keep sessions focused on the task; no unrelated chatter or experiments.
- Never paste secrets, credentials or the assessment login into a prompt.
- Explain decisions in code review terms: the owner must be able to defend
  every line in the walkthrough. If a choice is non-obvious, add or update an
  ADR in `docs/adr/` instead of leaving it implicit.
