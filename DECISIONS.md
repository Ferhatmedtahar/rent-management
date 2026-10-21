# Decisions (Part C)

Each answer is at most 150 words. Line numbers are for the files as committed in this repo.

## 1. The same `paid=true` callback twice, 5 ms apart

Both requests pass the signature check (`modules/gateway/services/webhook.service.ts:38-41`) and find the
bill (`:44`). Each opens a transaction and takes the lease row lock first (`:72`; SQL `FOR UPDATE` at
`modules/gateway/repositories/webhook.repository.ts:11`), so the second waits. The first runs
`UPDATE gateway_bills ... WHERE id = $1 AND status <> 'paid'` (`webhook.repository.ts:18`), sees count 1
(`:21`), allocates and inserts one approved online payment (`webhook.service.ts:75-83`), and commits. The second
then matches 0 rows and returns (`:76`): 200, no effect.

Single payment is guaranteed by that conditional UPDATE (`webhook.repository.ts:18-21`), serialized by the
lease lock. Backstop: `UNIQUE (gateway_bill_id)` (`supabase/migrations/20261020220000_schema.sql:260`); a unique
violation is also answered 200 (`webhook.service.ts:115`). Tested with five parallel callbacks in
`webhook.service.test.ts` and `scripts/webhook-check.ts`.

## 2. RM 800 and RM 700 at once on a lease with RM 1,000 left

Both go through `recordPayment`. Each transaction (`modules/payments/services/payment.service.ts:71`) starts with
`SELECT ... FROM leases ... FOR UPDATE` (`:73`; SQL at `modules/payments/repositories/payment.repository.ts:19`),
so the second request blocks until the first commits. The first computes the cap = invoices - allocations -
pending payments (`:77-78`), RM 800 fits, and its row is committed. The second then recomputes with RM 800
pending, the cap is RM 200, `700 > cap` (`:79`), and it gets 422; nothing is written. Without the lock both would
read RM 1,000 and both succeed. Approval re-checks the remaining balance under the same lock
(`modules/payments/services/review.service.ts:97-98`), and the lock is always taken before the payment is read
(`:68`), so there are no deadlocks. Proven by `scripts/payments-check.ts` (one 201, one 422).

## 3. Everywhere "today" or date <-> instant is worked out

All business time is **Asia/Kuala_Lumpur, fixed UTC+8** (no daylight saving, so a constant offset is exact); storage
is UTC `timestamptz` and date-only `date`.

- Today: `shared/lib/malaysia-time.ts:6-10` (used for the gateway amount due, `modules/gateway/services/gateway.service.ts:33`);
  overdue status `lib/billing.ts:35,221-227`.
- Instant -> Malaysia text: `malaysia-time.ts:17` (lease response, `modules/leases/services/lease-read.service.ts:61`).
- Report months as `+08:00` instants: `modules/reports/services/months.ts:47-52`.
- Input instants: `payment.service.ts:96` and `modules/payments/schemas/payment.schemas.ts:6-10` (explicit offset
  required); `modules/gateway/services/paid-at.ts:3-17`.
- `date` columns <-> strings, timezone-neutral UTC midnight: `lease.repository.ts:15,83`, `payment.repository.ts:58`,
  `gateway.repository.ts:39`, `webhook.repository.ts:43`; calendar math `lib/billing.ts:47,86`.
- Seed fixtures: `prisma/seed.ts:326,363` (`+08:00`). `new Date()` for review times is a plain instant.

Tests run under three `TZ` values.

## 4. Queries not subject to RLS, and what authorizes each

- **Prisma repositories** (owner connection): `modules/auth/`, `leases/`, `payments/`, `gateway/` (two files) and
  `reports/repositories/`. Enforced by `authenticate` (`modules/auth/api/guards.ts:23`: Bearer or cookie, verified
  with `getUser`, `supabase-identity.adapter.ts:41,47`), the role read from `memberships`/`tenants`
  (`auth.service.ts:31`), `requireRole` (`:77`), and every lookup scoped by `actor.orgId` (e.g.
  `lease.repository.ts:23-27`, `payment.service.ts:42`, `report.repository.ts:12`); composite FKs reject cross-org
  references (`schema.sql:134-136`). The webhook is authorized by its signature (`webhook.service.ts:38-41`).
- **Service-role client** (`shared/supabase/admin.ts:16`): slip existence/cleanup (`slip-storage.adapter.ts:11,19`)
  and the seed; the path must be in the caller's org folder (`payment.schemas.ts:77`, checked at
  `payment.service.ts:59`).
- **SECURITY DEFINER helpers** (`supabase/migrations/20261020230000_security.sql:35-86`): used only by RLS policies,
  empty `search_path`, in an unexposed schema (`:97`).

## 5. A void while the lease still has `unapplied_sen`

`voidPayment` (`modules/payments/services/review.service.ts:198`) does three things in one transaction under the
lease lock. It sets the voided payment's own `unapplied_sen` to 0 (`:224`), because the table CHECK allows credit
only on approved payments (`schema.sql:278`). It deletes only that payment's allocation rows (`:227`; filtered by
`payment_id`, `payment.repository.ts:140`). It records the removed allocations and the previous credit in the
audit row (`:240`).

Other payments' allocations and `unapplied_sen` are untouched (`docs/database.md:562`, decision Q1). I chose this
because the brief says other payments' allocations do not change, and silently re-applying credit would rewrite
another payment's history. The reopened invoices become payable by a new payment or Pay now; leftover credit stays
visible on its own payment for a manager to handle.

## 6. Two things my AI assistant got wrong

**TO FILL BY THE OWNER.** Choose two of the candidates below, say in your own words how you noticed, and add the
`ai-logs/` file and line numbers. Nothing here is invented: each item has evidence in the repo. Keep the final
answer within 150 words.

1. **Storage delete expectation in the RLS checks.** The generated `docs/rls-checks.sql` expected `DELETE 0` for a
   delete on `storage.objects`; real Supabase raises "Direct deletion from storage tables is not allowed". You ran
   the script and had it corrected. Evidence: commit `1866740` and cases G12/G13 in `docs/rls-checks.sql`.
2. **Recommendations you overruled.** The database design's open questions recommended extra audit rows
   (`payment.recorded`, `payment.settled_online`), requiring `transaction_status = completed` on the webhook, a
   future-date check on `received_at`, and a role-exclusivity trigger. You decided against each because the brief
   (or hidden tests) did not ask for them. Evidence: `docs/database.md` section 8 (Q2, Q7, Q8, Q13), commit `45b5aba`.
3. **Scaffold docs that contradicted the brief.** The pre-test docs and code assumed integer cents in
   `shared/lib/money.ts`, `/api/v1`, a `{ data, meta }` envelope, `Idempotency-Key` and a stored `paid_cents`. They
   had to be reconciled. Evidence: the conflicts table in `HANDOFF.md`, commit `cc8c4c6`, ADRs 0006/0008 marked
   superseded and `docs/adr/0015-api-contract-fixed-by-the-brief.md`, ADR 0012 reworded.
4. **`Date.parse` accepts 2026-02-30.** The first `receivedAt` validation relied on `Date.parse`, which rolls an
   impossible date over to March; the unit test for an impossible date failed. Evidence:
   `modules/payments/schemas/payment.schemas.ts:9` and the "impossible date" cases in
   `modules/payments/services/payment.service.test.ts`.
5. **Guards pulled Prisma into unit tests.** Importing `guards.ts` from a domain service loaded Prisma and `env.ts`,
   so the lease tests failed with "Invalid environment variables"; the pure checks were split out. Evidence:
   `modules/auth/api/policy.ts:4` and the import in `modules/leases/services/lease.service.ts`.

Answer: _(owner to write; point to the `ai-logs/` lines)_
