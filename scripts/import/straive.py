# Straive sheet of Details_SkillAssist.xlsx, rows 2-14 (user-confirmed 2026-10-04): CSM Priyanka, 23-01-2026 (merged).
# Track = column A (Snowflake Basic / Snowflake Intermediate). Assignment -> Daily Assignment, "Milestone 1" -> Milestone
# Assessment 1. Column B -> Course column. TOCs typed in from two screenshots: one topic per bullet, with Competency,
# Course and the milestone block it falls under. Daily assignment -> topic named in column B; Milestone 1 -> every topic of
# the Milestone 1 block. The Intermediate screenshot starts at the Milestone 2 block, so its Milestone 1 topic
# ("Advanced SQL & Query Optimization") is taken from the Details sheet.
# Rows 16-18: track "Pre-Assessment", CSM Ayman, type Pre-Assessment, 19-08-2026, linked to every topic of its skill area in
# Straive_MT_2026_PreAssessment_Topics.xlsx (file since removed from the folder; its rows stay in the DB, so the topics are
# kept in PRE_TOPICS_FILE below only if the file is present). Rows 21-48 ("Actual"): tracks "Common Track Day 1-16" and
# "Engineering Track Day 17-24", CSM Ayman. Day N -> Daily Assignment N, Milestone N -> Milestone Assessment N, Capstone N
# -> Capstone (Course column "Capstone N"); dates per merged block. TOC = Straive/Straive_MT_Program_2026_Rev8_TOC.xlsx (one
# topic per day = Session Title): a day links to its own TOC day; a milestone to every day since the previous milestone up
# to the milestone day; Common Capstones 1-2 (bridge lenses) to Days 15-16; Engineering Capstones 1-3 to Days 22-24.
import openpyxl, json, re, warnings, sys
warnings.filterwarnings('ignore')
base = '/home/administrator/Downloads/IntelliJ Projects/Skill Assist Tracker/'
FILE, SHEET, CLIENT, CSM, DATE = 'Details_SkillAssist.xlsx', 'Straive', 'Straive', 'Priyanka', '2026-01-23'
FN = '(Added manually) Straive TOC screenshot'
TECH, AI, DOM, SOFT = 'TECH (Core)', 'AI ENABLEMENT', 'DOMAIN', 'SOFT SKILLS'
TOCS = {  # track -> (sheet name, [(competency, topic, course, milestone block)])
    'Snowflake Basic': ('Snowflake Basic', [
        (TECH, 'Python for Data Engineering', 'Python Programming - Basics to the Advanced', 1),
        (TECH, 'PySpark Basics (DataFrames, Transformations)', 'Python Programming - Basics to the Advanced', 1),
        (TECH, 'Data Engineering Fundamentals', 'Apache Spark 3 for Data Engineering and Analytics with Python', 2),
        (TECH, 'SQL for Analytics (Hands-on)', 'Master SQL for Data Analysis', 2),
        (TECH, 'Snowflake Fundamentals: Architecture, Warehouses, Databases, Schemas', 'Snowflake - An Introduction Course', 3),
        (TECH, 'Data Loading (COPY, Stages)', 'Snowflake - An Introduction Course', 3),
        (TECH, 'Basic Performance Concepts', 'Snowflake - An Introduction Course', 3),
        (TECH, 'Cloud Fundamentals (AWS/Azure/GCP – Straive aligned)', 'Introduction to Cloud Computing [uploaded 2021]', 4),
        (TECH, 'Cloud Storage (S3/Blob/GCS)', 'AWS Certified Cloud Practitioner CLF-C02', 4),
        (TECH, 'IAM Basics', 'AWS Certified Cloud Practitioner CLF-C02', 4),
        (TECH, 'Snowflake on Cloud Overview', None, 4),
        (AI, 'Intro to AI/ML for Data Engineers', 'Machine Learning, Data Science and Generative AI with Python', 5),
        (AI, 'Data Preparation for ML', 'Machine Learning, Data Science and Generative AI with Python', 5),
        (AI, 'Intro to Snowflake Cortex / AI functions (awareness level)', None, 5),
        (DOM, 'Data Warehousing Concepts', 'Data Warehouse Concepts (DWH)', 6),
        (DOM, 'OLTP vs OLAP', 'Data Warehouse Concepts (DWH)', 6),
        (DOM, 'Dimensional Modeling (Star/Snowflake)', 'Data Warehouse Concepts (DWH)', 6),
        (DOM, 'Business Reporting & KPIs', 'Microsoft Power BI Skills', 6),
        (SOFT, 'Problem Solving Basics', 'Business Problem Identification for Certified Analyst Professional', 7),
        (SOFT, 'Analytical Thinking - Data Storytelling', 'Fundamentals of Analytical Skill; Data Storytelling - From Insight to Impact', 7),
        (SOFT, 'Stakeholder Communication (Data → Insight)', 'PMI-SP - Stakeholder Communications Management', 7),
        (SOFT, 'Agile & Scrum Awareness', 'The Complete Scrum Master Certification and Agile Scrum Course', 7)]),
    'Snowflake Intermediate': ('Snowflake Intermediate – Data Engineer', [
        (TECH, 'Advanced SQL & Query Optimization', None, 1),  # not in the screenshot; from the Details sheet
        (TECH, 'Snowflake Internals (Micro-Partitions, Caching)', 'Snowflake - Build and Architect Data Pipelines Using AWS', 2),
        (TECH, 'Advanced Data Loading & Unloading', 'Snowflake - Build and Architect Data Pipelines Using AWS', 2),
        (TECH, 'Streams & Tasks', 'Snowflake - Build and Architect Data Pipelines Using AWS', 2),
        (TECH, 'Semi-Structured Data (JSON, Parquet)', 'Snowflake - Build and Architect Data Pipelines Using AWS', 2),
        (TECH, 'Performance Tuning & Cost Optimization', 'Snowflake - Build and Architect Data Pipelines Using AWS', 2),
        (TECH, 'Cloud Cost Management', 'AWS Certified Solutions Architect Associate (SAA-C03)', 3),
        (TECH, 'Secure Networking (VPC, Private Endpoints)', 'AWS Certified Solutions Architect Associate (SAA-C03)', 3),
        (TECH, 'CI/CD for Data Pipelines', None, 3),
        (TECH, 'Orchestration (Airflow/dbt basics)', None, 3),
        (AI, 'Data Pipelines for ML', None, 4),
        (AI, 'Snowflake + ML Tools Integration', None, 4),
        (AI, 'AI-assisted Querying & Automation', 'Mastering AI Agents for Databases', 4),
        (DOM, 'Data Modeling for Analytics at Scale', None, 5),
        (DOM, 'Data Quality & Data Governance', None, 5),
        (DOM, 'Business Use-Case Mapping (Finance, Publishing, EdTech relevance)', 'Power BI Masterclass 8 - Python, Finance, and Advanced DAX', 5),
        (SOFT, 'Design Thinking for Data Solutions', 'Building High Performance Teams', None),
        (SOFT, 'Technical Storytelling', 'Microsoft Power BI - The Complete Masterclass [2023 EDITION]', None),
        (SOFT, 'Collaboration with BI, DS & Product Teams', 'Microsoft Power BI - The Complete Masterclass [2023 EDITION]', None)])}
NOTES = {'Snowflake Basic': 'Typed in from the screenshot shared on 2026-10-04; one topic per bullet. Milestone Assessment rows are markers, '
                            'not topics; each topic keeps the milestone block it falls under. "Intro to Snowflake Cortex" is red in the screenshot.',
         'Snowflake Intermediate': 'Typed in from the "Snowflake Intermediate – Data Engineer (2 Years Exp → Perform like 4–5 Years)" screenshot '
                                   'shared on 2026-10-04 (Learning Journey – Intermediate). The screenshot starts at the Milestone 2 block, so '
                                   '"Advanced SQL & Query Optimization" (Milestone 1) is added from the Details sheet; it is cut off after the '
                                   'Soft Skills rows (no milestone shown for them).'}
ws = openpyxl.load_workbook(base + FILE, data_only=True)[SHEET]
one = lambda v: re.sub(r'\s+', ' ', str(v)).strip()
assert one(ws['E2'].value) == '23-01-2026'
toc = {tr: [dict(row_number=n, day_label=None, topic=tp, data={k: v for k, v in {'Competency': comp, 'Topic': tp, 'Course': co,
            'Milestone block': f'Milestone Assessment {m}' if m else None}.items() if v})
            for n, (comp, tp, co, m) in enumerate(rows, 2)] for tr, (_, rows) in TOCS.items()}
items, mod, col_b = [], None, None
for r in list(range(2, 8)) + list(range(9, 15)):
    mod = one(ws[f'A{r}'].value) if ws[f'A{r}'].value else mod
    col_b = one(ws[f'B{r}'].value) if ws[f'B{r}'].value else col_b
    rs = toc[mod]
    if col_b == 'Milestone 1': typ, seq, hit = 'Milestone Assessment', '1', [x['row_number'] for x in rs if x['data'].get('Milestone block') == 'Milestone Assessment 1']
    else: typ, seq, hit = 'Daily Assignment', None, [x['row_number'] for x in rs if x['topic'].lower() == col_b.lower()]
    assert hit, r
    items.append(dict(row=r, track=mod, type=typ, seq=seq, name=one(ws[f'D{r}'].value), course=col_b, hit=hit))
    print(r, mod, typ, seq or '', one(ws[f'D{r}'].value), '->', [x['topic'] for x in rs if x['row_number'] in hit], file=sys.stderr)

q = lambda o: '$j$' + json.dumps(o, ensure_ascii=False) + '$j$'
t = lambda s: 'null' if s is None else '$n$' + s + '$n$'
cols = [{'letter': 'A', 'header': 'Competency'}, {'letter': 'B', 'header': 'What to Cover (Specific & Focused)'}, {'letter': 'C', 'header': 'Course'}, {'letter': 'D', 'header': 'Milestone block'}]
out = ['begin;', f"insert into clients(name) values ({t(CLIENT)}) on conflict do nothing;"]
for tr, (sh, _) in TOCS.items():
    out.append(f"insert into tracks(client_id,name,csm) select id,{t(tr)},{t(CSM)} from clients where name={t(CLIENT)} on conflict (client_id,name) do update set csm=excluded.csm;")
    out.append(f"""insert into toc_files(client_id,track_id,file_name,sheet_name,header_row,columns,topic_column,notes)
select c.id,(select id from tracks where client_id=c.id and name={t(tr)}),{t(FN)},{t(sh)},1,{q(cols)}::jsonb,'B',{t(NOTES[tr])}
from clients c where c.name={t(CLIENT)} on conflict (client_id,file_name,sheet_name) do update set notes=excluded.notes;""")
    out.append(f"""insert into toc_rows(toc_file_id,row_number,day_label,topic,data)
select f.id,x.row_number,x.day_label,x.topic,x.data from toc_files f join clients c on c.id=f.client_id and c.name={t(CLIENT)}, jsonb_to_recordset({q(toc[tr])}::jsonb) as x(row_number int, day_label text, topic text, data jsonb)
where f.file_name={t(FN)} and f.sheet_name={t(sh)}
on conflict (toc_file_id,row_number) do update set topic=excluded.topic, data=excluded.data;""")
for i in items:
    extra = q({'source': {'file': FILE, 'sheet': SHEET, 'row': i['row']}, 'course': i['course']})
    out.append(f"""with ctx as (select c.id cid, tr.id tid, f.id fid from clients c join tracks tr on tr.client_id=c.id and tr.name={t(i['track'])} join toc_files f on f.client_id=c.id and f.file_name={t(FN)} and f.sheet_name={t(TOCS[i['track']][0])} where c.name={t(CLIENT)}),
ins as (insert into contents(client_id,track_id,content_type,sequence_label,name,delivery_date,extra)
 select cid,tid,{t(i['type'])},{t(i['seq'])},{t(i['name'])},'{DATE}',{extra}::jsonb from ctx
 on conflict (client_id,track_id,content_type,sequence_label,name) do update set delivery_date=excluded.delivery_date, extra=excluded.extra returning id)
insert into content_toc_links(content_id,toc_row_id)
select ins.id,r.id from ins cross join ctx join toc_rows r on r.toc_file_id=ctx.fid and r.row_number = any(array{i['hit']}::int[]) on conflict do nothing;""")

# ---- Pre-Assessment (rows 16-18): topics file stays in the DB even though it was removed from the folder
import os
TFILE, TSHEET = 'Straive_MT_2026_PreAssessment_Topics.xlsx', 'Pre-Assessment Topics'
PRE, CT, ET, CSM2 = 'Pre-Assessment', 'Common Track Day 1-16', 'Engineering Track Day 17-24', 'Ayman'
PRE_AREA = {'Git': 'Version Control (Git)', 'Python': 'Python', 'SQL': 'SQL'}
for tr in (PRE, CT, ET):
    out.append(f"insert into tracks(client_id,name,csm) select id,{t(tr)},{t(CSM2)} from clients where name={t(CLIENT)} on conflict (client_id,name) do update set csm=excluded.csm;")
out.append(f"delete from toc_files where client_id=(select id from clients where name={t(CLIENT)}) and file_name='(Added manually)' and sheet_name='Straive topics';")
if os.path.exists(base + 'Straive/' + TFILE):
    tw = openpyxl.load_workbook(base + 'Straive/' + TFILE)[TSHEET]
    area, ptoc, coding = None, [], {}
    for r in range(4, 49):
        if tw[f'B{r}'].value: area = one(tw[f'B{r}'].value); atype = one(tw[f'E{r}'].value); coding[area] = tw[f'H{r}'].value
        ptoc.append(dict(row_number=r, day_label=None, topic=one(tw[f'C{r}'].value), data={k: v for k, v in {
            'S.No': one(tw[f'A{r}'].value), 'Technology / Skill Area': area, 'Topic': one(tw[f'C{r}'].value), 'Proficiency Level': one(tw[f'D{r}'].value),
            'Assessment Type': atype, 'No. of MCQs': one(tw[f'F{r}'].value), 'Coding Questions': str(coding[area]) if coding[area] else None}.items() if v}))
    tcols = [{'letter': 'A', 'header': 'S.No'}, {'letter': 'B', 'header': 'Technology / Skill Area'}, {'letter': 'C', 'header': 'Topic'}, {'letter': 'D', 'header': 'Proficiency Level'},
             {'letter': 'E', 'header': 'Assessment Type'}, {'letter': 'F', 'header': 'No. of MCQs'}, {'letter': 'H', 'header': 'Coding Questions'}]
    out.append(f"""insert into toc_files(client_id,track_id,file_name,sheet_name,header_row,columns,topic_column)
select c.id,null,{t(TFILE)},{t(TSHEET)},3,{q(tcols)}::jsonb,'C' from clients c where c.name={t(CLIENT)} on conflict (client_id,file_name,sheet_name) do nothing;""")
    out.append(f"""insert into toc_rows(toc_file_id,row_number,day_label,topic,data)
select f.id,x.row_number,x.day_label,x.topic,x.data from toc_files f join clients c on c.id=f.client_id and c.name={t(CLIENT)}, jsonb_to_recordset({q(ptoc)}::jsonb) as x(row_number int, day_label text, topic text, data jsonb)
where f.file_name={t(TFILE)} and f.sheet_name={t(TSHEET)} on conflict (toc_file_id,row_number) do update set topic=excluded.topic, data=excluded.data;""")
out.append(f"""update toc_files set track_id=(select id from tracks where client_id=toc_files.client_id and name={t(PRE)}),
 notes='Pre-assessment topic coverage for the Straive Management Trainee Program 2026 (Common Track). Used for the Pre-Assessment items, linked by skill area.'
where client_id=(select id from clients where name={t(CLIENT)}) and file_name={t(TFILE)};""")

# ---- Rev 8 programme TOC: one topic per day
RFILE = 'Straive_MT_Program_2026_Rev8_TOC.xlsx'
RSHEETS = {CT: 'Common Track — Days 1-16', ET: 'Engineering Track — Days 17-24'}
rw = openpyxl.load_workbook(base + 'Straive/' + RFILE)
rtoc, rcols = {}, {}
clean = lambda title: re.split(r'\s{2,}|\n|[\U0001F300-\U0001FAFF\u2600-\u27BF]', title.strip())[0].strip()
for tr, sh in RSHEETS.items():
    w = rw[sh]; hdr = {c.column_letter: one(c.value) for c in w[3] if c.value}
    rcols[tr] = [{'letter': k, 'header': v} for k, v in hdr.items()]
    rtoc[tr] = []
    for r in range(4, w.max_row + 1):
        day = one(w[f'A{r}'].value)
        data = {h: (str(w[f'{k}{r}'].value).strip() if not isinstance(w[f'{k}{r}'].value, str) else w[f'{k}{r}'].value.strip())
                for k, h in hdr.items() if w[f'{k}{r}'].value is not None}
        rtoc[tr].append(dict(row_number=r, day_label=day.split()[-1], topic=clean(w[f'B{r}'].value), data=data))
day_rows = lambda tr, lo, hi: [x['row_number'] for x in rtoc[tr] if lo <= int(x['day_label']) <= hi]

def date_of(r):  # merged date cells: the value sits on the first row of each block
    for rr in range(r, 15, -1):
        if ws[f'E{rr}'].value: d, m, y = one(ws[f'E{rr}'].value).split('-'); return f'{y}-{m}-{d}'

items2 = []
assert one(ws['A16'].value) == PRE and one(ws['A20'].value) == 'Actual' and one(ws['A21'].value) == CT and one(ws['A41'].value) == ET
for r in (16, 17, 18):
    sk = one(ws[f'B{r}'].value)
    items2.append(dict(row=r, track=PRE, type='Pre-Assessment', seq=None, name=one(ws[f'D{r}'].value), course=sk, file=TFILE, sheet=TSHEET,
                       hit=('area', PRE_AREA[sk]), date=date_of(r)))
last_ms = {CT: 0, ET: 16}
CAP_DAYS = {CT: {'Capstone 1': (15, 16), 'Capstone 2': (15, 16)}, ET: {'Capstone 1': (22, 22), 'Capstone 2': (23, 23), 'Capstone 3': (24, 24)}}
for r in range(21, 49):
    if not ws[f'D{r}'].value: continue
    tr = CT if r <= 40 else ET
    b = one(ws[f'B{r}'].value)
    m = re.fullmatch(r'(?:Day (\d+))?\s*(Milestone|Capstone)?\s*(\d+)?', b)
    day, kind, n = m[1], m[2], m[3]
    if kind == 'Milestone':
        upto = int(day) if day else {CT: {'1': 8, '2': 12}}[tr][n]  # Common Track milestones sit after Day 8 / Day 12
        typ, seq, course, hit = 'Milestone Assessment', n, None, day_rows(tr, last_ms[tr] + 1, upto); last_ms[tr] = upto
    elif kind == 'Capstone':
        typ, seq, course, hit = 'Capstone', None, f'Capstone {n}', day_rows(tr, *CAP_DAYS[tr][f'Capstone {n}'])
    else:
        typ, seq, course, hit = 'Daily Assignment', day, None, day_rows(tr, int(day), int(day))
    items2.append(dict(row=r, track=tr, type=typ, seq=seq, name=one(ws[f'D{r}'].value), course=course, file=RFILE, sheet=RSHEETS[tr], hit=('rows', hit), date=date_of(r)))
for i in items2:
    print(i['row'], i['track'][:16], i['type'], i['seq'] or '', i['course'] or '', i['date'], i['name'][:40], '->', i['hit'][1] if i['hit'][0] == 'area' else
          [x['day_label'] for x in rtoc[i['track']] if x['row_number'] in i['hit'][1]], file=sys.stderr)

rnote = ('Straive × Techademy Management Trainee Program 2026, REV 8 (August 2026). One topic per day = Session Title (tags such as '
         '"🔴 MILESTONE 1" / "🆕 NEW" dropped from the topic but kept in the full row data).')
for tr, sh in RSHEETS.items():
    out.append(f"""insert into toc_files(client_id,track_id,file_name,sheet_name,header_row,columns,day_column,topic_column,notes)
select c.id,(select id from tracks where client_id=c.id and name={t(tr)}),{t(RFILE)},{t(sh)},3,{q(rcols[tr])}::jsonb,'A','B',{t(rnote)} from clients c where c.name={t(CLIENT)}
on conflict (client_id,file_name,sheet_name) do update set notes=excluded.notes, track_id=excluded.track_id, columns=excluded.columns;""")
    out.append(f"""insert into toc_rows(toc_file_id,row_number,day_label,topic,data)
select f.id,x.row_number,x.day_label,x.topic,x.data from toc_files f join clients c on c.id=f.client_id and c.name={t(CLIENT)}, jsonb_to_recordset({q(rtoc[tr])}::jsonb) as x(row_number int, day_label text, topic text, data jsonb)
where f.file_name={t(RFILE)} and f.sheet_name={t(sh)} on conflict (toc_file_id,row_number) do update set day_label=excluded.day_label, topic=excluded.topic, data=excluded.data;""")
# links of these tracks are rebuilt, so a changed TOC replaces the old ones (Common Track was first linked to the pre-assessment file)
out.append(f"""delete from content_toc_links where content_id in (select c.id from contents c join tracks tr on tr.id=c.track_id
 where tr.client_id=(select id from clients where name={t(CLIENT)}) and tr.name in ({t(PRE)},{t(CT)},{t(ET)}));""")
for i in items2:
    ex = {'source': {'file': FILE, 'sheet': SHEET, 'row': i['row']}}
    if i['course']: ex['course'] = i['course']
    cond = (f"r.data->>'Technology / Skill Area'={t(i['hit'][1])}" if i['hit'][0] == 'area' else f"r.row_number = any(array{i['hit'][1]}::int[])")
    out.append(f"""with ctx as (select c.id cid, tr.id tid, f.id fid from clients c join tracks tr on tr.client_id=c.id and tr.name={t(i['track'])} join toc_files f on f.client_id=c.id and f.file_name={t(i['file'])} and f.sheet_name={t(i['sheet'])} where c.name={t(CLIENT)}),
ins as (insert into contents(client_id,track_id,content_type,sequence_label,name,delivery_date,extra)
 select cid,tid,{t(i['type'])},{t(i['seq'])},{t(i['name'])},'{i['date']}',{q(ex)}::jsonb from ctx
 on conflict (client_id,track_id,content_type,sequence_label,name) do update set delivery_date=excluded.delivery_date, extra=excluded.extra returning id)
insert into content_toc_links(content_id,toc_row_id)
select ins.id,r.id from ins cross join ctx join toc_rows r on r.toc_file_id=ctx.fid and {cond} on conflict do nothing;""")
out.append('commit;')
print('\n'.join(out))
