# Netcracker rows 93-104 of the online copy of Details_SkillAssist.xlsx (Google Sheets, 2026-10-05; not in the local file).
# User-confirmed: track "GoLang" (column B), CSM Aarti, not demo (column A "Technology skill map" kept as extra.group),
# one track for both dates (28-09-2026 rows 93-96, 01-10-2026 rows 97-104), all Daily Assignment, level -> Proficiency
# column, skill -> Course column, as for the other level blocks (netcracker_levels.py). No TOC: one hand-written topic per
# item in the "(Added manually) / Netcracker topics" sheet (row number = online sheet row, Module = GoLang).
import json, sys
CLIENT, CSM, TRACK, GROUP = 'Netcracker', 'Aarti', 'GoLang', 'Technology skill map'
FN, SH = '(Added manually)', 'Netcracker topics'
SRC = 'Details_SkillAssist.xlsx (online copy, Google Sheets)'
ROWS = [  # (row, level, name, date, topic)
    (93, 'L2', 'Go - Student Grade Calculator Using Functions', '2026-09-28', 'Functions'),
    (94, 'L3', 'Go - Employee Payroll System Using Interfaces', '2026-09-28', 'Interfaces'),
    (95, 'L4', 'Go - Concurrent Order Processing', '2026-09-28', 'Goroutines & channels (concurrency)'),
    (96, 'L5', 'Go - High-Performance Rate-Limited Key-Value HTTP Service', '2026-09-28', 'Rate-limited HTTP services'),
    (97, 'L2', 'Go - Bank Account Manager Using Structs, Composition, and Pointers', '2026-10-01', 'Structs, composition & pointers'),
    (98, 'L2', 'Go - Inventory Stock Manager Using Maps, Slices, and Errors', '2026-10-01', 'Maps, slices & errors'),
    (99, 'L3', 'Go - Generic Collection Utilities Using Go Generics', '2026-10-01', 'Generics'),
    (100, 'L3', 'Go - Task Manager REST API Using net/http and JSON', '2026-10-01', 'net/http & JSON (REST APIs)'),
    (101, 'L4', 'Go - Concurrent Log Aggregator Using the sync Package', '2026-10-01', 'sync package'),
    (102, 'L4', 'Go - Struct Validator Using Reflection and Struct Tags', '2026-10-01', 'Reflection & struct tags'),
    (103, 'L5', 'Go - Custom Go Linter Using go/ast Static Analysis', '2026-10-01', 'go/ast static analysis'),
    (104, 'L5', 'Go - Streaming Binary Protocol Decoder with Zero-Allocation Parsing', '2026-10-01', 'Zero-allocation binary parsing'),
]
q = lambda o: '$j$' + json.dumps(o, ensure_ascii=False) + '$j$'
t = lambda s: 'null' if s is None else '$n$' + s + '$n$'
toc = [dict(row_number=r, topic=tp, data={'Topic': tp, 'Module': TRACK, 'Proficiency': lv}) for r, lv, _, _, tp in ROWS]
out = ['begin;',
       f"insert into tracks(client_id,name,csm) select id,{t(TRACK)},{t(CSM)} from clients where name={t(CLIENT)} on conflict (client_id,name) do update set csm=excluded.csm;",
       f"""insert into toc_rows(toc_file_id,row_number,day_label,topic,data)
select f.id,x.row_number,null,x.topic,x.data from toc_files f join clients c on c.id=f.client_id and c.name={t(CLIENT)},
 jsonb_to_recordset({q(toc)}::jsonb) as x(row_number int, topic text, data jsonb)
where f.file_name={t(FN)} and f.sheet_name={t(SH)} on conflict (toc_file_id,row_number) do update set topic=excluded.topic, data=excluded.data;"""]
for r, lv, name, date, tp in ROWS:
    ex = {'source': {'file': SRC, 'sheet': 'Netcracker', 'row': r}, 'course': TRACK, 'proficiency': lv, 'group': GROUP}
    out.append(f"""with ctx as (select c.id cid, tr.id tid, f.id fid from clients c join tracks tr on tr.client_id=c.id and tr.name={t(TRACK)} join toc_files f on f.client_id=c.id and f.file_name={t(FN)} and f.sheet_name={t(SH)} where c.name={t(CLIENT)}),
ins as (insert into contents(client_id,track_id,content_type,sequence_label,name,delivery_date,extra)
 select cid,tid,'Daily Assignment',null,{t(name)},'{date}',{q(ex)}::jsonb from ctx
 on conflict (client_id,track_id,content_type,sequence_label,name) do update set delivery_date=excluded.delivery_date, extra=excluded.extra returning id)
insert into content_toc_links(content_id,toc_row_id)
select ins.id,r.id from ins cross join ctx join toc_rows r on r.toc_file_id=ctx.fid and r.row_number={r} on conflict do nothing;""")
out.append('commit;')
print(len(ROWS), 'items', file=sys.stderr)
print('\n'.join(out))
