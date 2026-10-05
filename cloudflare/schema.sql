-- Skill Assist Tracker on Cloudflare D1 (SQLite), 2026-10-05: same tables and views as the Supabase/Postgres version
-- (supabase/migrations), so the website's queries stay the same. JSON columns (extra, data, columns) are stored as text.

create table if not exists clients (
  id          integer primary key autoincrement,
  name        text not null unique,
  notes       text,
  extra       text not null default '{}',
  created_at  text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table if not exists tracks (
  id          integer primary key autoincrement,
  client_id   integer not null references clients(id) on delete cascade,
  name        text not null,
  notes       text,
  extra       text not null default '{}',
  created_at  text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  csm         text,
  unique (client_id, name)
);
create index if not exists tracks_client_id_idx on tracks (client_id);

create table if not exists toc_files (
  id            integer primary key autoincrement,
  client_id     integer not null references clients(id) on delete cascade,
  track_id      integer references tracks(id) on delete set null,
  file_name     text not null,
  sheet_name    text not null,
  header_row    integer not null,
  columns       text not null default '[]',
  day_column    text,
  topic_column  text,
  source_link   text,
  notes         text,
  extra         text not null default '{}',
  uploaded_by   text,
  created_at    text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  unique (client_id, file_name, sheet_name)
);
create index if not exists toc_files_client_id_idx on toc_files (client_id);

create table if not exists toc_rows (
  id           integer primary key autoincrement,
  toc_file_id  integer not null references toc_files(id) on delete cascade,
  row_number   integer not null,
  day_label    text,
  topic        text,
  data         text not null default '{}',
  unique (toc_file_id, row_number)
);
create index if not exists toc_rows_toc_file_id_idx on toc_rows (toc_file_id);

create table if not exists content_types (
  name        text primary key,
  sort_order  integer not null default 100
);

create table if not exists contents (
  id              integer primary key autoincrement,
  client_id       integer not null references clients(id) on delete cascade,
  track_id        integer references tracks(id) on delete set null,
  content_type    text not null references content_types(name) on update cascade,
  sequence_label  text,
  name            text not null,
  delivery_date   text,
  notes           text,
  extra           text not null default '{}',
  created_by      text,
  created_at      text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
-- Postgres had UNIQUE NULLS NOT DISTINCT on these five columns; ifnull() gives the same rule in SQLite.
create unique index if not exists contents_identity
  on contents (client_id, ifnull(track_id, 0), content_type, ifnull(sequence_label, ''), name);
create index if not exists contents_client_id_idx on contents (client_id);
create index if not exists contents_track_id_idx on contents (track_id);

create trigger if not exists contents_touch after update on contents
for each row when new.updated_at = old.updated_at
begin
  update contents set updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = new.id;
end;

create table if not exists content_toc_links (
  content_id  integer not null references contents(id) on delete cascade,
  toc_row_id  integer not null references toc_rows(id) on delete cascade,
  created_at  text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (content_id, toc_row_id)
);
create index if not exists content_toc_links_toc_row_id_idx on content_toc_links (toc_row_id);

-- ---- read views (same columns as the Postgres views) ----
drop view if exists v_contents;
create view v_contents as
select c.id, c.client_id, cl.name as client_name, c.track_id, t.name as track_name, c.content_type,
       ct.sort_order as type_order, c.sequence_label, c.name, c.delivery_date, c.notes, c.extra, c.created_at,
       (select count(*) from content_toc_links l where l.content_id = c.id) as link_count,
       coalesce((select json_group_array(json(x.obj)) from (
           select json_object('toc_row_id', tr.id, 'file_name', tf.file_name, 'sheet_name', tf.sheet_name,
                              'row_number', tr.row_number, 'topic_column', tf.topic_column, 'day_label', tr.day_label,
                              'topic', tr.topic, 'data', json(tr.data), 'columns', json(tf.columns)) as obj
           from content_toc_links l join toc_rows tr on tr.id = l.toc_row_id join toc_files tf on tf.id = tr.toc_file_id
           where l.content_id = c.id order by tf.file_name, tr.row_number) x), '[]') as topics,
       coalesce((select group_concat(coalesce(tr.topic, '') || ' ' || tr.data, ' | ')
           from content_toc_links l join toc_rows tr on tr.id = l.toc_row_id where l.content_id = c.id), '') as topics_text,
       t.csm,
       json_extract(t.extra, '$.date') as track_date
from contents c
join clients cl on cl.id = c.client_id
join content_types ct on ct.name = c.content_type
left join tracks t on t.id = c.track_id;

drop view if exists v_toc_rows;
create view v_toc_rows as
select tr.id, tr.toc_file_id, tf.file_name, tf.sheet_name, tf.topic_column, tf.client_id, cl.name as client_name,
       tf.track_id, t.name as track_name, tr.row_number, tr.day_label, tr.topic, tr.data, tr.data as data_text,
       (select count(*) from content_toc_links l where l.toc_row_id = tr.id) as content_count,
       coalesce((select json_group_array(json(x.obj)) from (
           select json_object('id', c.id, 'name', c.name, 'content_type', c.content_type,
                              'sequence_label', c.sequence_label, 'client_name', ccl.name) as obj
           from content_toc_links l join contents c on c.id = l.content_id join clients ccl on ccl.id = c.client_id
           where l.toc_row_id = tr.id order by c.content_type, c.name) x), '[]') as contents
from toc_rows tr
join toc_files tf on tf.id = tr.toc_file_id
join clients cl on cl.id = tf.client_id
left join tracks t on t.id = tf.track_id;

drop view if exists v_toc_files;
create view v_toc_files as
select tf.id, tf.client_id, tf.track_id, tf.file_name, tf.sheet_name, tf.header_row, tf.columns, tf.day_column,
       tf.topic_column, tf.source_link, tf.notes, tf.extra, tf.uploaded_by, tf.created_at,
       cl.name as client_name, t.name as track_name,
       (select count(*) from toc_rows r where r.toc_file_id = tf.id) as row_count
from toc_files tf
join clients cl on cl.id = tf.client_id
left join tracks t on t.id = tf.track_id;
