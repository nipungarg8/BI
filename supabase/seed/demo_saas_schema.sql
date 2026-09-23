-- Sample "customer" database for the demo: a small SaaS company's
-- customers, subscriptions, and invoices. Run this against the Neon
-- project that plays the role of the connected customer DB — NOT against
-- the Supabase metadata DB.
--
--   psql "$NEON_DEMO_DATABASE_URL" -f supabase/seed/demo_saas_schema.sql

create table if not exists customers (
  id serial primary key,
  company_name text not null,
  email text not null,
  plan text not null,
  signed_up_on date not null,
  country text not null
);

create table if not exists subscriptions (
  id serial primary key,
  customer_id integer not null references customers(id),
  plan text not null,
  monthly_price numeric(10, 2) not null,
  status text not null,
  started_on date not null,
  cancelled_on date
);

create table if not exists invoices (
  id serial primary key,
  customer_id integer not null references customers(id),
  amount numeric(10, 2) not null,
  status text not null,
  issued_on date not null,
  paid_on date
);

insert into customers (company_name, email, plan, signed_up_on, country) values
  ('Acme Robotics', 'billing@acmerobotics.example', 'growth', '2024-02-11', 'US'),
  ('Bluebird Media', 'accounts@bluebirdmedia.example', 'starter', '2024-03-02', 'CA'),
  ('Crescent Labs', 'finance@crescentlabs.example', 'enterprise', '2024-01-19', 'GB'),
  ('Driftwood Analytics', 'billing@driftwood.example', 'growth', '2024-05-27', 'US'),
  ('Everline Logistics', 'ap@everline.example', 'starter', '2024-06-14', 'DE'),
  ('Fernhill Studio', 'hello@fernhillstudio.example', 'growth', '2024-04-08', 'AU'),
  ('Glasswing Corp', 'billing@glasswing.example', 'enterprise', '2023-11-30', 'US'),
  ('Harborlight Co', 'accounts@harborlight.example', 'starter', '2024-07-01', 'CA'),
  ('Ironpeak Systems', 'finance@ironpeak.example', 'growth', '2024-02-22', 'US'),
  ('Juniper Grove', 'billing@junipergrove.example', 'starter', '2024-08-09', 'GB')
on conflict do nothing;

insert into subscriptions (customer_id, plan, monthly_price, status, started_on, cancelled_on) values
  (1, 'growth', 199.00, 'active', '2024-02-11', null),
  (2, 'starter', 49.00, 'active', '2024-03-02', null),
  (3, 'enterprise', 899.00, 'active', '2024-01-19', null),
  (4, 'growth', 199.00, 'cancelled', '2024-05-27', '2024-09-01'),
  (5, 'starter', 49.00, 'active', '2024-06-14', null),
  (6, 'growth', 199.00, 'active', '2024-04-08', null),
  (7, 'enterprise', 899.00, 'active', '2023-11-30', null),
  (8, 'starter', 49.00, 'active', '2024-07-01', null),
  (9, 'growth', 199.00, 'active', '2024-02-22', null),
  (10, 'starter', 49.00, 'cancelled', '2024-08-09', '2024-09-20')
on conflict do nothing;

insert into invoices (customer_id, amount, status, issued_on, paid_on) values
  (1, 199.00, 'paid', '2024-03-01', '2024-03-03'),
  (1, 199.00, 'paid', '2024-04-01', '2024-04-02'),
  (2, 49.00, 'paid', '2024-04-02', '2024-04-04'),
  (3, 899.00, 'paid', '2024-02-19', '2024-02-20'),
  (3, 899.00, 'paid', '2024-03-19', '2024-03-21'),
  (4, 199.00, 'paid', '2024-06-27', '2024-06-28'),
  (4, 199.00, 'overdue', '2024-08-27', null),
  (5, 49.00, 'paid', '2024-07-14', '2024-07-15'),
  (6, 199.00, 'paid', '2024-05-08', '2024-05-09'),
  (7, 899.00, 'paid', '2023-12-30', '2023-12-31'),
  (8, 49.00, 'paid', '2024-08-01', '2024-08-03'),
  (9, 199.00, 'overdue', '2024-08-22', null),
  (10, 49.00, 'paid', '2024-08-09', '2024-08-10')
on conflict do nothing;

-- Read-only role for the app to connect as. Replace the password before
-- running, and use that value (not any superuser credential) in the
-- "Add connection" form.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'bi_tool_reader') then
    create role bi_tool_reader login password 'REPLACE_ME';
  end if;
end
$$;

-- CONNECT is granted to PUBLIC by default on Neon/Postgres, so no explicit
-- grant is needed unless your database revokes it.
grant usage on schema public to bi_tool_reader;
grant select on all tables in schema public to bi_tool_reader;
alter default privileges in schema public grant select on tables to bi_tool_reader;
