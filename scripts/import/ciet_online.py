# CIET Anu sheet rows 12-23 of the online copy of Details_SkillAssist.xlsx (Google Sheets, 2026-10-05; not in the local file).
# As for rows 2-11: client CIET, CSM Anubha, type Assessment, track = Hybrid Assessment Name (column B, 2 questions each),
# Date = Created Date (column C, merged per block). Track names use one date style "Coding Assessment - DD Mon YYYY"
# (renamed 2026-10-05, see rename_dated_tracks.py) and store that date as tracks.extra.date for ordering. User-confirmed topics: new hand-written topics in "(Added manually) /
# CIET topics": 5 Data Structures & Algorithms, 6 SQL, 7 JavaScript. Java questions -> DSA (+ row 3 Collections Framework
# when they use collections); SQL -> SQL; JS -> JavaScript.
import json, sys
CLIENT, CSM, FN, SH = 'CIET', 'Anubha', '(Added manually)', 'CIET topics'
SRC = 'Details_SkillAssist.xlsx (online copy, Google Sheets)'
NEW_TOPICS = [(5, 'Data Structures & Algorithms'), (6, 'SQL'), (7, 'JavaScript')]
COLL, DSA, SQL, JS = 3, 5, 6, 7
ROWS = [  # (row, question, assessment, created date, topic rows)
    (12, 'Java - Student Number Search and Sort', 'Coding Assessment - 16 Sep 2026', '2026-09-15', [DSA, COLL]),
    (13, 'Java - Library Book Processing System', 'Coding Assessment - 16 Sep 2026', '2026-09-15', [DSA, COLL]),
    (14, 'Java - Count Even Nodes in a Linked List', 'Coding Assessment - 19 Sep 2026', '2026-09-15', [DSA]),
    (15, 'Java - Employee Salary BST Search', 'Coding Assessment - 19 Sep 2026', '2026-09-15', [DSA]),
    (16, 'Java - Emergency Task Scheduler Using Priority Queue', 'Coding Assessment - 23 Sep 2026', '2026-09-22', [DSA, COLL]),
    (17, 'Java - Frequent Characters Finder Using HashMap', 'Coding Assessment - 23 Sep 2026', '2026-09-22', [DSA, COLL]),
    (18, 'Java - Social Network Connection Search Using BFS', 'Coding Assessment - 26 Sep 2026', '2026-09-22', [DSA]),
    (19, 'Java - Activity Selection for Event Scheduling', 'Coding Assessment - 26 Sep 2026', '2026-09-22', [DSA]),
    (20, 'SQL - Employee Records Management', 'Coding Assessment - 30 Sep 2026', '2026-09-29', [SQL]),
    (21, 'SQL - Employee Salary Analysis', 'Coding Assessment - 30 Sep 2026', '2026-09-29', [SQL]),
    (22, 'SQL - Employee Department Salary Report Using Joins, Views and Functions', 'Coding Assessment - 03 Oct 2026', '2026-09-29', [SQL]),
    (23, 'JS - Student Grade Calculator', 'Coding Assessment - 03 Oct 2026', '2026-09-29', [JS]),
]
q = lambda o: '$j$' + json.dumps(o, ensure_ascii=False) + '$j$'
t = lambda s: 'null' if s is None else '$n$' + s + '$n$'
out = ['begin;', f"""insert into toc_rows(toc_file_id,row_number,day_label,topic,data)
select f.id,x.row_number,null,x.topic,x.data from toc_files f join clients c on c.id=f.client_id and c.name={t(CLIENT)},
 jsonb_to_recordset({q([dict(row_number=n, topic=tp, data={'Topic': tp}) for n, tp in NEW_TOPICS])}::jsonb) as x(row_number int, topic text, data jsonb)
where f.file_name={t(FN)} and f.sheet_name={t(SH)} on conflict (toc_file_id,row_number) do update set topic=excluded.topic, data=excluded.data;"""]
import datetime
for tr in dict.fromkeys(r[2] for r in ROWS):
    tdate = datetime.datetime.strptime(tr.split(' - ')[1], '%d %b %Y').date().isoformat()
    out.append(f"insert into tracks(client_id,name,csm,extra) select id,{t(tr)},{t(CSM)},{q({'date': tdate})}::jsonb from clients where name={t(CLIENT)} on conflict (client_id,name) do update set csm=excluded.csm, extra=tracks.extra || excluded.extra;")
for r, name, tr, date, hit in ROWS:
    ex = {'source': {'file': SRC, 'sheet': 'CIET Anu', 'row': r}}
    out.append(f"""with ctx as (select c.id cid, tr.id tid, f.id fid from clients c join tracks tr on tr.client_id=c.id and tr.name={t(tr)} join toc_files f on f.client_id=c.id and f.file_name={t(FN)} and f.sheet_name={t(SH)} where c.name={t(CLIENT)}),
ins as (insert into contents(client_id,track_id,content_type,sequence_label,name,delivery_date,extra)
 select cid,tid,'Assessment',null,{t(name)},'{date}',{q(ex)}::jsonb from ctx
 on conflict (client_id,track_id,content_type,sequence_label,name) do update set delivery_date=excluded.delivery_date, extra=excluded.extra returning id)
insert into content_toc_links(content_id,toc_row_id)
select ins.id,r.id from ins cross join ctx join toc_rows r on r.toc_file_id=ctx.fid and r.row_number = any(array{hit}::int[]) on conflict do nothing;""")
out.append('commit;')
print(len(ROWS), 'items', file=sys.stderr)
print('\n'.join(out))
