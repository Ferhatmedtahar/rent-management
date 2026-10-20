-- Migration 2 of 3: security.
-- Grants (closed by default, then only the Data API matrix of ASSESSMENT.md
-- section 6), RLS on every table, private helper functions, audit_log
-- append-only, Storage bucket `payment-slips` and its policies.
--
-- Prisma and the service role connect as the table owner / bypass RLS; their
-- authorization lives in the service layer (docs/adr/0010). RLS is therefore
-- NOT forced. Everything below protects the Data API (PostgREST) and Storage.

-- ---------------------------------------------------------------------------
-- 1. Close everything, then open only what the matrix allows
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

-- Future objects created by this role start closed (Supabase's defaults would
-- otherwise grant ALL on every new public table to anon and authenticated).
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
-- Postgres grants EXECUTE on new functions to PUBLIC by default; undo that.
alter default privileges for role postgres revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- 2. Helper functions (private schema: not exposed by the Data API, so
--    /rest/v1/rpc cannot reach them; api.schemas = public, graphql_public)
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so they read memberships/tenants/leases without RLS: this is
-- what keeps policies from referencing their own table (no recursion).
-- Empty search_path and schema-qualified names: no search_path hijack.

-- The staff/manager organization of the caller, or NULL.
create function private.member_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id from public.memberships m where m.user_id = (select auth.uid())
$$;

-- The organization of the caller if (and only if) the caller is a manager.
create function private.manager_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id from public.memberships m
  where m.user_id = (select auth.uid()) and m.role = 'manager'
$$;

-- The organization of the caller's tenant row, or NULL.
create function private.tenant_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.org_id from public.tenants t where t.user_id = (select auth.uid())
$$;

-- Ids of the leases that belong to the caller's tenant row.
create function private.my_lease_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select l.id from public.leases l
  join public.tenants t on t.id = l.tenant_id and t.org_id = l.org_id
  where t.user_id = (select auth.uid())
$$;

-- Ids of the units of the caller's own leases.
create function private.my_unit_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select l.unit_id from public.leases l
  join public.tenants t on t.id = l.tenant_id and t.org_id = l.org_id
  where t.user_id = (select auth.uid())
$$;

-- Nobody can call these over HTTP (schema not exposed). Close EXECUTE for
-- PUBLIC and anon as well. `authenticated` keeps EXECUTE + schema USAGE only
-- because Postgres checks them when an RLS policy expression calls a function.
revoke all on schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.member_org_id() to authenticated;
grant execute on function private.manager_org_id() to authenticated;
grant execute on function private.tenant_org_id() to authenticated;
grant execute on function private.my_lease_ids() to authenticated;
grant execute on function private.my_unit_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Data API grants: SELECT only (matrix), plus UPDATE (phone) for tenants.
--    anon gets nothing. Every other insert/update/delete fails: no grant.
-- ---------------------------------------------------------------------------

grant select on
  public.organizations,
  public.memberships,
  public.units,
  public.tenants,
  public.leases,
  public.invoices,
  public.payments,
  public.payment_allocations,
  public.gateway_bills,
  public.audit_log
to authenticated;

-- Column-level: a tenant can change phone and nothing else. The updated_at
-- trigger still fires: a trigger assigning NEW.updated_at needs no column grant.
grant update (phone) on public.tenants to authenticated;

-- ---------------------------------------------------------------------------
-- 4. RLS on every table (not FORCEd), then policies
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.units enable row level security;
alter table public.tenants enable row level security;
alter table public.leases enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.gateway_bills enable row level security;
alter table public.audit_log enable row level security;

-- Policies are PERMISSIVE and OR together: one for staff/manager, one for the
-- tenant. Each calls helpers wrapped in (select ...) so Postgres evaluates them
-- once per statement instead of once per row. A NULL helper result (caller has
-- no such role) makes the comparison NULL, i.e. no rows.

-- organizations: own organization (staff, manager or tenant).
create policy organizations_select_own on public.organizations
  for select to authenticated
  using (id = (select private.member_org_id()) or id = (select private.tenant_org_id()));

-- memberships: staff/manager read their organization; tenants have no membership.
create policy memberships_select_org on public.memberships
  for select to authenticated
  using (org_id = (select private.member_org_id()));

-- units: staff/manager read their organization; tenant reads the units of own leases.
create policy units_select_org on public.units
  for select to authenticated
  using (org_id = (select private.member_org_id()));
create policy units_select_own_leases on public.units
  for select to authenticated
  using (id in (select private.my_unit_ids()));

-- tenants: staff/manager read their organization; tenant reads and updates own row.
create policy tenants_select_org on public.tenants
  for select to authenticated
  using (org_id = (select private.member_org_id()));
create policy tenants_select_own on public.tenants
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy tenants_update_own on public.tenants
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- leases: staff/manager read their organization; tenant reads own leases.
create policy leases_select_org on public.leases
  for select to authenticated
  using (org_id = (select private.member_org_id()));
create policy leases_select_own on public.leases
  for select to authenticated
  using (id in (select private.my_lease_ids()));

-- invoices, payments, payment_allocations, gateway_bills: same shape, by lease_id.
create policy invoices_select_org on public.invoices
  for select to authenticated
  using (org_id = (select private.member_org_id()));
create policy invoices_select_own on public.invoices
  for select to authenticated
  using (lease_id in (select private.my_lease_ids()));

create policy payments_select_org on public.payments
  for select to authenticated
  using (org_id = (select private.member_org_id()));
create policy payments_select_own on public.payments
  for select to authenticated
  using (lease_id in (select private.my_lease_ids()));

create policy payment_allocations_select_org on public.payment_allocations
  for select to authenticated
  using (org_id = (select private.member_org_id()));
create policy payment_allocations_select_own on public.payment_allocations
  for select to authenticated
  using (lease_id in (select private.my_lease_ids()));

create policy gateway_bills_select_org on public.gateway_bills
  for select to authenticated
  using (org_id = (select private.member_org_id()));
create policy gateway_bills_select_own on public.gateway_bills
  for select to authenticated
  using (lease_id in (select private.my_lease_ids()));

-- audit_log: managers of the organization only (staff and tenants see 0 rows).
create policy audit_log_select_manager on public.audit_log
  for select to authenticated
  using (org_id = (select private.manager_org_id()));

-- ---------------------------------------------------------------------------
-- 5. audit_log append-only for everyone, including service_role and the owner
-- ---------------------------------------------------------------------------
-- Triggers fire for the table owner and for service_role (RLS and grants do
-- not bind them). ENABLE ALWAYS makes them fire even when
-- session_replication_role = replica. A superuser can still DROP the trigger;
-- that is outside what a trigger can guard.

create function private.audit_log_reject_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only: % is not allowed', tg_op
    using errcode = '42501';
end;
$$;

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function private.audit_log_reject_change();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function private.audit_log_reject_change();

alter table public.audit_log enable always trigger audit_log_no_update_delete;
alter table public.audit_log enable always trigger audit_log_no_truncate;

-- Belt and braces: service_role loses the privileges too (INSERT/SELECT stay).
revoke update, delete, truncate on public.audit_log from service_role;
-- Trigger functions are run by the trigger machinery; nobody needs EXECUTE.
revoke all on function private.audit_log_reject_change() from public, anon, authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Storage: private bucket for bank-transfer slips
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-slips',
  'payment-slips',
  false,
  5242880, -- 5 MiB
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Only staff/manager of the organization whose id is the first path segment
-- (`<org_id>/...`) may upload or read. The folder is compared as TEXT against
-- the caller's org id cast to text: a malformed folder just fails to match,
-- it never raises an invalid-uuid error. No UPDATE/DELETE policy: slips are
-- immutable for the Data API (orphan cleanup uses the service role on the
-- server). No tenant and no anon policy: they get nothing.
create policy payment_slips_insert_org on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-slips'
    and (storage.foldername(name))[1] = (select private.member_org_id()::text)
  );

create policy payment_slips_select_org on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payment-slips'
    and (storage.foldername(name))[1] = (select private.member_org_id()::text)
  );
