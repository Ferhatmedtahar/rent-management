# Code review: late fees, gateway webhook, collections action

Review of the pull request in `ASSESSMENT.md` (Part B). The PR has three files.
Line numbers count each file block exactly as printed in the brief, starting at 1
for the `// path` comment line:

- **late-fees** = `app/api/leases/[leaseId]/late-fees/route.ts` (53 lines)
- **webhook** = `app/api/webhooks/gateway/route.ts` (41 lines)
- **actions** = `app/(staff)/dashboard/actions.ts` (15 lines)

Context from the brief: Prisma connects as the database owner, so it bypasses RLS and
every authorization rule has to be in this code. Money is integer sen, instants are
shown and grouped in Malaysia time (UTC+8), and `allocate(tx, paymentId)` is assumed
correct.

| #   | Severity | File      | Lines     | Problem                                                                        |
| --- | -------- | --------- | --------- | ------------------------------------------------------------------------------ |
| 1   | Critical | late-fees | 13        | Role read from `user_metadata`, which the user can edit                        |
| 2   | Critical | actions   | 2, 6, 10  | Public Server Action, no authentication, `orgId` chosen by the caller          |
| 3   | Critical | late-fees | 18-22     | Lease loaded by id only: no organization check                                 |
| 4   | Critical | webhook   | 21-26     | Check-then-update race: concurrent callbacks create duplicate payments         |
| 5   | High     | webhook   | 16        | Logs the whole payload and the expected signature                              |
| 6   | High     | webhook   | 33        | `paid_amount` is never compared with the bill; `BigInt()` can throw            |
| 7   | High     | actions   | 8, 11     | Months and range bounds are computed in the session timezone, not Malaysia     |
| 8   | High     | late-fees | 27-46     | Not idempotent: calling twice charges twice                                    |
| 9   | High     | late-fees | 41, 50-53 | Invoice reference: same value for every fee, read-then-write race              |
| 10  | Medium   | late-fees | 18-46     | No transaction, no lease lock: partial writes, fees on stale balances          |
| 11  | Medium   | webhook   | 19        | `paid=false` skips the 404 check and never marks the bill failed               |
| 12  | Medium   | webhook   | 34        | `received_at` is the server clock, not the callback's `paid_at`                |
| 13  | Medium   | actions   | 7-13      | Months with no payments are missing from the result                            |
| 14  | Medium   | late-fees | 38        | `kind: 'late_fee'` is not an invoice kind in the contract                      |
| 15  | Low      | late-fees | 31        | Float ratio with a hidden 99.5% threshold skips invoices that are still unpaid |
| 16  | Low      | late-fees | 32, 40    | A fee can round to 0 sen and break `amount_sen > 0`                            |
| 17  | Low      | late-fees | 12-15     | No login returns 403 instead of 401                                            |
| 18  | Low      | webhook   | 15        | Signature compared with `!==` (not constant time)                              |

---

## 1. Critical: the manager role comes from `user_metadata` (late-fees, line 13)

```ts
if (user?.user_metadata.role !== 'manager') {
```

`user_metadata` is editable by the signed-in user themselves (`supabase.auth.updateUser({ data: { role: 'manager' } })`).
Nothing server-side protects it.

**Scenario:** tenant Aisyah signs in, calls `updateUser({ data: { role: 'manager' } })` from the browser,
then `POST /api/leases/<any lease id>/late-fees`. The check at line 13 passes and she creates invoices.
The brief says roles come from `memberships` and `tenants.user_id`, never from anything the user can edit.

**Fix:** authenticate, then resolve the actor from the database (`memberships.role = 'manager'` for
the caller's `user.id`), and ignore all metadata.

## 2. Critical: `getCollections` is a public, unauthenticated endpoint that trusts `orgId` (actions, lines 2, 6, 10)

```ts
'use server'                                   // line 2
export async function getCollections(orgId: string, from: string, to: string) {   // line 6
  ... WHERE org_id = ${orgId}::uuid ...        // line 10
```

Every export of a `'use server'` file is an HTTP-callable endpoint, whoever imported it. There is
no `getUser()` call, no role check, and the organization is a parameter.

**Scenario:** once a page references the action, its id is in that page's client bundle. An anonymous visitor
(or a tenant of Beta Realty) POSTs the action with Northwind's
organization id and `from=2026-01-01`, `to=2026-03-01`, and receives Northwind's monthly collections.
Prisma bypasses RLS, so the database does not stop it either. Page-level protection of
`app/(staff)/dashboard` does not protect the action.

**Fix:** authenticate inside the action, require staff or manager, take `orgId` from the caller's
membership (never a parameter), and return 401/403 otherwise. Prefer a route handler
(`GET /api/reports/collections`) over a Server Action for data.

## 3. Critical: lease loaded by id only (late-fees, lines 18-22)

```ts
const lease = await prisma.lease.findUnique({ where: { id: leaseId }, ... })
if (!lease) return NextResponse.json({ error: 'Not found' }, { status: 404 })
```

Nothing compares `lease.orgId` with the caller's organization, so even after fixing #1 any manager can
write to any organization's lease.

**Scenario:** the manager of Beta Realty sends `POST /api/leases/<Northwind lease id>/late-fees`.
Fees are created on Northwind's lease (`orgId: lease.orgId` on line 36 copies Northwind's id).
The brief requires 404 for another organization's record, so its existence is not revealed.

**Fix:** `findFirst({ where: { id: leaseId, orgId: actor.orgId } })`, answer 404 when null.

## 4. Critical: duplicate payments for concurrent callbacks (webhook, lines 21-26)

```ts
const bill = await prisma.gatewayBill.findUnique(...)   // 21, outside the transaction
if (bill.status === 'paid') return ...                  // 23
await prisma.$transaction(async (tx) => {
  await tx.gatewayBill.update({ ... status: 'paid' })   // 26, unconditional
```

The status is read outside the transaction and updated unconditionally.

**Scenario:** the gateway retries and delivers the same `paid=true` callback twice, 5 ms apart. Both
requests read `pending` at line 21 and pass line 23. Transaction A updates the bill and creates a
payment. Transaction B waits for A's row lock, then also updates (the row is already `paid`, but the
update has no condition) and creates a second approved payment, so the tenant is credited twice.
If `payments.gateway_bill_id` has a unique constraint, B fails and the handler answers 500, so the
gateway keeps retrying instead of getting 200.

**Fix:** inside one transaction, lock the lease row first, then
`updateMany({ where: { id, status: { not: 'paid' } }, data: ... })`. Create the payment only when the
count is 1; count 0 is a repeat delivery (200, no effect). Treat a unique violation on
`gateway_bill_id` as a concurrent winner (200).

## 5. High: the failure log leaks the payload and the valid signature (webhook, line 16)

```ts
console.error("Invalid signature", { fields, expected });
```

`expected` is the correct signature for exactly the body that was just rejected, and `fields` is the whole
callback. The brief forbids logging whole callback payloads and secrets.

**Scenario:** an attacker sends a forged body with a wrong signature. The server logs the right signature
for that body. Anyone who can read the logs (log aggregation, support staff) copies it, resends the same
body, and it now verifies: a forged "paid" callback.

**Fix:** log nothing sensitive: a generic line only (never `fields`, `expected`, the key or the signature).

## 6. High: `paid_amount` is never checked against the bill (webhook, line 33)

```ts
amountSen: BigInt(fields.paid_amount),
```

**Scenario A:** a validly signed callback carries `paid_amount=1` for a bill of 210050. The code creates an
approved payment of 1 sen and marks the bill paid, so the bill can never be collected again. The brief
requires 422 and no effect when `paid_amount` differs from the bill's amount.

**Scenario B:** `paid_amount=abc` or `1.5`. `BigInt()` throws a `SyntaxError` inside the transaction
(after line 26 has run, so it rolls back) and the client sees an unhandled 500; the gateway retries forever.

**Fix:** validate before any write: `/^\d+$/` and equality with `bill.amountSen`, else 422. Use the bill's
amount for the payment.

## 7. High: months and range bounds use the database session timezone (actions, lines 8 and 11)

```sql
to_char(date_trunc('month', received_at), 'YYYY-MM')      -- line 8
received_at >= ${from}::date AND received_at < ${to}::date + interval '1 month'   -- line 11
```

`date_trunc` on a `timestamptz` and the `date` to `timestamptz` comparison both use the session timezone
(UTC for Supabase), not Malaysia time.

**Scenario:** a bank transfer received 2026-03-01 00:30 +08:00 is stored as 2026-02-28 16:30Z. `date_trunc`
puts it in `2026-02`; the report shows January 300000 and February 200000 (and no March row), where the
brief expects `[300000, 0, 200000]` for the seed data. The bounds are also off by 8 hours: a payment at
2026-01-01 00:30 +08:00 (= 2025-12-31 16:30Z) is excluded from a range starting `2026-01-01`.

**Fix:** group in Malaysia time (`date_trunc('month', received_at AT TIME ZONE 'Asia/Kuala_Lumpur')`) and
bound each month with `+08:00` instants, or bound the range in code and group there.

## 8. High: not idempotent (late-fees, lines 27-46)

The loop skips invoices whose `kind` is not `rent` (line 29), so earlier late-fee invoices are skipped, but
it never records that a rent invoice already got a fee.

**Scenario:** the manager clicks the button twice, or a client retries after a timeout. The rent invoice is
still unpaid, so a second fee is created for it, and a third on the next call: tenants are charged repeatedly.

**Fix:** link each fee to its source invoice and make it unique (for example `source_invoice_id` with a
unique constraint), skip invoices that already have a fee, and treat a unique violation as "already charged".

## 9. High: invoice references repeat and race (late-fees, lines 41 and 50-53)

```ts
reference: await nextReference(lease.orgId),     // 41, inside the loop
const last = await prisma.invoice.findFirst({ orderBy: { createdAt: 'desc' } })   // 51
```

Prisma queries are lazy: `prisma.invoice.create(...)` has not run when it is pushed (it runs when
`Promise.all` awaits it on line 46). So during the loop every `nextReference` call reads the same last
invoice and returns the same number; if the creates were eager they still would not be awaited before the
next iteration, which is the same race.

**Scenario:** three overdue invoices produce three fees all named `INV-41`. Two concurrent requests collide
the same way, and `createdAt desc` is not "highest number" (ties, clock skew). A previous reference that
does not start with `INV-` makes `parseInt` return `NaN` and the next reference is `INV-NaN`.

**Fix:** generate references in the database (a sequence per organization, or an identity column), not by
read-then-write in application code.

## 10. Medium: no transaction and no lease lock (late-fees, lines 18-46)

Reads happen at line 18; the writes are separate statements run by `Promise.all`.

**Scenario A:** the third `create` fails (constraint, reference collision); the first two fees are already
committed and the response is a 500, leaving a half-applied charge.
**Scenario B:** a manager approves a payment between the read at line 18 and the creates: the fee is
computed from stale allocations and charges money that was just paid.

**Fix:** one `$transaction` that locks the lease row (`SELECT ... FOR UPDATE`) first, then reads invoices and
allocations, then creates all fees, so it is all or nothing and consistent with concurrent payments.

## 11. Medium: `paid=false` is handled before the bill is even looked up (webhook, line 19)

```ts
if (fields.paid !== "true") return NextResponse.json({ ok: true });
```

**Scenario A:** `paid=false` for a bill id that does not exist returns 200; the brief requires 404.
**Scenario B:** `paid=false` for a pending bill returns 200 but never changes it, so the bill stays
`pending` forever; the brief requires `failed`. A value such as `paid=maybe` also gets 200 instead of 422.

**Fix:** look up the bill first (404), then `paid=false` -> `updateMany({ where: { id, status: 'pending' } })`
to `failed` (never touching a paid bill), `paid=true` -> settle, anything else -> 422.

## 12. Medium: `received_at` is the server clock (webhook, line 34)

```ts
receivedAt: new Date(),
```

The brief says the payment's `received_at` is the callback's `paid_at`.

**Scenario:** a callback for a payment made 2026-03-31 23:50 +08:00 is delivered after the gateway's retry at
00:10 on April 1. The payment lands in April in the collections report, one month late.

**Fix:** parse `paid_at` (`YYYY-MM-DD HH:mm:ss +0800` or ISO 8601 with offset; 422 if invalid) and store it.

## 13. Medium: empty months are missing (actions, lines 7-13)

`GROUP BY` returns only months that have rows.

**Scenario:** an organization with payments in January and March only asks for `2026-01` to `2026-03`
and gets two rows. The brief requires one entry per month in the range, including
`{ month: '2026-02', collectedSen: 0 }`; a range with no payments at all returns an empty array.

**Fix:** generate the month list in code and fill the zeros (or `generate_series` with a left join).

## 14. Medium: `'late_fee'` is not an invoice kind (late-fees, line 38)

The contract has `InvoiceKind = 'deposit' | 'rent'` (section 3) and the lease response lists invoices with
`kind: 'deposit' | 'rent'` (section 7); a lease "stores exactly the invoices `generateSchedule` returns".

**Scenario:** with `kind` as a database enum or CHECK on those two values, the insert fails on every call that
has an eligible invoice (500). If the column did accept it, extra invoices would raise the lease's remaining
balance (the payment cap), change the "amount due now" of a gateway bill, and break clients that assume two
kinds. The row also has no `period_*` fields and relies on a `reference` column that is not in the schema.

**Fix:** agree the model first (a separate `late_fees` table, or an explicit new kind added to the enum,
CHECKs, tests and the response contract) and do not bypass `generateSchedule` and the invoice constraints.

## 15. Low: float ratio with a hidden threshold (late-fees, line 31)

```ts
if (Number(paid) / Number(invoice.amountSen) >= 0.995) continue;
```

The comment promises a fee for every rent invoice "still unpaid", but invoices that are 99.5% or more paid
are exempt, and the check mixes `Number()` conversions of `bigint` amounts with a float literal.

**Scenario:** amount 150000, paid 149250 (99.5%): 750 sen is still unpaid but no fee is charged, with no rule
that says so. Money comparisons should be integer: `paid >= amount`.

**Fix:** use `invoice.amountSen - paid > 0n` (bigint), and document any real threshold as a rule.

## 16. Low: a fee can round to zero (late-fees, lines 32 and 40)

```ts
const fee = Math.round((Number(invoice.amountSen - paid) * 2) / 100);
```

**Scenario:** 24 sen unpaid gives `0.48`, which rounds to 0. `amountSen: 0n` violates a positive-amount
CHECK (`amount_sen > 0` in our schema; money rows should never be zero), the insert fails, and the request returns 500 (with earlier fees already created, see #10).

**Fix:** compute in integers (`(unpaid * 2n + 50n) / 100n` is half-up) and skip when the fee is 0.

## 17. Low: no login returns 403 (late-fees, lines 12-15)

When `getUser()` returns no user, `user?.user_metadata.role` is `undefined` and the handler answers 403. The
brief says a request without a valid login gets 401, and 403 is for a caller who is signed in but not allowed.

**Fix:** return 401 when there is no user, then 403 for a known user whose database role is not manager.

## 18. Low: non-constant-time signature comparison (webhook, line 15)

`expected !== fields.x_signature` compares strings with early exit. With a secret HMAC the practical risk is
small, but the standard is `crypto.timingSafeEqual` on equal-length buffers (and a length check first).

---

## Looks suspicious but is correct

- **The 7-day cutoff (late-fees, lines 24-25 and 29).** The comment says "more than 7 days after its due date".
  `Date.parse('YYYY-MM-DD')` is UTC midnight and `@db.Date` values are UTC-midnight `Date`s, so both sides are
  in the same frame and `DAY_MS` has no DST problem. With today (Malaysia) = 2026-03-08 the cutoff is
  2026-03-01; an invoice due 2026-03-01 is exactly 7 days old, `dueDate >= cutoff` skips it, which is correct
  ("more than 7"). On 2026-03-09 the cutoff is 2026-03-02 and the same invoice (8 days) is charged. Also correct.
- **`todayMyt` (line 24).** Shifting by +8 hours and taking the UTC date is the right way to get Malaysia's date.
- **`new Date(todayMyt)` for `dueDate` (line 39).** A date-only string parses as UTC midnight, which is exactly the
  value a `date` column needs.
- **`paid` from allocations (line 30).** Allocation rows exist only for approved payments and a void removes
  them, so summing them is the correct paid amount.
- **`getUser()` (line 12).** It asks the Auth server; the problem is the metadata that follows, not the call.
- **Webhook signature input (lines 9-14).** Sorting keys with the default `sort()` and joining `key+value` with
  `|` matches the brief's algorithm, and the check runs before any database access.
- **Late success (line 23).** Only a bill that is already `paid` returns early, so `failed -> paid` still works.
- **`$queryRaw` tagged template (actions, lines 7-13).** Values are bound as parameters, so there is no SQL
  injection. (The `Number(r.total)` call is fine too: `SUM(bigint)` is `numeric` in Postgres, and `Number()`
  handles it for sums up to the 1e12-sen bound.)
- **`Math.round` on a non-negative integer ratio (line 32).** For integers below 2^53, `n * 2 / 100` is an exactly
  rounded division, so the result is a correct half-up; the issues are the float use itself (#15) and the zero
  result (#16), not the rounding mode.
