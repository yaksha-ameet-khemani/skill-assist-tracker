-- "Assignment": course-level assignments that are not day-wise (e.g. Myridius LP courses).
insert into public.content_types (name, sort_order) values ('Assignment', 52)
on conflict (name) do nothing;
