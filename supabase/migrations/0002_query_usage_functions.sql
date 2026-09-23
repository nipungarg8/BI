-- Atomically increments today's query count for a user and returns the new
-- total. Edge functions call this with the service-role client (bypasses
-- RLS) to enforce a per-user daily query cap before running a query.
create or replace function increment_query_usage(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into query_usage (user_id, usage_date, count)
  values (p_user_id, current_date, 1)
  on conflict (user_id, usage_date)
  do update set count = query_usage.count + 1
  returning count into new_count;

  return new_count;
end;
$$;
