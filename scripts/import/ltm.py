# LTM sheet of Details_SkillAssist.xlsx, CSM Priyanka for everything (user, 2026-10-03).
# Block 1 (rows 1-10): Operating Systems – Linux, Windows & SAP. Days 1-6 daily assignments; the Day 7
#   mini project is the Milestone Assessment. Day/Module/Topics columns double as the TOC.
# Block 2 (rows 12-44, "Vidya Priyanka" = same Priyanka): 4 tracks, each 6 daily assignments numbered
#   Day 1-6 in row order + a "Week 1 Assessment" stored as Milestone Assessment and linked to all 6 topics.
# Block 3 (rows 54-59): 6 cloud incident questions re-created in the Cloud track, shared 09-09-2026, CSM Lishika,
#   stored as Milestone Assessment with blank day; one manual topic each (chosen by Claude, user-approved).
# Each track's first date applies to all its items. All TOC rows live in one toc_file (the LTM sheet).
import openpyxl, json, re, warnings, sys
warnings.filterwarnings('ignore')
base = '/home/administrator/Downloads/IntelliJ Projects/Skill Assist Tracker/'
FILE, SHEET, CLIENT, CSM = 'Details_SkillAssist.xlsx', 'LTM', 'LTM', 'Priyanka'
ws = openpyxl.load_workbook(base + FILE, data_only=True)[SHEET]
one = lambda v: None if v is None else re.sub(r'\s+', ' ', str(v)).strip()
iso = lambda d: '-'.join(reversed(d.split('-')))          # 25-06-2026 -> 2026-06-25
toc, items = [], []

# Block 1
OS = 'Operating Systems – Linux, Windows & SAP'
for r in range(3, 11):
    day, module, topic, name = (one(ws.cell(r, c).value) for c in range(1, 5))
    if not day or not topic: continue          # row 9 is only the "★ Milestone Assessment" heading
    toc.append(dict(row_number=r, day_label=day, topic=topic, data={'Day': day, 'Module': module, 'Topics': topic}))
    items.append(dict(row=r, track=OS, typ='Milestone Assessment' if day == '7' else 'Daily Assignment',
                      seq=day, name=name, date='2026-06-25', rows=[r]))

# Block 2
track = None
for r in range(14, 45):
    tr, week, topic, kind, name, date = (one(ws.cell(r, c).value) for c in range(1, 7))
    if not name: continue
    if tr: track, wk, tdate, day, trows = tr, week, iso(date), 0, []
    if kind == 'Assessment':
        items.append(dict(row=r, track=track, typ='Milestone Assessment', seq='1', name=name, date=tdate, rows=list(trows)))
        continue
    day += 1; trows.append(r)
    toc.append(dict(row_number=r, day_label=str(day), topic=topic, data={'Track': track, 'Week': wk, 'Day': str(day), 'Topic': topic}))
    items.append(dict(row=r, track=track, typ='Daily Assignment', seq=str(day), name=name, date=tdate, rows=[r]))

# Block 3
MANUAL = '(Added manually)', 'LTM Cloud topics'
cloud_topics = {54: 'IAM / Least Privilege (Azure)', 55: 'Cloud Cost Management', 56: 'Storage Access Security',
                57: 'Monitoring & Alerting', 58: 'Secrets Management', 59: 'AWS → Azure Service Mapping'}
mtoc = [dict(row_number=r, day_label=None, topic=tp, data={'Topic': tp}) for r, tp in cloud_topics.items()]
for r in cloud_topics:
    items.append(dict(row=r, track='Cloud', csm='Lishika', typ='Milestone Assessment', seq=None,
                      name=one(ws.cell(r, 1).value), date='2026-09-09', rows=[r], tf=MANUAL))

tracks = list(dict.fromkeys((i['track'], i.get('csm', CSM)) for i in items))
for i in items: print(f"{i['row']:>2} {i['track'][:16]:16} {i['typ'][:9]:9} {i['seq'] or '':>2} {i['date']} {i['name'][:60]:60} -> {i['rows']}", file=sys.stderr)
print(len(toc), 'TOC rows;', len(items), 'items', file=sys.stderr)

q = lambda o: '$j$' + json.dumps(o, ensure_ascii=False) + '$j$'
t = lambda s: 'null' if s is None else '$n$' + s + '$n$'
out = ['begin;', f"insert into clients(name) values ({t(CLIENT)}) on conflict do nothing;"]
for tr, csm in tracks:
    out.append(f"insert into tracks(client_id,name,csm) select id,{t(tr)},{t(csm)} from clients where name={t(CLIENT)} on conflict (client_id,name) do update set csm=excluded.csm;")
cols = [{'letter': 'A', 'header': 'Day'}, {'letter': 'B', 'header': 'Module'}, {'letter': 'C', 'header': 'Topics'}]
out.append(f"""insert into toc_files(client_id,track_id,file_name,sheet_name,header_row,columns,day_column,topic_column,notes)
select id,null,{t(FILE)},{t(SHEET)},2,{q(cols)}::jsonb,'A','C',{t('Rows 3-10: OS track (header row 2). Rows 14-43: Track/Week/Topic blocks (header row 13), day numbers assigned in row order.')} from clients where name={t(CLIENT)}
on conflict (client_id,file_name,sheet_name) do update set columns=excluded.columns, notes=excluded.notes;""")
out.append(f"""insert into toc_rows(toc_file_id,row_number,day_label,topic,data)
select f.id,x.row_number,x.day_label,x.topic,x.data from toc_files f join clients c on c.id=f.client_id and c.name={t(CLIENT)}, jsonb_to_recordset({q(toc)}::jsonb) as x(row_number int, day_label text, topic text, data jsonb)
where f.file_name={t(FILE)} and f.sheet_name={t(SHEET)}
on conflict (toc_file_id,row_number) do update set day_label=excluded.day_label, topic=excluded.topic, data=excluded.data;""")
out.append(f"""insert into toc_files(client_id,track_id,file_name,sheet_name,header_row,columns)
select id,null,{t(MANUAL[0])},{t(MANUAL[1])},1,{q([{'letter': 'A', 'header': 'Topic'}])}::jsonb from clients where name={t(CLIENT)}
on conflict (client_id,file_name,sheet_name) do nothing;""")
out.append(f"""insert into toc_rows(toc_file_id,row_number,day_label,topic,data)
select f.id,x.row_number,x.day_label,x.topic,x.data from toc_files f join clients c on c.id=f.client_id and c.name={t(CLIENT)}, jsonb_to_recordset({q(mtoc)}::jsonb) as x(row_number int, day_label text, topic text, data jsonb)
where f.file_name={t(MANUAL[0])} and f.sheet_name={t(MANUAL[1])}
on conflict (toc_file_id,row_number) do update set topic=excluded.topic, data=excluded.data;""")
for i in items:
    fn, sh = i.get('tf', (FILE, SHEET))
    extra = q({'source': {'file': FILE, 'sheet': SHEET, 'row': i['row']}})
    out.append(f"""with ctx as (select c.id cid, tr.id tid, f.id fid from clients c join tracks tr on tr.client_id=c.id and tr.name={t(i['track'])} join toc_files f on f.client_id=c.id and f.file_name={t(fn)} and f.sheet_name={t(sh)} where c.name={t(CLIENT)}),
ins as (insert into contents(client_id,track_id,content_type,sequence_label,name,delivery_date,extra)
 select cid,tid,'{i['typ']}',{t(i['seq'])},{t(i['name'])},'{i['date']}',{extra}::jsonb from ctx
 on conflict (client_id,track_id,content_type,sequence_label,name) do update set delivery_date=excluded.delivery_date, extra=excluded.extra returning id)
insert into content_toc_links(content_id,toc_row_id)
select ins.id,r.id from ins cross join ctx join toc_rows r on r.toc_file_id=ctx.fid and r.row_number = any(array{i['rows']}::int[]) on conflict do nothing;""")
out.append('commit;')
print('\n'.join(out))
