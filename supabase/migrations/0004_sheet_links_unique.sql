-- One sheet link per saved query, so push-to-sheet can upsert on conflict.
alter table sheet_links add constraint sheet_links_saved_query_id_key unique (saved_query_id);
