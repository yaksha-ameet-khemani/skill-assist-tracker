# Netcracker sheet of Details_SkillAssist.xlsx, rows 69-74 (user-confirmed 2026-10-04): "Netcracker Demo August" = demo
# for FSD -> track "Demo - FSD", CSM Priyanka, 03-08-2026 (merged), extra.demo = true. Type from column E ("Assessment" on
# the Milestone row -> Milestone Assessment 1, on the capstone row -> Capstone). Column B (Technology) -> Course column,
# column A -> extra.program. TOC typed in from the screenshot: one topic per comma item of "Topics Covered (TOC)", Module
# as group. Daily assignment -> all topics of its module; Milestone 1 -> modules 1-4; capstone -> module 19.
import openpyxl, json, re, warnings, sys
warnings.filterwarnings('ignore')
base = '/home/administrator/Downloads/IntelliJ Projects/Skill Assist Tracker/'
FILE, SHEET, CLIENT, CSM, TRACK, DATE = 'Details_SkillAssist.xlsx', 'Netcracker', 'Netcracker', 'Priyanka', 'Demo - FSD', '2026-08-03'
FN, SH = '(Added manually) Netcracker TOC screenshot', 'Demo - FSD'
TOC = [  # (technology, module, topics, hands-on / lab, learning outcome)
    ('SQL', '1. Database Fundamentals', 'DBMS vs RDBMS, Database Design, ER Model, Tables, Keys, Constraints, Relationships, Normalization',
     'Design a Student Database', 'Understand relational database concepts and database design principles'),
    ('SQL', '2. SQL Querying & Data Manipulation', 'SELECT, WHERE, ORDER BY, GROUP BY, HAVING, INSERT, UPDATE, DELETE, Aggregate Functions',
     'Employee Database CRUD Operations', 'Retrieve, filter, and manipulate data using SQL'),
    ('SQL', '3. Advanced SQL Programming', 'Joins, Subqueries, CTEs, Window Functions, Views, Stored Procedures, Functions, Triggers',
     'Sales Analytics & Reporting', 'Write advanced SQL queries and automate database operations'),
    ('SQL', '4. SQL Performance & Best Practices', 'Transactions, Indexing, Query Optimization, Execution Plans, Backup & Recovery, Security Basics',
     'Query Performance Tuning', 'Optimize SQL queries and understand database administration fundamentals'),
    ('Full Stack', '19. End-to-End Capstone Project', 'Application Design, Database Integration, REST API Integration, Frontend Integration, Authentication, Testing, Deployment',
     'Develop an Employee Management / E-Commerce Application', 'Build and deploy a complete full-stack application using SQL, Java, Microservices, and Angular')]
ws = openpyxl.load_workbook(base + FILE, data_only=True)[SHEET]
one = lambda v: re.sub(r'\s+', ' ', str(v)).strip()
assert one(ws['A68'].value) == 'Netcracker Demo August' and one(ws['G69'].value) == '03-08-2026'
program = one(ws['A68'].value)
toc, tech = [], None
for t_, mod, topics, lab, outcome in TOC:
    for tp in topics.split(', '):
        toc.append(dict(row_number=len(toc) + 2, day_label=None, topic=tp,
                        data={'Technology': t_, 'Module': mod, 'Topic': tp, 'Hands-on / Lab': lab, 'Learning Outcomes': outcome}))
items = []
for r in range(69, 75):
    tech = one(ws[f'B{r}'].value) if ws[f'B{r}'].value else tech
    mod, name = one(ws[f'C{r}'].value), one(ws[f'F{r}'].value)
    if mod.startswith('Milestone Assessment'):
        typ, seq, hit = 'Milestone Assessment', mod.split()[-1], [x['row_number'] for x in toc if x['data']['Technology'] == 'SQL']
    elif 'Capstone' in mod:
        typ, seq, hit = 'Capstone', None, [x['row_number'] for x in toc if x['data']['Module'] == mod]
    else:
        assert one(ws[f'E{r}'].value) == 'Daily Assignment'
        typ, seq, hit = 'Daily Assignment', None, [x['row_number'] for x in toc if x['data']['Module'] == mod]
    assert hit, r
    items.append(dict(row=r, type=typ, seq=seq, name=name, course=tech, hit=hit))
    print(r, typ, seq or '', name, '->', len(hit), 'topics', file=sys.stderr)

q = lambda o: '$j$' + json.dumps(o, ensure_ascii=False) + '$j$'
t = lambda s: 'null' if s is None else '$n$' + s + '$n$'
cols = [{'letter': 'A', 'header': 'Technology'}, {'letter': 'B', 'header': 'Module'}, {'letter': 'C', 'header': 'Topics Covered (TOC)'},
        {'letter': 'D', 'header': 'Hands-on / Lab'}, {'letter': 'E', 'header': 'Learning Outcomes'}]
note = ('Typed in from the screenshot shared on 2026-10-04; Topics Covered split into one topic per comma item. '
        'The screenshot shows modules 1-4 and 19 only (modules 5-18 not shared).')
out = ['begin;',
       f"insert into tracks(client_id,name,csm) select id,{t(TRACK)},{t(CSM)} from clients where name={t(CLIENT)} on conflict (client_id,name) do update set csm=excluded.csm;",
       f"""insert into toc_files(client_id,track_id,file_name,sheet_name,header_row,columns,topic_column,notes)
select c.id,(select id from tracks where client_id=c.id and name={t(TRACK)}),{t(FN)},{t(SH)},1,{q(cols)}::jsonb,'C',{t(note)}
from clients c where c.name={t(CLIENT)} on conflict (client_id,file_name,sheet_name) do update set notes=excluded.notes;""",
       f"""insert into toc_rows(toc_file_id,row_number,day_label,topic,data)
select f.id,x.row_number,x.day_label,x.topic,x.data from toc_files f join clients c on c.id=f.client_id and c.name={t(CLIENT)}, jsonb_to_recordset({q(toc)}::jsonb) as x(row_number int, day_label text, topic text, data jsonb)
where f.file_name={t(FN)} and f.sheet_name={t(SH)}
on conflict (toc_file_id,row_number) do update set topic=excluded.topic, data=excluded.data;"""]
for i in items:
    extra = q({'source': {'file': FILE, 'sheet': SHEET, 'row': i['row']}, 'course': i['course'], 'program': program, 'demo': True})
    out.append(f"""with ctx as (select c.id cid, tr.id tid, f.id fid from clients c join tracks tr on tr.client_id=c.id and tr.name={t(TRACK)} join toc_files f on f.client_id=c.id and f.file_name={t(FN)} and f.sheet_name={t(SH)} where c.name={t(CLIENT)}),
ins as (insert into contents(client_id,track_id,content_type,sequence_label,name,delivery_date,extra)
 select cid,tid,{t(i['type'])},{t(i['seq'])},{t(i['name'])},'{DATE}',{extra}::jsonb from ctx
 on conflict (client_id,track_id,content_type,sequence_label,name) do update set delivery_date=excluded.delivery_date, extra=excluded.extra returning id)
insert into content_toc_links(content_id,toc_row_id)
select ins.id,r.id from ins cross join ctx join toc_rows r on r.toc_file_id=ctx.fid and r.row_number = any(array{i['hit']}::int[]) on conflict do nothing;""")
out.append('commit;')
print('\n'.join(out))
