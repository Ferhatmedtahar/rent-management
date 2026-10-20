-- Migration 1 of 3: schema.
-- Tables, keys, composite FKs, CHECKs, lease-overlap exclusion, indexes, updated_at.
-- NOT here: RLS, grants, Storage (migration 2); audit append-only (migration 2);
-- optional integrity triggers (migration 3, later). See docs/database.md.
--
-- Do not deploy this file without migration 2: Supabase's default privileges
-- grant ALL on new public tables to anon/authenticated until migration 2 revokes them.
--
-- Conventions: money = bigint sen (>= 0 / > 0, <= 1e12); calendar dates = date;
-- instants = timestamptz; ON DELETE RESTRICT everywhere; composite FKs
-- (x_id, org_id) so a row can never reference another organization's record.
-- CHECKs on nullable columns always say "is not null and ..." because a CHECK
-- that evaluates to NULL passes.

-- ---------------------------------------------------------------------------
-- Extensions, schemas
-- ---------------------------------------------------------------------------

-- Needed for the exclusion constraint on leases (uuid equality inside gist).
create extension if not exists btree_gist with schema extensions;

-- Not exposed by the Data API (api.schemas = public, graphql_public).
create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Enums (invoice_kind order matters: 'deposit' sorts before 'rent')
-- ---------------------------------------------------------------------------

create type public.membership_role as enum ('manager', 'staff');
create type public.invoice_kind as enum ('deposit', 'rent');
create type public.payment_method as enum ('cash', 'bank_transfer', 'online');
create type public.payment_status as enum ('pending_verification', 'approved', 'rejected', 'voided');
create type public.bill_status as enum ('pending', 'paid', 'failed');

-- ---------------------------------------------------------------------------
-- updated_at trigger function
-- ---------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  constraint organizations_name_not_blank check (btrim(name) <> '')
);

-- ---------------------------------------------------------------------------
-- memberships: staff and managers. user_id is the PK = exactly one organization.
-- ---------------------------------------------------------------------------

create table public.memberships (
  user_id uuid primary key references auth.users (id) on delete restrict,
  org_id uuid not null references public.organizations (id) on delete restrict,
  role public.membership_role not null,
  created_at timestamptz not null default now(),
  constraint memberships_user_org_key unique (user_id, org_id)
);

create index memberships_org_id_idx on public.memberships (org_id);

-- ---------------------------------------------------------------------------
-- units
-- ---------------------------------------------------------------------------

create table public.units (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now(),
  constraint units_org_name_key unique (org_id, name),
  constraint units_id_org_key unique (id, org_id),
  constraint units_name_not_blank check (btrim(name) <> '')
);

-- ---------------------------------------------------------------------------
-- tenants: the renter record, one per login (user_id NOT NULL UNIQUE).
-- A tenant may update only phone (column grant, migration 2).
-- ---------------------------------------------------------------------------

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete restrict,
  full_name text not null,
  email text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_user_id_key unique (user_id),
  constraint tenants_id_org_key unique (id, org_id),
  constraint tenants_full_name_not_blank check (btrim(full_name) <> ''),
  constraint tenants_email_not_blank check (btrim(email) <> ''),
  constraint tenants_phone_shape check (
    phone is null or (char_length(phone) <= 20 and phone ~ '^[0-9+() -]+$')
  )
);

create index tenants_org_id_idx on public.tenants (org_id);

create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- leases
-- ---------------------------------------------------------------------------

create table public.leases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  unit_id uuid not null,
  tenant_id uuid not null,
  start_date date not null,
  end_date date not null, -- inclusive: the tenant's last day
  monthly_rent_sen bigint not null,
  deposit_sen bigint not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  constraint leases_id_org_key unique (id, org_id),
  constraint leases_unit_fk foreign key (unit_id, org_id)
    references public.units (id, org_id) on delete restrict,
  constraint leases_tenant_fk foreign key (tenant_id, org_id)
    references public.tenants (id, org_id) on delete restrict,
  constraint leases_created_by_fk foreign key (created_by, org_id)
    references public.memberships (user_id, org_id) on delete restrict,
  constraint leases_dates_ordered check (end_date >= start_date),
  constraint leases_monthly_rent_range check (monthly_rent_sen > 0 and monthly_rent_sen <= 1000000000000),
  constraint leases_deposit_range check (deposit_sen >= 0 and deposit_sen <= 1000000000000),
  -- Leases on one unit never overlap; both dates inclusive. Race-proof: two
  -- concurrent inserts for the same unit cannot both commit (SQLSTATE 23P01).
  constraint leases_no_overlap exclude using gist (
    unit_id with =,
    (daterange(start_date, end_date, '[]')) with &&
  )
);

create index leases_tenant_id_idx on public.leases (tenant_id);
create index leases_org_created_idx on public.leases (org_id, created_at, id);

-- ---------------------------------------------------------------------------
-- invoices: mirror of ScheduledInvoice. No status and no paid column: paid is
-- the sum of payment_allocations, status is computed by invoiceStatus().
-- ---------------------------------------------------------------------------

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  lease_id uuid not null,
  kind public.invoice_kind not null,
  period_index integer,
  period_start date,
  period_end date, -- inclusive
  due_date date not null,
  amount_sen bigint not null,
  created_at timestamptz not null default now(),
  constraint invoices_id_lease_key unique (id, lease_id),
  constraint invoices_lease_fk foreign key (lease_id, org_id)
    references public.leases (id, org_id) on delete restrict,
  constraint invoices_amount_range check (amount_sen > 0 and amount_sen <= 1000000000000),
  constraint invoices_shape check (
    (
      kind = 'deposit'
      and period_index is null
      and period_start is null
      and period_end is null
    )
    or (
      kind = 'rent'
      and period_index is not null and period_index >= 0
      and period_start is not null
      and period_end is not null and period_end >= period_start
      and due_date = period_start
    )
  )
);

-- One invoice per rent period, at most one deposit per lease.
create unique index invoices_lease_period_key
  on public.invoices (lease_id, period_index) where kind = 'rent';
create unique index invoices_lease_deposit_key
  on public.invoices (lease_id) where kind = 'deposit';
-- Allocation order: due date, deposit before rent (enum order), period index.
create index invoices_lease_alloc_order_idx
  on public.invoices (lease_id, due_date, kind, period_index);
create index invoices_org_due_idx on public.invoices (org_id, due_date);

-- ---------------------------------------------------------------------------
-- gateway_bills (before payments: payments references it)
-- ---------------------------------------------------------------------------

create table public.gateway_bills (
  id text primary key, -- server-generated, unguessable: bill_ + 32..128 base64url chars
  org_id uuid not null,
  lease_id uuid not null,
  amount_sen bigint not null,
  status public.bill_status not null default 'pending',
  created_by uuid not null references public.tenants (user_id) on delete restrict,
  transaction_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gateway_bills_id_lease_amount_key unique (id, lease_id, amount_sen),
  constraint gateway_bills_lease_fk foreign key (lease_id, org_id)
    references public.leases (id, org_id) on delete restrict,
  constraint gateway_bills_id_format check (id ~ '^bill_[A-Za-z0-9_-]{32,128}$'),
  constraint gateway_bills_amount_range check (amount_sen > 0 and amount_sen <= 1000000000000),
  constraint gateway_bills_paid_has_paid_at check (status <> 'paid' or paid_at is not null),
  constraint gateway_bills_transaction_id_len check (
    transaction_id is null or char_length(transaction_id) between 1 and 255
  )
);

create index gateway_bills_lease_id_idx on public.gateway_bills (lease_id);
create index gateway_bills_org_id_idx on public.gateway_bills (org_id);

create trigger gateway_bills_set_updated_at
  before update on public.gateway_bills
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  lease_id uuid not null,
  amount_sen bigint not null,
  unapplied_sen bigint not null default 0,
  method public.payment_method not null,
  status public.payment_status not null,
  received_at timestamptz not null, -- online: the webhook paid_at
  slip_path text, -- bank_transfer only: <org_id>/...
  gateway_bill_id text, -- online only
  recorded_by uuid, -- null only for online
  reviewed_by uuid, -- approver or rejecter; null for online (system approval)
  reviewed_at timestamptz,
  reject_reason text,
  voided_by uuid,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_id_lease_key unique (id, lease_id),
  -- A bill creates at most one payment, ever (NULLs allowed many times).
  constraint payments_gateway_bill_id_key unique (gateway_bill_id),
  constraint payments_lease_fk foreign key (lease_id, org_id)
    references public.leases (id, org_id) on delete restrict,
  -- Payment can only point at a bill of its own lease with exactly its amount.
  -- Skipped (MATCH SIMPLE) for manual payments, where gateway_bill_id is NULL.
  constraint payments_gateway_bill_fk foreign key (gateway_bill_id, lease_id, amount_sen)
    references public.gateway_bills (id, lease_id, amount_sen) on delete restrict,
  constraint payments_recorded_by_fk foreign key (recorded_by, org_id)
    references public.memberships (user_id, org_id) on delete restrict,
  constraint payments_reviewed_by_fk foreign key (reviewed_by, org_id)
    references public.memberships (user_id, org_id) on delete restrict,
  constraint payments_voided_by_fk foreign key (voided_by, org_id)
    references public.memberships (user_id, org_id) on delete restrict,

  constraint payments_amount_range check (amount_sen > 0 and amount_sen <= 1000000000000),
  constraint payments_unapplied_range check (unapplied_sen >= 0 and unapplied_sen <= amount_sen),
  -- Only online payments may keep unapplied credit, and only while approved.
  constraint payments_unapplied_online_only check (method = 'online' or unapplied_sen = 0),
  constraint payments_unapplied_approved_only check (status = 'approved' or unapplied_sen = 0),

  constraint payments_online_has_bill check ((method = 'online') = (gateway_bill_id is not null)),
  constraint payments_bank_has_slip check ((method = 'bank_transfer') = (slip_path is not null)),
  constraint payments_online_is_system check (
    method <> 'online' or (recorded_by is null and status in ('approved', 'voided'))
  ),
  constraint payments_manual_has_recorder check (method = 'online' or recorded_by is not null),

  -- Slip lives in the payment's own org folder; no path traversal.
  constraint payments_slip_path_shape check (
    slip_path is null or (
      starts_with(slip_path, org_id::text || '/')
      and char_length(slip_path) > char_length(org_id::text) + 1
      and char_length(slip_path) <= 512
      and slip_path !~ '(^|/)\.\.(/|$)'
    )
  ),

  -- Status decides which review fields exist. Every branch is closed (else false).
  constraint payments_status_shape check (
    case status
      when 'pending_verification' then
        reviewed_by is null and reviewed_at is null and reject_reason is null
        and voided_by is null and voided_at is null and void_reason is null
      when 'approved' then
        reviewed_at is not null and (reviewed_by is not null or method = 'online')
        and reject_reason is null
        and voided_by is null and voided_at is null and void_reason is null
      when 'rejected' then
        reviewed_at is not null and reviewed_by is not null
        and reject_reason is not null and char_length(btrim(reject_reason)) >= 5
        and voided_by is null and voided_at is null and void_reason is null
      when 'voided' then
        reviewed_at is not null and (reviewed_by is not null or method = 'online')
        and reject_reason is null
        and voided_by is not null and voided_at is not null
        and void_reason is not null and char_length(btrim(void_reason)) >= 5
      else false
    end
  )
);

create index payments_lease_status_idx on public.payments (lease_id, status);
create index payments_org_created_idx on public.payments (org_id, created_at, id);
-- Collections report: range scan on received_at, approved only, index-only.
create index payments_report_idx
  on public.payments (org_id, received_at) include (amount_sen)
  where status = 'approved';

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- payment_allocations: payment and invoice must belong to the same lease.
-- ---------------------------------------------------------------------------

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  lease_id uuid not null,
  payment_id uuid not null,
  invoice_id uuid not null,
  amount_sen bigint not null,
  created_at timestamptz not null default now(),
  constraint payment_allocations_payment_invoice_key unique (payment_id, invoice_id),
  constraint payment_allocations_lease_fk foreign key (lease_id, org_id)
    references public.leases (id, org_id) on delete restrict,
  constraint payment_allocations_payment_fk foreign key (payment_id, lease_id)
    references public.payments (id, lease_id) on delete restrict,
  constraint payment_allocations_invoice_fk foreign key (invoice_id, lease_id)
    references public.invoices (id, lease_id) on delete restrict,
  constraint payment_allocations_amount_range check (amount_sen > 0 and amount_sen <= 1000000000000)
);

-- (payment_id, invoice_id) unique index already serves lookups by payment_id.
create index payment_allocations_invoice_id_idx on public.payment_allocations (invoice_id);
create index payment_allocations_lease_id_idx on public.payment_allocations (lease_id);
create index payment_allocations_org_id_idx on public.payment_allocations (org_id);

-- ---------------------------------------------------------------------------
-- audit_log: append-only enforcement comes in migration 2.
-- actor_id has no FK on purpose: the log must outlive and never block an
-- account; NULL = system.
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_log_action_not_blank check (btrim(action) <> ''),
  constraint audit_log_entity_type_not_blank check (btrim(entity_type) <> ''),
  constraint audit_log_details_is_object check (jsonb_typeof(details) = 'object')
);

create index audit_log_org_created_idx on public.audit_log (org_id, created_at desc, id);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
