# UI QA & Verification Guide

This document guides manual and automated quality assurance for the Rent Collection System UI across all user roles, timezones, and states.

---

## 1. Test Accounts & Credentials

| Role                    | Email                    | Password            | Initial Landing |
| :---------------------- | :----------------------- | :------------------ | :-------------- |
| **Manager (Northwind)** | `manager@northwind.test` | `test_password_123` | `/dashboard`    |
| **Staff (Northwind)**   | `staff@northwind.test`   | `test_password_123` | `/dashboard`    |
| **Tenant (Aisyah)**     | `aisyah@northwind.test`  | `test_password_123` | `/portal`       |
| **Tenant (Ben)**        | `ben@northwind.test`     | `test_password_123` | `/portal`       |
| **Manager (Beta)**      | `manager@beta.test`      | `test_password_123` | `/dashboard`    |

---

## 2. QA Walkthrough Checklist

### 2.1 Authentication & Shell

- [x] **Unauthenticated redirect:** Navigate to `/dashboard`, `/leases`, or `/portal` while logged out $\rightarrow$ redirected to `/login`.
- [x] **Invalid credentials:** Enter `manager@northwind.test` with password `wrongpass` $\rightarrow$ shows inline error banner `"Incorrect email or password"` without page crash.
- [x] **Role redirection:**
  - Login as manager $\rightarrow$ redirected to `/dashboard`.
  - Login as tenant $\rightarrow$ redirected to `/portal`.
  - Open `/` $\rightarrow$ redirects to `/dashboard` for staff/manager, `/portal` for tenant, `/login` if unauthenticated.
- [x] **Sign out:** Click "Sign Out" in header $\rightarrow$ Supabase session cleared, query cache reset, redirected to `/login`.
- [x] **Role mismatch protection:** A tenant trying to view `/dashboard` or `/leases` sees an access denied message; staff attempting to view `/portal` sees tenant-only restriction.

---

### 2.2 Dashboard (`/dashboard`)

- [x] **Overdue Metric:** Displays count of past-due unpaid invoices in Malaysia time.
- [x] **Collections Table:** Displays collections across the last 6 calendar months in Malaysia time with formatted currency (`RM X,XXX.XX`) and totals.
- [x] **Navigation link:** "View leases" button links to `/leases`.

---

### 2.3 Leases List (`/leases`)

- [x] **Table view:** Lists organization leases with Unit, Tenant, Period, Monthly rent, and Deposit.
- [x] **Client-side filtering:** Type unit or tenant name in search box $\rightarrow$ live filtering with zero flicker.
- [x] **Create lease (Manager only):**
  - "Create lease" button visible only to managers.
  - Dialog allows selecting unit and tenant from organization RLS.
  - Live schedule preview displays total generated invoices via pure `generateSchedule`.
  - Submitting creates lease and invalidates lease list cache.
- [x] **Row click:** Navigates to `/leases/[leaseId]`.

---

### 2.4 Lease Detail (`/leases/[leaseId]`)

- [x] **Aisyah's Lease (`11111111-1111-1111-1111-111111111111`):**
  - Unit: `Unit A-12-3`, Tenant: `Aisyah`.
  - 7 invoices listed in allocation order starting with the deposit.
  - Columns: Period, Due Date (MYT), Amount (RM), Paid (RM), Balance (RM), Status Badge.
  - Bottom totals row with exact integer sums.
- [x] **Payments Table:**
  - RM 3,000 cash payment and RM 2,000 bank transfer payment.
  - Bank transfer shows "View slip" button $\rightarrow$ opens signed storage URL in new tab.
- [x] **Record Payment (Staff / Manager):**
  - Overpayment prevention: entering an amount above outstanding balance shows error.
  - Cash vs Bank transfer: bank transfer validates JPEG, PNG, or PDF up to 5 MB.
  - Uploads slip to Supabase storage before creating payment.
  - Staff: recorded payment has status `Pending verification`, toast `"Payment recorded, waiting for manager approval"`.
  - Manager: recorded payment is auto-approved, toast `"Payment recorded"`.
- [x] **Review Actions (Manager only):**
  - Approve `Pending verification` payment $\rightarrow$ confirmation dialog $\rightarrow$ approved, allocations applied.
  - Reject `Pending verification` payment $\rightarrow$ dialog requires $\ge 5$ character reason $\rightarrow$ rejected.
  - Void `Approved` payment $\rightarrow$ dialog requires $\ge 5$ character reason $\rightarrow$ voided, allocations rolled back.

---

### 2.5 Tenant Portal (`/portal`)

- [x] **Profile & Lease Card:**
  - Displays tenant name, email, phone, unit name, dates, monthly rent, deposit.
- [x] **Inline Phone Edit:**
  - Enter valid phone number $\rightarrow$ updates via Supabase RLS $\rightarrow$ toast `"Phone updated"`.
  - Invalid characters $\rightarrow$ inline validation error.
- [x] **Amount Due Now:**
  - Sum of unpaid invoices due on or before today in Malaysia time.
  - Button disabled when nothing is due.
- [x] **Pay Now & Online Gateway:**
  - When balance is due, click "Pay Now" $\rightarrow$ creates bill via `POST /api/leases/:id/gateway-bills`.
  - Dialog presents Bill ID with copy button and instructions.
  - Click "Check payment status" $\rightarrow$ navigates to `/payments/return?bill_id=<id>`.
  - Simulate gateway confirmation:
    `GATEWAY_X_SIGNATURE_KEY=test_x_signature_key node gateway-sim.mjs <billId> <amount>`
  - Return screen polls status and updates to "Payment Received" automatically without page reload.

---

## 3. Timezone & Localization Guarantees

All dates, due dates, billing periods, and overdue flags operate under **Asia/Kuala_Lumpur (UTC+8, no DST)**:

- Verified under UTC, `Asia/Kuala_Lumpur`, and `America/New_York` using `pnpm test:tz`.
- Tested in Chrome DevTools -> Sensors: no hydration mismatch warnings in the browser console.
- Display money is formatted exclusively using `formatSen` from integer sen amounts.
