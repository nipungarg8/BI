-- One embedding row per table per connection; index-schema upserts on
-- reindex instead of accumulating duplicates.
alter table table_embeddings
  add constraint table_embeddings_connection_table_key unique (connection_id, table_name);

-- Cosine-similarity search scoped to one connection. security invoker
-- (the default) means this still runs under the caller's RLS on
-- table_embeddings, so it can only ever match the caller's own rows.
create or replace function match_table_embeddings(
  query_embedding vector(768),
  match_connection_id uuid,
  match_count int default 5
)
returns table (
  table_name text,
  column_info jsonb,
  similarity float
)
language sql
stable
as $$
  select
    table_name,
    column_info,
    1 - (embedding <=> query_embedding) as similarity
  from table_embeddings
  where connection_id = match_connection_id
  order by embedding <=> query_embedding
  limit match_count;
$$;
