# Documentation

| Doc                                | What it covers                                           |
| ---------------------------------- | -------------------------------------------------------- |
| [adr/](adr/README.md)              | Architecture decision records (why we chose what we did) |
| [patterns.md](patterns.md)         | Container/presentational, adapter, strategy              |
| [git-workflow.md](git-workflow.md) | Branches, commits, hooks, CI                             |
| [docker.md](docker.md)             | Dockerized app + local Supabase stack                    |

Written once the assessment spec is known:

- `database.md`: ERD (Mermaid), constraints, indexes
- `auth.md`: Google sign-in, sessions, roles
- `authorization.md`: role × resource permission matrix
- `payments.md`: payment state machine, idempotency, webhook flow

Contributor and agent rules live in [`../AGENTS.md`](../AGENTS.md).
