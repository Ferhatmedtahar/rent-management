# Git workflow

## Branches

```mermaid
gitGraph
  commit id: "init"
  branch staging
  branch dev
  checkout dev
  branch feat/leases
  commit id: "feat: leases"
  checkout dev
  merge feat/leases
  checkout staging
  merge dev
  checkout main
  merge staging tag: "v0.1.0"
```

- `main`: production-ready. Protected; merges from `staging` only, via PR.
- `staging`: pre-production verification. Merges from `dev` via PR.
- `dev`: integration branch (default). Feature branches merge here via PR.
- `feat/*`, `fix/*`, `chore/*`, `docs/*`: short-lived, branched from `dev`.

Protections on `main` and `staging`: pull request required, CI must pass, no
force pushes.

## Commits

Conventional Commits, created with `pnpm commit` (Commitizen) and validated by
commitlint: `feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`,
header ≤ 100 characters. One logical change per commit.

## Hooks (Husky)

| Hook         | Runs                                                 |
| ------------ | ---------------------------------------------------- |
| `pre-commit` | lint-staged (ESLint --fix, Prettier) on staged files |
| `commit-msg` | commitlint                                           |
| `pre-push`   | `pnpm type-check` and `pnpm test`                    |

## CI (`.github/workflows/ci.yml`)

On pull requests and pushes to `dev`, `staging`, `main`: format check, lint,
type-check, test, build.
