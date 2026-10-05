-- Track order on the home page (2026-10-05): tracks are listed by date, not by name, so names that carry a date in
-- any format still appear in order. A track may store its own date in tracks.extra->>'date' (e.g. the assessment
-- date of "Coding Assessment - 02 Sep 2026"); otherwise the portal uses the track's earliest content date.
create or replace view public.v_contents with (security_invoker = true) as
select c.id,
    c.client_id,
    cl.name as client_name,
    c.track_id,
    t.name as track_name,
    c.content_type,
    ct.sort_order as type_order,
    c.sequence_label,
    c.name,
    c.delivery_date,
    c.notes,
    c.extra,
    c.created_at,
    count(tr.id)::integer as link_count,
    coalesce(jsonb_agg(jsonb_build_object('toc_row_id', tr.id, 'file_name', tf.file_name, 'sheet_name', tf.sheet_name,
        'row_number', tr.row_number, 'topic_column', tf.topic_column, 'day_label', tr.day_label, 'topic', tr.topic,
        'data', tr.data, 'columns', tf.columns) order by tf.file_name, tr.row_number) filter (where tr.id is not null),
        '[]'::jsonb) as topics,
    coalesce(string_agg((coalesce(tr.topic, ''::text) || ' '::text) || tr.data::text, ' | '::text), ''::text) as topics_text,
    t.csm,
    t.extra ->> 'date' as track_date
from contents c
    join clients cl on cl.id = c.client_id
    join content_types ct on ct.name = c.content_type
    left join tracks t on t.id = c.track_id
    left join content_toc_links l on l.content_id = c.id
    left join toc_rows tr on tr.id = l.toc_row_id
    left join toc_files tf on tf.id = tr.toc_file_id
group by c.id, cl.name, t.name, t.csm, t.extra, ct.sort_order;
