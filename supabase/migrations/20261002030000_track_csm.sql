-- CSM (client success manager) owning a track, e.g. Sony GET 2026 → Lishika, other Sony tracks → Priyanka.
alter table public.tracks add column csm text;

create or replace view public.v_contents with (security_invoker = true) as
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
        'data',       tr.data,
        'columns',    tf.columns
      ) order by tf.file_name, tr.row_number
    ) filter (where tr.id is not null),
    '[]'::jsonb
  )                           as topics,
  -- flat text of everything linked, used for keyword search
  coalesce(string_agg(coalesce(tr.topic, '') || ' ' || tr.data::text, ' | '), '') as topics_text,
  t.csm                       as csm
from public.contents c
join public.clients cl            on cl.id = c.client_id
join public.content_types ct      on ct.name = c.content_type
left join public.tracks t         on t.id = c.track_id
left join public.content_toc_links l on l.content_id = c.id
left join public.toc_rows tr      on tr.id = l.toc_row_id
left join public.toc_files tf     on tf.id = tr.toc_file_id
group by c.id, cl.name, t.name, t.csm, ct.sort_order;
