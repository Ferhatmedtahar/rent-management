-- RLS / grants / audit / storage checks for supabase/migrations/20261020230000_security.sql.
-- Run (no local psql needed; do NOT use ON_ERROR_STOP, many errors are expected):
--   docker exec -i supabase_db_technical-test psql -U postgres -d postgres < docs/rls-checks.sql
-- Needs a freshly reset DB (npx supabase db reset). Everything is rolled back at the end.
-- Each case runs in its own savepoint and is rolled back, so cases do not affect each other.
-- Read each case: the "-- EXPECT" comment above it says what psql must print.
-- Fixture: Northwind (manager a1, staff a2, tenants Aisyah a3 + Ben a4), Beta (manager b1, tenant Chen b2).
-- SET, SAVEPOINT and ROLLBACK lines in the output are noise. Counts are printed as a "got" row and an "expected" row; they must be identical.

begin;
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000a2'),('00000000-0000-0000-0000-0000000000a3'),('00000000-0000-0000-0000-0000000000a4'),('00000000-0000-0000-0000-0000000000b1'),('00000000-0000-0000-0000-0000000000b2');
insert into organizations(id,name) values ('11111111-1111-1111-1111-111111111111','Northwind'),('22222222-2222-2222-2222-222222222222','Beta');
insert into memberships(user_id,org_id,role) values ('00000000-0000-0000-0000-0000000000a1','11111111-1111-1111-1111-111111111111','manager'),('00000000-0000-0000-0000-0000000000a2','11111111-1111-1111-1111-111111111111','staff'),('00000000-0000-0000-0000-0000000000b1','22222222-2222-2222-2222-222222222222','manager');
insert into units(id,org_id,name) values ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','A-12-3'),('aaaaaaaa-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','B-05-1'),('bbbbbbbb-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','KL-1');
insert into tenants(id,org_id,user_id,full_name,email,created_at,updated_at) values ('dddddddd-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-0000000000a3','Aisyah Rahman','aisyah@northwind.test','2020-01-01','2020-01-01'),('dddddddd-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-0000000000a4','Ben Lim','ben@northwind.test','2020-01-01','2020-01-01'),('dddddddd-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-0000000000b2','Chen Wei','chen@beta.test','2020-01-01','2020-01-01');
insert into leases(id,org_id,unit_id,tenant_id,start_date,end_date,monthly_rent_sen,deposit_sen,created_by) values ('cccccccc-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001','2026-01-31','2026-07-15',150000,300000,'00000000-0000-0000-0000-0000000000a1'),('cccccccc-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000002','dddddddd-0000-0000-0000-000000000002','2026-01-01','2026-04-15',100029,0,'00000000-0000-0000-0000-0000000000a1'),('cccccccc-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000003','2026-03-15','2027-03-14',220000,440000,'00000000-0000-0000-0000-0000000000b1');
insert into invoices(id,org_id,lease_id,kind,due_date,amount_sen) values ('eeeeeeee-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001','deposit','2026-01-31',300000),('eeeeeeee-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000002','deposit','2026-01-01',100000),('eeeeeeee-0000-0000-0000-000000000003','22222222-2222-2222-2222-222222222222','cccccccc-0000-0000-0000-000000000003','deposit','2026-03-15',440000);
insert into payments(id,org_id,lease_id,amount_sen,method,status,received_at,recorded_by,reviewed_by,reviewed_at) values ('ffffffff-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001',100000,'cash','approved','2026-01-31 10:00+08','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a1','2026-01-31 10:00+08'),('ffffffff-0000-0000-0000-000000000002','22222222-2222-2222-2222-222222222222','cccccccc-0000-0000-0000-000000000003',200000,'cash','approved','2026-03-15 10:00+08','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b1','2026-03-15 10:00+08');
insert into payment_allocations(org_id,lease_id,payment_id,invoice_id,amount_sen) values ('11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001','ffffffff-0000-0000-0000-000000000001','eeeeeeee-0000-0000-0000-000000000001',100000),('22222222-2222-2222-2222-222222222222','cccccccc-0000-0000-0000-000000000003','ffffffff-0000-0000-0000-000000000002','eeeeeeee-0000-0000-0000-000000000003',200000);
insert into gateway_bills(id,org_id,lease_id,amount_sen,created_by) values ('bill_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001',50000,'00000000-0000-0000-0000-0000000000a3'),('bill_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB','22222222-2222-2222-2222-222222222222','cccccccc-0000-0000-0000-000000000003',50000,'00000000-0000-0000-0000-0000000000b2');
insert into audit_log(org_id,actor_id,action,entity_type,entity_id,details) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-0000000000a1','lease.created','lease','cccccccc-0000-0000-0000-000000000001','{}'),('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-0000000000a1','lease.created','lease','cccccccc-0000-0000-0000-000000000002','{}'),('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-0000000000b1','lease.created','lease','cccccccc-0000-0000-0000-000000000003','{}');
insert into storage.objects(bucket_id,name) values ('payment-slips','11111111-1111-1111-1111-111111111111/seed.pdf'),('payment-slips','22222222-2222-2222-2222-222222222222/seed.pdf');

-- ===== 0. Static privilege matrix (as postgres) =====
-- EXPECT: anon_any_priv = 0, authenticated_write_priv = 0 (writes are column-only), tables_without_rls = 0, public_functions = 0
select count(*) filter (where has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate,references,trigger')) as anon_any_priv, count(*) filter (where has_table_privilege('authenticated', c.oid, 'insert,update,delete,truncate')) as authenticated_write_priv, count(*) filter (where not c.relrowsecurity) as tables_without_rls, (select count(*) from pg_proc where pronamespace = 'public'::regnamespace) as public_functions from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','v','m','p');
-- EXPECT: anon_member_org_exec = f, anon_private_usage = f, public_exec = f, authenticated_exec = t (needed by policies; schema private is not exposed over HTTP)
select has_function_privilege('anon', 'private.member_org_id()', 'execute') as anon_member_org_exec, has_schema_privilege('anon', 'private', 'usage') as anon_private_usage, exists (select 1 from pg_proc p where p.pronamespace = 'private'::regnamespace and p.proacl is null) as public_exec, has_function_privilege('authenticated', 'private.member_org_id()', 'execute') as authenticated_exec;
-- EXPECT: one row, column tenants.phone only
select table_name, column_name, privilege_type from information_schema.column_privileges where grantee = 'authenticated' and table_schema = 'public' and privilege_type = 'UPDATE' and table_name in (select table_name from information_schema.tables where table_schema='public') order by 1, 2;

-- ===== A. anon sees and writes nothing =====
-- EXPECT A1..A4: ERROR permission denied for table organizations / leases / organizations / schema private
savepoint a1;
set local role anon;
select count(*) from organizations;
rollback to a1;

savepoint a2;
set local role anon;
select count(*) from leases;
rollback to a2;

savepoint a3;
set local role anon;
insert into organizations(name) values ('hack');
rollback to a3;

savepoint a4;
set local role anon;
select private.member_org_id();
rollback to a4;

-- EXPECT A5: 0 rows (RLS; anon has no policy on storage.objects)
savepoint a5;
set local role anon;
select count(*) as storage_rows from storage.objects;
rollback to a5;

-- ===== B. tenant Aisyah (Northwind) =====
-- EXPECT B1: got = expected (only her own rows; no memberships, no audit)
savepoint b1;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select 'got' as row, (select count(*) from organizations) as organizations, (select count(*) from memberships) as memberships, (select count(*) from units) as units, (select count(*) from tenants) as tenants, (select count(*) from leases) as leases, (select count(*) from invoices) as invoices, (select count(*) from payments) as payments, (select count(*) from payment_allocations) as payment_allocations, (select count(*) from gateway_bills) as gateway_bills, (select count(*) from audit_log) as audit_log union all select 'expected', 1, 0, 1, 1, 1, 1, 1, 1, 1, 0;
rollback to b1;

-- EXPECT B2: ERROR permission denied for table tenants (full_name is not updatable)
savepoint b2;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
update tenants set full_name = 'Hacked' where user_id = '00000000-0000-0000-0000-0000000000a3';
rollback to b2;

-- EXPECT B3: ERROR permission denied for table tenants (org_id is not updatable)
savepoint b3;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
update tenants set org_id = '22222222-2222-2222-2222-222222222222' where user_id = '00000000-0000-0000-0000-0000000000a3';
rollback to b3;

-- EXPECT B4: one row: phone = 012-3456789, updated_at_moved = t (the updated_at trigger fired for a phone-only update)
savepoint b4;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
update tenants set phone = '012-3456789' where user_id = '00000000-0000-0000-0000-0000000000a3' returning phone, updated_at > created_at as updated_at_moved;
rollback to b4;

-- EXPECT B5: UPDATE 0 (Ben's row is invisible to Aisyah)
savepoint b5;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
update tenants set phone = '999' where user_id = '00000000-0000-0000-0000-0000000000a4';
rollback to b5;

-- EXPECT B6: ERROR violates check constraint "tenants_phone_shape"
savepoint b6;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
update tenants set phone = 'call me' where user_id = '00000000-0000-0000-0000-0000000000a3';
rollback to b6;

-- EXPECT B7..B10: ERROR permission denied for table tenants / leases / payments / audit_log
savepoint b7;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
insert into tenants(org_id,user_id,full_name,email) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-0000000000b1','x','x@x.test');
rollback to b7;

savepoint b8;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
delete from leases;
rollback to b8;

savepoint b9;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
update payments set status = 'voided';
rollback to b9;

savepoint b10;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
insert into audit_log(org_id,action,entity_type,entity_id) values ('11111111-1111-1111-1111-111111111111','x','x','cccccccc-0000-0000-0000-000000000001');
rollback to b10;

-- EXPECT B11: UPDATE 0 for Beta's tenant row when Aisyah targets it (RLS)
savepoint b11;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
update tenants set phone = '999' where user_id = '00000000-0000-0000-0000-0000000000b2';
rollback to b11;

-- ===== C. tenant Ben: same org as Aisyah, must not see her payments =====
-- EXPECT C1: got = expected (invoices 1, payments 0, allocations 0, bills 0)
savepoint c1;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}';
select 'got' as row, (select count(*) from organizations) as organizations, (select count(*) from memberships) as memberships, (select count(*) from units) as units, (select count(*) from tenants) as tenants, (select count(*) from leases) as leases, (select count(*) from invoices) as invoices, (select count(*) from payments) as payments, (select count(*) from payment_allocations) as payment_allocations, (select count(*) from gateway_bills) as gateway_bills, (select count(*) from audit_log) as audit_log union all select 'expected', 1, 0, 1, 1, 1, 1, 0, 0, 0, 0;
rollback to c1;

-- ===== D. staff (Northwind): reads the organization, writes nothing =====
-- EXPECT D1: got = expected (whole Northwind, none of Beta, audit_log 0 rows)
savepoint d1;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select 'got' as row, (select count(*) from organizations) as organizations, (select count(*) from memberships) as memberships, (select count(*) from units) as units, (select count(*) from tenants) as tenants, (select count(*) from leases) as leases, (select count(*) from invoices) as invoices, (select count(*) from payments) as payments, (select count(*) from payment_allocations) as payment_allocations, (select count(*) from gateway_bills) as gateway_bills, (select count(*) from audit_log) as audit_log union all select 'expected', 1, 2, 2, 2, 2, 2, 1, 1, 1, 0;
rollback to d1;

-- EXPECT D2: UPDATE 0 (staff has the phone column grant but no policy matches another user's row)
savepoint d2;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
update tenants set phone = '999' where user_id = '00000000-0000-0000-0000-0000000000a3';
rollback to d2;

-- EXPECT D3, D4: ERROR permission denied for table payments / leases
savepoint d3;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
insert into payments(org_id,lease_id,amount_sen,method,status,received_at,recorded_by) values ('11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001',100,'cash','pending_verification',now(),'00000000-0000-0000-0000-0000000000a2');
rollback to d3;

savepoint d4;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
delete from leases;
rollback to d4;

-- ===== E. managers =====
-- EXPECT E1: got = expected (Northwind manager: whole Northwind incl. audit_log 2, nothing of Beta)
savepoint e1;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select 'got' as row, (select count(*) from organizations) as organizations, (select count(*) from memberships) as memberships, (select count(*) from units) as units, (select count(*) from tenants) as tenants, (select count(*) from leases) as leases, (select count(*) from invoices) as invoices, (select count(*) from payments) as payments, (select count(*) from payment_allocations) as payment_allocations, (select count(*) from gateway_bills) as gateway_bills, (select count(*) from audit_log) as audit_log union all select 'expected', 1, 2, 2, 2, 2, 2, 1, 1, 1, 2;
rollback to e1;

-- EXPECT E2: 0 (a Northwind manager cannot read Beta rows)
savepoint e2;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select count(*) as beta_leases from leases where org_id = '22222222-2222-2222-2222-222222222222';
rollback to e2;

-- EXPECT E3: got = expected (Beta manager sees only Beta, audit_log 1)
savepoint e3;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select 'got' as row, (select count(*) from organizations) as organizations, (select count(*) from memberships) as memberships, (select count(*) from units) as units, (select count(*) from tenants) as tenants, (select count(*) from leases) as leases, (select count(*) from invoices) as invoices, (select count(*) from payments) as payments, (select count(*) from payment_allocations) as payment_allocations, (select count(*) from gateway_bills) as gateway_bills, (select count(*) from audit_log) as audit_log union all select 'expected', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1;
rollback to e3;

-- EXPECT E4: 0 (a Beta manager cannot read Northwind rows)
savepoint e4;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select count(*) as northwind_payments from payments where org_id = '11111111-1111-1111-1111-111111111111';
rollback to e4;

-- EXPECT E5, E6: ERROR permission denied for table audit_log (no INSERT/UPDATE grant)
savepoint e5;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
insert into audit_log(org_id,action,entity_type,entity_id) values ('11111111-1111-1111-1111-111111111111','x','x','cccccccc-0000-0000-0000-000000000001');
rollback to e5;

savepoint e6;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
update audit_log set action = 'tampered';
rollback to e6;

-- EXPECT E7: ERROR permission denied for table leases (managers write through the API, not the Data API)
savepoint e7;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
update leases set monthly_rent_sen = 1 where id = 'cccccccc-0000-0000-0000-000000000001';
rollback to e7;

-- ===== F. audit_log is append-only for postgres (owner) and service_role =====
-- EXPECT F1..F3: ERROR audit_log is append-only: UPDATE / DELETE / TRUNCATE is not allowed
savepoint f1;
update public.audit_log set action = 'tampered';
rollback to f1;

savepoint f2;
delete from public.audit_log;
rollback to f2;

savepoint f3;
truncate public.audit_log;
rollback to f3;

-- EXPECT F4: ERROR audit_log is append-only: UPDATE is not allowed (ENABLE ALWAYS: replica mode does not bypass it;
--   if your postgres role may not set session_replication_role you get 'permission denied to set parameter' instead, also fine)
savepoint f4;
set local session_replication_role = replica;
update public.audit_log set action = 'tampered';
rollback to f4;

-- EXPECT F5, F6: ERROR permission denied for table audit_log (service_role lost UPDATE/DELETE/TRUNCATE)
savepoint f5;
set local role service_role;
update public.audit_log set action = 'tampered';
rollback to f5;

savepoint f6;
set local role service_role;
delete from public.audit_log;
rollback to f6;

-- EXPECT F7: audit_rows = 3 (service_role can still read; it bypasses RLS)
savepoint f7;
set local role service_role;
select count(*) as audit_rows from public.audit_log;
rollback to f7;

-- EXPECT F8: INSERT 0 1 (appending is allowed for the owner)
savepoint f8;
insert into public.audit_log(org_id,action,entity_type,entity_id) values ('11111111-1111-1111-1111-111111111111','payment.approved','payment','ffffffff-0000-0000-0000-000000000001');
rollback to f8;

-- ===== G. Storage bucket payment-slips =====
-- EXPECT G1: payment-slips | f | 5242880 | {image/jpeg,image/png,application/pdf}
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'payment-slips';
-- EXPECT G2..G5: storage_rows = 1 for staff N, manager N, manager Beta (each sees only own folder); 0 for tenant Aisyah
savepoint g2;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select count(*) as storage_rows from storage.objects where bucket_id = 'payment-slips';
rollback to g2;

savepoint g3;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select count(*) as storage_rows from storage.objects where bucket_id = 'payment-slips';
rollback to g3;

savepoint g4;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select name from storage.objects where bucket_id = 'payment-slips';
rollback to g4;

savepoint g5;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select count(*) as storage_rows from storage.objects where bucket_id = 'payment-slips';
rollback to g5;

-- EXPECT G6: INSERT 0 1 (staff uploads into own org folder)
savepoint g6;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
insert into storage.objects(bucket_id,name) values ('payment-slips','11111111-1111-1111-1111-111111111111/new.pdf');
rollback to g6;

-- EXPECT G7..G10: ERROR new row violates row-level security policy for table "objects" (other org folder, malformed folder, tenant, bucket root)
savepoint g7;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
insert into storage.objects(bucket_id,name) values ('payment-slips','22222222-2222-2222-2222-222222222222/new.pdf');
rollback to g7;

savepoint g8;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
insert into storage.objects(bucket_id,name) values ('payment-slips','not-a-uuid/new.pdf');
rollback to g8;

savepoint g9;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
insert into storage.objects(bucket_id,name) values ('payment-slips','11111111-1111-1111-1111-111111111111/new.pdf');
rollback to g9;

savepoint g10;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
insert into storage.objects(bucket_id,name) values ('payment-slips','new.pdf');
rollback to g10;

-- EXPECT G11: ERROR new row violates row-level security policy for table "objects" (anon)
savepoint g11;
set local role anon;
insert into storage.objects(bucket_id,name) values ('payment-slips','11111111-1111-1111-1111-111111111111/new.pdf');
rollback to g11;

-- EXPECT G12: UPDATE 0 / DELETE 0 (no update or delete policy: slips are immutable through the Data API)
savepoint g12;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
update storage.objects set name = name || 'x' where bucket_id = 'payment-slips';
delete from storage.objects where bucket_id = 'payment-slips';
rollback to g12;

rollback;
