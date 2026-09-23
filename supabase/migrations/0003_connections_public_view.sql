-- A view of connections that never exposes encrypted_password to the
-- frontend. security_invoker makes it respect the caller's RLS on the
-- underlying table, so it still only returns the caller's own rows.
create view connections_public
with (security_invoker = true)
as
select id, user_id, name, host, port, db_name, username, ssl_mode, created_at
from connections;

grant select on connections_public to authenticated;
