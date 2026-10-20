-- Schema constraint checks for supabase/migrations/20261020220000_schema.sql.
-- Run (no local psql needed; do NOT use ON_ERROR_STOP, three errors are expected):
--   docker exec -i supabase_db_technical-test psql -U postgres -d postgres < docs/schema-checks.sql
-- Everything is rolled back at the end; nothing is left in the database.
-- Expected: exactly three ERROR lines:
--   1. conflicting key value violates exclusion constraint "leases_no_overlap"
--   2. violates foreign key constraint "leases_unit_fk"
--   3. duplicate key value violates unique constraint "payments_gateway_bill_id_key"

begin;
insert into auth.users(id) values
  ('00000000-0000-0000-0000-0000000000a1'),('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000b1');
insert into organizations(id,name) values
  ('11111111-1111-1111-1111-111111111111','Northwind'),
  ('22222222-2222-2222-2222-222222222222','Beta');
insert into memberships(user_id,org_id,role) values
  ('00000000-0000-0000-0000-0000000000a1','11111111-1111-1111-1111-111111111111','manager'),
  ('00000000-0000-0000-0000-0000000000b1','22222222-2222-2222-2222-222222222222','manager');
insert into units(id,org_id,name) values
  ('aaaaaaaa-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','A-12-3'),
  ('bbbbbbbb-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','KL-1');
insert into tenants(id,org_id,user_id,full_name,email) values
  ('dddddddd-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-0000000000a2','Aisyah','a@x.test');
insert into leases(id,org_id,unit_id,tenant_id,start_date,end_date,monthly_rent_sen,deposit_sen,created_by) values
  ('cccccccc-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0000-0000-0000-000000000001','dddddddd-0000-0000-0000-000000000001',
   '2026-01-31','2026-07-15',150000,300000,'00000000-0000-0000-0000-0000000000a1');

-- 1. Overlap rejected (2026-07-15 is the existing lease's inclusive last day)
savepoint s1;
insert into leases(org_id,unit_id,tenant_id,start_date,end_date,monthly_rent_sen,deposit_sen,created_by) values
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',
   'dddddddd-0000-0000-0000-000000000001','2026-07-15','2026-12-31',150000,0,
   '00000000-0000-0000-0000-0000000000a1');
rollback to s1;

-- 2. Northwind lease pointing at Beta's unit rejected
savepoint s2;
insert into leases(org_id,unit_id,tenant_id,start_date,end_date,monthly_rent_sen,deposit_sen,created_by) values
  ('11111111-1111-1111-1111-111111111111','bbbbbbbb-0000-0000-0000-000000000001',
   'dddddddd-0000-0000-0000-000000000001','2027-01-01','2027-02-01',100,0,
   '00000000-0000-0000-0000-0000000000a1');
rollback to s2;

-- 3. Second payment for one gateway bill rejected
insert into gateway_bills(id,org_id,lease_id,amount_sen,created_by) values
  ('bill_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA','11111111-1111-1111-1111-111111111111',
   'cccccccc-0000-0000-0000-000000000001',100000,'00000000-0000-0000-0000-0000000000a2');
insert into payments(org_id,lease_id,amount_sen,method,status,received_at,gateway_bill_id,reviewed_at) values
  ('11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001',
   100000,'online','approved','2026-04-01 00:30:12+08','bill_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',now());
savepoint s3;
insert into payments(org_id,lease_id,amount_sen,method,status,received_at,gateway_bill_id,reviewed_at) values
  ('11111111-1111-1111-1111-111111111111','cccccccc-0000-0000-0000-000000000001',
   100000,'online','approved',now(),'bill_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',now());
rollback to s3;
rollback;
