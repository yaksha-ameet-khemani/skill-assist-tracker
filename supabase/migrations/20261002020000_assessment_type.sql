-- Generic "Assessment" type for clients whose content is not split into
-- daily assignments / milestones / capstones (e.g. DXC).
insert into public.content_types (name, sort_order) values ('Assessment', 55)
on conflict (name) do nothing;
