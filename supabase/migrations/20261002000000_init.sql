-- Skill Assist Tracker: core schema (stage 1)
--
-- Design rule: the core tables below stay stable across clients.
-- Anything client-specific (extra TOC columns, extra content attributes)
-- goes into the `data` / `extra` jsonb columns, so onboarding a new client
-- format does not require a schema change.

-- ---------------------------------------------------------------------------
-- Clients and tracks
-- ---------------------------------------------------------------------------
create table public.clients (
  id          bigint generated always as identity primary key,
  name        text not null unique,
  notes       text,
  extra       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table public.tracks (
  id          bigint generated always as identity primary key,
  client_id   bigint not null references public.clients(id) on delete cascade,
  name        text not null,
  notes       text,
  extra       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (client_id, name)
);

-- ---------------------------------------------------------------------------
-- TOC: one row per uploaded (file, sheet), one toc_row per Excel row kept
-- ---------------------------------------------------------------------------
create table public.toc_files (
  id            bigint generated always as identity primary key,
  client_id     bigint not null references public.clients(id) on delete cascade,
  track_id      bigint references public.tracks(id) on delete set null,
  file_name     text not null,
  sheet_name    text not null,
  header_row    int  not null,
  -- columns kept from the sheet, in order: [{"letter":"F","header":"Topic"}, ...]
  columns       jsonb not null default '[]'::jsonb,
  day_column    text,   -- column letter used as the "Day" label
  topic_column  text,   -- column letter used as the main "Topic"
  source_link   text,   -- where the original Excel lives (shared drive etc.)
  notes         text,
  extra         jsonb not null default '{}'::jsonb,
  uploaded_by   uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  unique (client_id, file_name, sheet_name)
);

create table public.toc_rows (
  id           bigint generated always as identity primary key,
  toc_file_id  bigint not null references public.toc_files(id) on delete cascade,
  row_number   int  not null,          -- Excel row number (1-based), e.g. 6 for G6
  day_label    text,                   -- e.g. "Day 1", "Pre-Program"
  topic        text,                   -- main topic text
  data         jsonb not null default '{}'::jsonb,  -- {"F · Topic": "...", "G · Sub Topic": "..."}
  unique (toc_file_id, row_number)
);

-- ---------------------------------------------------------------------------
-- Content created on Skill Assist
-- ---------------------------------------------------------------------------
create table public.content_types (
  name        text primary key,
  sort_order  int not null default 100
);

insert into public.content_types (name, sort_order) values
  ('Pre-Assessment',        10),
  ('Daily Assignment',      20),
  ('Milestone Assessment',  30),
  ('Capstone',              40),
  ('Direct Assessment',     50),
  ('Practice',              60);

create table public.contents (
  id              bigint generated always as identity primary key,
  client_id       bigint not null references public.clients(id) on delete cascade,
  track_id        bigint references public.tracks(id) on delete set null,
  content_type    text not null references public.content_types(name) on update cascade,
  sequence_label  text,   -- "1", "9 A", "M2" ... kept as text on purpose
  name            text not null,
  delivery_date   date,
  notes           text,
  extra           jsonb not null default '{}'::jsonb,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint contents_identity unique nulls not distinct
    (client_id, track_id, content_type, sequence_label, name)
);

create table public.content_toc_links (
  content_id  bigint not null references public.contents(id) on delete cascade,
  toc_row_id  bigint not null references public.toc_rows(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (content_id, toc_row_id)
);

create index on public.tracks (client_id);
create index on public.toc_files (client_id);
create index on public.toc_rows (toc_file_id);
create index on public.contents (client_id);
create index on public.contents (track_id);
create index on public.content_toc_links (toc_row_id);

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger contents_touch before update on public.contents
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Read views used by the portal
-- ---------------------------------------------------------------------------

-- One row per content item, with its linked TOC topics aggregated.
create view public.v_contents with (security_invoker = true) as
select
  c.id,
  c.client_id,
  cl.name                     as client_name,
  c.track_id,
  t.name                      as track_name,
  c.content_type,
  ct.sort_order               as type_order,
  c.sequence_label,
  c.name,
  c.delivery_date,
  c.notes,
  c.extra,
  c.created_at,
  count(tr.id)::int           as link_count,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'toc_row_id', tr.id,
        'file_name',  tf.file_name,
        'sheet_name', tf.sheet_name,
        'row_number', tr.row_number,
        'topic_column', tf.topic_column,
        'day_label',  tr.day_label,
        'topic',      tr.topic,
        'data',       tr.data
      ) order by tf.file_name, tr.row_number
    ) filter (where tr.id is not null),
    '[]'::jsonb
  )                           as topics,
  -- flat text of everything linked, used for keyword search
  coalesce(string_agg(coalesce(tr.topic, '') || ' ' || tr.data::text, ' | '), '') as topics_text
from public.contents c
join public.clients cl            on cl.id = c.client_id
join public.content_types ct      on ct.name = c.content_type
left join public.tracks t         on t.id = c.track_id
left join public.content_toc_links l on l.content_id = c.id
left join public.toc_rows tr      on tr.id = l.toc_row_id
left join public.toc_files tf     on tf.id = tr.toc_file_id
group by c.id, cl.name, t.name, ct.sort_order;

-- One row per TOC row, with the content built on it (reverse lookup for reuse).
create view public.v_toc_rows with (security_invoker = true) as
select
  tr.id,
  tr.toc_file_id,
  tf.file_name,
  tf.sheet_name,
  tf.topic_column,
  tf.client_id,
  cl.name                     as client_name,
  tf.track_id,
  t.name                      as track_name,
  tr.row_number,
  tr.day_label,
  tr.topic,
  tr.data,
  tr.data::text               as data_text,
  count(c.id)::int            as content_count,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'content_type', c.content_type,
        'sequence_label', c.sequence_label,
        'client_name', ccl.name
      ) order by c.content_type, c.name
    ) filter (where c.id is not null),
    '[]'::jsonb
  )                           as contents
from public.toc_rows tr
join public.toc_files tf          on tf.id = tr.toc_file_id
join public.clients cl            on cl.id = tf.client_id
left join public.tracks t         on t.id = tf.track_id
left join public.content_toc_links l on l.toc_row_id = tr.id
left join public.contents c       on c.id = l.content_id
left join public.clients ccl      on ccl.id = c.client_id
group by tr.id, tf.id, cl.name, t.name;

-- TOC files with row counts.
create view public.v_toc_files with (security_invoker = true) as
select
  tf.*,
  cl.name  as client_name,
  t.name   as track_name,
  (select count(*)::int from public.toc_rows r where r.toc_file_id = tf.id) as row_count
from public.toc_files tf
join public.clients cl    on cl.id = tf.client_id
left join public.tracks t on t.id = tf.track_id;

-- ---------------------------------------------------------------------------
-- Access: any signed-in team member can read and write everything.
-- ---------------------------------------------------------------------------
do $$
declare tbl text;
begin
  foreach tbl in array array['clients','tracks','toc_files','toc_rows',
                             'content_types','contents','content_toc_links']
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format(
      'create policy "team full access" on public.%I for all to authenticated using (true) with check (true)',
      tbl);
  end loop;
end $$;

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.v_contents, public.v_toc_rows, public.v_toc_files to authenticated;
