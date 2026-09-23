-- Metadata schema for the BI tool.
-- Stores app data only (connections, saved queries, dashboards, cache).
-- Query execution always happens on the customer's own database, never here.

create extension if not exists pgcrypto;
create extension if not exists vector;

-- ── connections ────────────────────────────────────────────────
create table connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  host text not null,
  port integer not null default 5432,
  db_name text not null,
  username text not null,
  encrypted_password text not null,
  ssl_mode text not null default 'require',
  created_at timestamptz not null default now()
);

alter table connections enable row level security;

create policy "connections_select_own" on connections
  for select using (user_id = auth.uid());
create policy "connections_insert_own" on connections
  for insert with check (user_id = auth.uid());
create policy "connections_update_own" on connections
  for update using (user_id = auth.uid());
create policy "connections_delete_own" on connections
  for delete using (user_id = auth.uid());

-- ── saved_queries ──────────────────────────────────────────────
create table saved_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references connections(id) on delete cascade,
  name text not null,
  structured_query jsonb not null,
  generated_sql text not null,
  created_at timestamptz not null default now()
);

alter table saved_queries enable row level security;

create policy "saved_queries_select_own" on saved_queries
  for select using (user_id = auth.uid());
create policy "saved_queries_insert_own" on saved_queries
  for insert with check (user_id = auth.uid());
create policy "saved_queries_update_own" on saved_queries
  for update using (user_id = auth.uid());
create policy "saved_queries_delete_own" on saved_queries
  for delete using (user_id = auth.uid());

-- ── dashboards ─────────────────────────────────────────────────
create table dashboards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  layout jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table dashboards enable row level security;

create policy "dashboards_select_own" on dashboards
  for select using (user_id = auth.uid());
create policy "dashboards_insert_own" on dashboards
  for insert with check (user_id = auth.uid());
create policy "dashboards_update_own" on dashboards
  for update using (user_id = auth.uid());
create policy "dashboards_delete_own" on dashboards
  for delete using (user_id = auth.uid());

-- ── dashboard_cards ────────────────────────────────────────────
create table dashboard_cards (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references dashboards(id) on delete cascade,
  saved_query_id uuid not null references saved_queries(id) on delete cascade,
  chart_type text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table dashboard_cards enable row level security;

create policy "dashboard_cards_select_own" on dashboard_cards
  for select using (
    exists (select 1 from dashboards d where d.id = dashboard_id and d.user_id = auth.uid())
  );
create policy "dashboard_cards_insert_own" on dashboard_cards
  for insert with check (
    exists (select 1 from dashboards d where d.id = dashboard_id and d.user_id = auth.uid())
  );
create policy "dashboard_cards_update_own" on dashboard_cards
  for update using (
    exists (select 1 from dashboards d where d.id = dashboard_id and d.user_id = auth.uid())
  );
create policy "dashboard_cards_delete_own" on dashboard_cards
  for delete using (
    exists (select 1 from dashboards d where d.id = dashboard_id and d.user_id = auth.uid())
  );

-- ── query_cache ────────────────────────────────────────────────
-- One cached result per saved query; the edge function upserts on refresh.
create table query_cache (
  saved_query_id uuid primary key references saved_queries(id) on delete cascade,
  result jsonb not null,
  row_count integer not null,
  cached_at timestamptz not null default now()
);

alter table query_cache enable row level security;

create policy "query_cache_select_own" on query_cache
  for select using (
    exists (select 1 from saved_queries q where q.id = saved_query_id and q.user_id = auth.uid())
  );
create policy "query_cache_upsert_own" on query_cache
  for insert with check (
    exists (select 1 from saved_queries q where q.id = saved_query_id and q.user_id = auth.uid())
  );
create policy "query_cache_update_own" on query_cache
  for update using (
    exists (select 1 from saved_queries q where q.id = saved_query_id and q.user_id = auth.uid())
  );
create policy "query_cache_delete_own" on query_cache
  for delete using (
    exists (select 1 from saved_queries q where q.id = saved_query_id and q.user_id = auth.uid())
  );

-- ── sheet_links ────────────────────────────────────────────────
create table sheet_links (
  id uuid primary key default gen_random_uuid(),
  saved_query_id uuid not null references saved_queries(id) on delete cascade,
  spreadsheet_id text not null,
  sheet_name text not null,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

alter table sheet_links enable row level security;

create policy "sheet_links_select_own" on sheet_links
  for select using (
    exists (select 1 from saved_queries q where q.id = saved_query_id and q.user_id = auth.uid())
  );
create policy "sheet_links_insert_own" on sheet_links
  for insert with check (
    exists (select 1 from saved_queries q where q.id = saved_query_id and q.user_id = auth.uid())
  );
create policy "sheet_links_update_own" on sheet_links
  for update using (
    exists (select 1 from saved_queries q where q.id = saved_query_id and q.user_id = auth.uid())
  );
create policy "sheet_links_delete_own" on sheet_links
  for delete using (
    exists (select 1 from saved_queries q where q.id = saved_query_id and q.user_id = auth.uid())
  );

-- ── table_embeddings ───────────────────────────────────────────
-- 768 dims: gemini-embedding-2 output truncated via outputDimensionality.
-- Adjust if the embedding model changes.
create table table_embeddings (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references connections(id) on delete cascade,
  table_name text not null,
  column_info jsonb not null,
  embedding vector(768),
  created_at timestamptz not null default now()
);

alter table table_embeddings enable row level security;

create policy "table_embeddings_select_own" on table_embeddings
  for select using (
    exists (select 1 from connections c where c.id = connection_id and c.user_id = auth.uid())
  );
create policy "table_embeddings_insert_own" on table_embeddings
  for insert with check (
    exists (select 1 from connections c where c.id = connection_id and c.user_id = auth.uid())
  );
create policy "table_embeddings_update_own" on table_embeddings
  for update using (
    exists (select 1 from connections c where c.id = connection_id and c.user_id = auth.uid())
  );
create policy "table_embeddings_delete_own" on table_embeddings
  for delete using (
    exists (select 1 from connections c where c.id = connection_id and c.user_id = auth.uid())
  );

create index table_embeddings_embedding_idx on table_embeddings
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ── query_usage ────────────────────────────────────────────────
-- One row per user per day; edge functions increment this to enforce
-- a daily query cap.
create table query_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  count integer not null default 0,
  primary key (user_id, usage_date)
);

alter table query_usage enable row level security;

create policy "query_usage_select_own" on query_usage
  for select using (user_id = auth.uid());

-- No insert/update policy for query_usage: only the service-role key used
-- by edge functions may write to it, bypassing RLS entirely.
