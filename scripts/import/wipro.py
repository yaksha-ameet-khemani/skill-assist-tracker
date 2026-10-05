# WIPRO sheet of Details_SkillAssist.xlsx, all rows 2-234 (user, 2026-10-05): client Wipro, CSM Soma for every track.
# Track = column A as written (11 tracks). "Day wise assignments" -> Daily Assignment (Day column = the sheet's day range);
# Milestone N -> Milestone Assessment N; Final / Final Milestone / Final Assessment -> Capstone. Actual and Re-attempt
# versions are separate items; extra.assessment = "Actual" / "Re-attempt" / "Final – Actual" / "Final – Re-attempt"
# (home-page Assessment column), so finals stay visible as Final although stored as Capstone. Rows whose name is "NA"
# (SDET rows 62-67) are skipped.
# TOCs from ../../../../Wipro/ (the user's folder next to the tracker): Selenium with Python, Java Selenium SDET,
# NGA JFS Angular, SQL PL/SQL and Java J2EE day-wise planners. One TOC row per topic, its sub-topics kept in data.
# Daily item -> TOC topic(s) of its day(s); milestone -> topics since the previous milestone; a final -> topics since the
# last milestone, or the whole TOC when the track has nothing else. The April re-runs without days (NGA Java Angular,
# NGA JFS Angular) link by content: M1 -> Java/Spring days 1-16, M2 -> HTML..Angular days 25-31, Final -> microservices
# days 18-23. Java J2EE rows give topic names instead of days (they match the TOC topics); the Day column shows that name as
# written in the sheet (user, 2026-10-05), not a day number.
import openpyxl, json, re, warnings, sys
warnings.filterwarnings('ignore')
base = '/home/administrator/Downloads/IntelliJ Projects/'
FILE, SHEET, CLIENT, CSM = 'Details_SkillAssist.xlsx', 'WIPRO', 'Wipro', 'Soma'
one = lambda v: re.sub(r'\s+', ' ', str(v).replace('\xa0', ' ')).strip() if v is not None else None
bullet = lambda v: re.sub(r'^[·•◦\-\s]+', '', one(v)) if v is not None else None

def lines(ws, col, r1, r2):
    out = []
    for r in range(r1, r2 + 1):
        v = ws[f'{col}{r}'].value
        if v is None: continue
        out += [bullet(x) for x in str(v).split('\n') if bullet(x)]
    return out

def rng(label):  # "Day 1 to 3" / "2 and 3" / "Day 33 &35" / "Day 21- Day 25" -> (1, 3)
    n = [int(x) for x in re.findall(r'\d+', label)]
    return (n[0], n[-1])

TOC = {}  # key -> dict(file, sheet, header_row, cols, rows=[dict(row_number, day_label, topic, data, days=(a, b))])
# ---- Selenium with Python
f = 'Wipro - Selenuim with Python - Q4 - Day Wise Plan - New.xlsx'; w = openpyxl.load_workbook(base + 'Wipro/' + f, data_only=True)['Day Wise Planner']
SP = [(2, 2, 13), (15, 15, 23), (24, 24, 29), (31, 31, 36), (38, 39, 43), (45, 45, 48), (50, 50, 63), (64, 64, 70), (72, 72, 79), (80, 80, 87), (88, 88, 91), (93, 93, 94), (95, 95, 96)]
rows = []
for r, s1, s2 in SP:
    day = one(w[f'A{r}'].value) or one(w['A31'].value)  # row 38 sits inside the Day 7 and 8 block
    date = w[f'B{r}'].value or w['B31'].value
    topic = one(w[f'C{r}'].value) or one(w[f'D{r}'].value)  # "Working with Web & APIs" is written in the Sub-Topic column
    data = {'Day': day, 'Date': date.strftime('%d-%m-%Y') if hasattr(date, 'strftime') else one(date), 'Topic': topic,
            'Sub-Topic': '\n'.join(lines(w, 'D', s1, s2)), 'Duration(Hrs.)': one(w[f'E{r}'].value) or one(w['E31'].value)}
    if r == 72: data['Notes'] = str(w['F72'].value).strip()
    rows.append(dict(row_number=r, day_label=day, topic=topic, data={k: v for k, v in data.items() if v}, days=rng(day)))
TOC['SP'] = dict(file=f, sheet='Day Wise Planner', header_row=1, topic_col='C', rows=rows,
                 cols=[{'letter': x, 'header': h} for x, h in zip('ABCDE', ['Day', 'Date', 'Topic', 'Sub-Topic', 'Duration(Hrs.)'])],
                 note='Selenium with Python – Q4 day-wise plan. One topic per day block (Topic column), sub-topics kept in data. The Day 7 and 8 '
                      'block holds two topics (REST APIs, Working with Web & APIs). Milestone, holiday and capstone rows are not topics.')
# ---- Java Selenium SDET
f = 'Wipro Java Selenium_SDETupdated - Q4 - Day Wise Plan - New.xlsx'; w = openpyxl.load_workbook(base + 'Wipro/' + f, data_only=True)['Java Selenium']
SD = {2: 'Day 1-2', 4: 'Day 3-4', 7: 'Day 5-6', 9: 'Day 7', 13: 'Day 8 & 9', 16: 'Day 8 & 9', 18: 'Day 10-11', 24: 'Day 12', 25: 'Day 13 - 16',
      27: 'Day 17', 28: 'Day 18-19', 33: 'Day 20', 36: 'Day 21- Day 25', 39: 'Day 26 - 28', 40: 'Day 29', 43: 'Day 30', 45: 'Day 31', 46: 'Day 32', 48: 'Day 33 &35'}
rows = []
for r, day in SD.items():
    topic = one(w[f'D{r}'].value).rstrip(':')
    data = {'Day #': day, 'Modules': topic, 'Day Wise Learning Plan': '\n'.join(lines(w, 'E', r, r)), 'Duration(hrs)': one(w[f'C{r}'].value)}
    if r == 25: data['Notes'] = one(w['D26'].value)
    rows.append(dict(row_number=r, day_label=day, topic=topic, data={k: v for k, v in data.items() if v}, days=rng(day)))
TOC['SDET'] = dict(file=f, sheet='Java Selenium', header_row=1, topic_col='D', rows=rows,
                   cols=[{'letter': x, 'header': h} for x, h in zip('ACDE', ['Day #', 'Duration(hrs)', 'Modules', 'Day Wise Learning Plan '])],
                   note='Java Selenium SDET – Q4 day-wise plan. One topic per module (Modules column); the Day column is written as in the sheet '
                        '(days 1-2, 3-4 and 5-6 are merged in the sheet). Milestone, final and capstone rows are not topics.')
# ---- NGA JFS Angular
f = 'WIpro NGA - JFS_Angular - Daywise Planner.xlsx'; w = openpyxl.load_workbook(base + 'Wipro/' + f, data_only=True)['Full Stack Java Enterprise Ang']
rows, day, date = [], None, None
for r in range(2, 37):
    if w[f'A{r}'].value is not None: day, date = one(w[f'A{r}'].value), w[f'B{r}'].value
    if not w[f'C{r}'].value: continue  # Milestone 1 / SME review rows
    data = {'Day': day, 'Date': date.strftime('%d-%m-%Y') if hasattr(date, 'strftime') else one(date), 'Topics': one(w[f'C{r}'].value),
            'Table of Content': one(w[f'D{r}'].value), 'Duration in Days': one(w[f'E{r}'].value)}
    rows.append(dict(row_number=r, day_label=f'Day {day}', topic=one(w[f'C{r}'].value), data={k: v for k, v in data.items() if v}, days=rng(day)))
TOC['JFS'] = dict(file=f, sheet='Full Stack Java Enterprise Ang', header_row=1, topic_col='C', rows=rows,
                  cols=[{'letter': x, 'header': h} for x, h in zip('ABCDE', ['Day', 'Date', 'Topics', 'Table of Content', 'Duration in Days'])],
                  note='NGA Full Stack Java Enterprise with Angular day-wise planner. One topic per Topics row (Angular days 28-30 hold several). '
                       'Milestone, SME review and capstone rows and the Outcomes list are not topics.')
# ---- SQL PL/SQL Phase 1
f = 'Wipro - SQL - Q1 - Day wise Planner.xlsx'; w = openpyxl.load_workbook(base + 'Wipro/' + f, data_only=True)['SQL PLSQL Phase1']
starts = [r for r in range(3, 94) if w[f'C{r}'].value]
rows, day, date = [], None, None
for i, r in enumerate(starts):
    if w[f'A{r}'].value is not None: day, date = one(w[f'A{r}'].value), w[f'B{r}'].value
    end = (starts[i + 1] - 1) if i + 1 < len(starts) else 93
    data = {'Day': day, 'Date': date.strftime('%d-%m-%Y') if hasattr(date, 'strftime') else one(date), 'Topics': one(w[f'C{r}'].value),
            'Table of Content': '\n'.join(lines(w, 'D', r, end)), 'Duration in Hrs': one(w[f'E{r}'].value)}
    rows.append(dict(row_number=r, day_label=f'Day {day}', topic=one(w[f'C{r}'].value), data={k: v for k, v in data.items() if v}, days=rng(day)))
TOC['SQL'] = dict(file=f, sheet='SQL PLSQL Phase1', header_row=2, topic_col='C', rows=rows,
                  cols=[{'letter': x, 'header': h} for x, h in zip('ABCDE', ['Day', 'Date', 'Topics', 'Table of Content', 'Duration in Hrs'])],
                  note='SQL PL/SQL Fundamental Primer Pre-skilling Program (Phase 1). One topic per Topics block, its Table of Content rows kept in data.')
# ---- Java J2EE
f = 'Wipro NGA - JAVAJ2EE - 4 May - Day wise planner.xlsx'; wb = openpyxl.load_workbook(base + 'Wipro/' + f, data_only=True); w = wb['Java-J2EE']
plan = [{x: wb['Day Wise Planner'][f'{x}{r}'] for x in 'AC'} for r in range(2, 46)]
plan = [p for p in plan if p['A'].value] + [{'A': wb['Day Wise Planner']['A14'], 'C': wb['Day Wise Planner']['C15']}]  # day 13 is half SQL, half HTML/CSS
starts = [r for r in range(2, 127) if w[f'C{r}'].value and not re.match(r'Milestone', one(w[f'C{r}'].value))]
rows, day = [], None
for i, r in enumerate(starts):
    if w[f'A{r}'].value is not None: day = one(w[f'A{r}'].value)
    end = min([x for x in starts[i + 1:]] + [127]) - 1
    end = min([end] + [x - 1 for x in range(r + 1, end + 1) if w[f'C{x}'].value])  # stop before a Milestone row
    topic = one(w[f'C{r}'].value)
    pdays = sorted(int(p['A'].value) for p in plan if p['C'].value and topic.lower() in [x.strip().lower() for x in one(p['C'].value).split(',')])
    assert pdays, topic
    pl = f'Day {pdays[0]}' if len(pdays) == 1 else f'Day {pdays[0]}-{pdays[-1]}'
    data = {'Day': pl, 'Topic number': day, 'Topic': topic, 'Sub Topics': '\n'.join(lines(w, 'D', r, end)), 'Duration in Hrs.': one(w[f'E{r}'].value)}
    rows.append(dict(row_number=r, day_label=pl, topic=topic, data={k: v for k, v in data.items() if v}, days=(pdays[0], pdays[-1])))
TOC['J2EE'] = dict(file=f, sheet='Java-J2EE', header_row=1, topic_col='C', rows=rows,
                   cols=[{'letter': x, 'header': h} for x, h in zip('ACDE', ['Day', 'Topic', 'Sub Topics', 'Duration in Hrs.'])],
                   note='NGA Java J2EE (4 May) planner, sheet Java-J2EE: one topic per Topic block, sub-topics kept in data. Day = the topic\'s days in '
                        'the "Day Wise Planner" sheet (43 days); the Java-J2EE sheet\'s own 1-25 numbering is kept as "Topic number".')

def by_days(key, a, b):
    return [x['row_number'] for x in TOC[key]['rows'] if x['days'][0] <= b and x['days'][1] >= a]
def by_topic(key, *names):
    hit = [x['row_number'] for x in TOC[key]['rows'] if x['topic'].lower().rstrip() in [n.lower() for n in names]]
    assert len(hit) == len(names), (key, names, hit)
    return hit
ALL = lambda key: [x['row_number'] for x in TOC[key]['rows']]

# ---- Details sheet
TRACKS = [(2, 28, 'SP'), (30, 67, 'SDET'), (69, 97, 'SP'), (99, 139, 'JFS'), (141, 142, 'SDET'), (145, 150, 'JFS'),
          (153, 158, 'SDET'), (161, 166, 'SP'), (168, 173, 'JFS'), (176, 179, 'SQL'), (181, 234, 'J2EE')]
# milestone -> TOC days (since the previous milestone); 'F' = final
MS = {'SP': {'1': (1, 6), '2': (7, 14), 'F': (15, 23)}, 'SDET': {'1': (1, 19), '2': (20, 25), '3': (26, 29), 'F': None},
      'JFS': {'1': (1, 16), '2': (18, 31)}, 'SQL': {'F': None}}
APRIL_JFS = {'1': (1, 16), '2': (25, 31), 'F': (18, 23)}  # NGA Java Angular / NGA JFS Angular: milestones by content
J2EE_DAILY = {  # Details topic label -> (planner day, TOC topics)
    'Java Fundamentals': ('1', ['Java Fundamentals']), 'Java Fundamentals, GIT': ('2', ['Java Fundamentals', 'GIT']),
    'OOPS / Inheritance': ('3', ['OOPS / Inheritance']), 'Abstraction /Packages / Exception Handling': ('4', ['Abstraction /Packages / Exception Handling']),
    'Wrapper Classes, Collection/ Stream API': ('5', ['Wrapper Classes', 'Collection/ Stream API']), 'Concurrency in Java': ('6', ['Concurrency in Java']),
    'Junit/Code Coverage': ('7', ['Junit/Code Coverage']), 'Design Patterns': ('8', ['Design Patterns']),
    'RDBMS/SQL/JDBC (On 18th May)': ('13', ['RDBMS/SQL/JDBC']), 'HTML/CSS (On 19th May)': ('14', ['HTML/CSS']), 'JavaScript (On 21st May)': ('16', ['JavaScript']),
    'Servlet/JSP': ('19', ['Servlet/JSP']), 'Spring Core': ('20', ['Spring Core']), 'Spring MVC': ('21', ['Spring MVC']),
    'Object Relational Mapping & Hibernate Architecture': ('22', ['Object Relational Mapping', 'Hibernate Architecture']),
    'Querying in Hibernate & Spring with Hibernate': ('23', ['Querying in Hibernate', 'Spring with Hibernate']),
    'Spring Boot (On Day 27)': ('27', ['Spring Boot']), 'Spring Data JPA (On day 29)': ('29', ['Spring Data JPA']),
    'MS Implementation with Spring Boot & Spring Cloud (On Day 33)': ('33', ['MS Implementation with Spring Boot & Spring Cloud'])}
J2EE_MS = {'1': ('Java Fundamentals', 'Design Patterns'), '2': ('RDBMS/SQL/JDBC', 'JavaScript'), '3': ('Maven', 'Spring with Hibernate'),
           'F': ('Spring Boot', 'MS Implementation with Spring Boot & Spring Cloud')}
def j2ee_span(a, b):
    rs = ALL('J2EE'); tp = {x['topic']: x['row_number'] for x in TOC['J2EE']['rows']}
    return [r for r in rs if tp[a] <= r <= tp[b]]

ws = openpyxl.load_workbook(base + 'Skill Assist Tracker/' + FILE)[SHEET]
items, skipped = [], []
for r1, r2, key in TRACKS:
    track = one(ws[f'A{r1}'].value)
    april = track in ('NGA Java Angular', 'NGA JFS Angular')
    kind = lab = dlab = date = None
    for r in range(r1, r2 + 1):
        b, c, d, e, fv = (ws[f'{x}{r}'].value for x in 'BCDEF')
        kind = one(b) or kind
        if c is not None: lab = one(c)
        if d is not None and key == 'J2EE' and not one(d).startswith('Ass'): dlab = one(d)
        if fv: dd, mm, yy = one(fv).split('-'); date = f'{yy}-{mm}-{dd}'
        name = one(e)
        if not name: continue
        if name == 'NA': skipped.append(r); continue
        ex = {'source': {'file': FILE, 'sheet': SHEET, 'row': r}}
        if kind.startswith('Day wise'):
            typ = 'Daily Assignment'
            if key == 'J2EE':
                label = dlab if lab.startswith('Assignment') else lab
                _, tps = J2EE_DAILY[label]; hit = by_topic('J2EE', *tps); seq = label  # Day column = topic name as written (user, 2026-10-05)
            else:
                a, z = rng(lab); seq = str(a) if a == z else f'{a}-{z}'
                hit = by_days(key, a, z)
                if key == 'SP' and (a, z) in ((7, 7), (8, 8)): hit = by_topic('SP', 'Building and testing REST APIs' if a == 7 else 'Working with Web & APIs')
                if key == 'JFS' and a == 23: hit = by_topic('JFS', 'Event Driven Microservices with Apache Kafka')  # Kafka item; TOC day 23 is the evaluation
        else:
            attempt = 'Re-attempt' if kind.startswith('Re-attempt') else 'Actual'
            m = re.match(r'Milestone[ -](\d+)', lab)
            final = not m
            assert m or lab.startswith('Final'), (r, lab)
            n = 'F' if final else m[1]
            typ, seq = ('Capstone', None) if final else ('Milestone Assessment', n)
            ex['assessment'] = f'Final – {attempt}' if final else attempt
            if key == 'J2EE': hit = j2ee_span(*J2EE_MS[n])
            else:
                span = (APRIL_JFS if april else MS[key])[n]
                hit = by_days(key, *span) if span else ALL(key)
        assert hit, r
        items.append(dict(row=r, track=track, key=key, type=typ, seq=seq, name=name, date=date, extra=ex, hit=hit))

topic_of = {k: {x['row_number']: f"{x['day_label']}: {x['topic']}" for x in v['rows']} for k, v in TOC.items()}
for i in items:
    print(i['row'], i['track'][:22], '|', i['type'], i['seq'] or '', i['extra'].get('assessment', ''), i['date'], i['name'][:45], '->',
          [topic_of[i['key']][h] for h in i['hit']] if len(i['hit']) <= 3 else f"{len(i['hit'])} topics ({topic_of[i['key']][i['hit'][0]]} … {topic_of[i['key']][i['hit'][-1]]})", file=sys.stderr)
print('items', len(items), 'skipped NA rows', skipped, {k: len(v['rows']) for k, v in TOC.items()}, file=sys.stderr)

# ---- SQL
q = lambda o: '$j$' + json.dumps(o, ensure_ascii=False) + '$j$'
t = lambda s: 'null' if s is None else '$n$' + s + '$n$'
out = ['begin;', f"insert into clients(name) values ({t(CLIENT)}) on conflict do nothing;"]
TRACK_TOC = {}
for r1, r2, key in TRACKS:
    tr = one(ws[f'A{r1}'].value); TRACK_TOC.setdefault(key, tr)
    out.append(f"insert into tracks(client_id,name,csm) select id,{t(tr)},{t(CSM)} from clients where name={t(CLIENT)} on conflict (client_id,name) do update set csm=excluded.csm;")
for key, v in TOC.items():  # each TOC file is attached to the first track that uses it
    rws = [{k: x[k] for k in ('row_number', 'day_label', 'topic', 'data')} for x in v['rows']]
    out.append(f"""insert into toc_files(client_id,track_id,file_name,sheet_name,header_row,columns,day_column,topic_column,notes)
select c.id,(select id from tracks where client_id=c.id and name={t(TRACK_TOC[key])}),{t(v['file'])},{t(v['sheet'])},{v['header_row']},{q(v['cols'])}::jsonb,'A',{t(v['topic_col'])},{t(v['note'])}
from clients c where c.name={t(CLIENT)} on conflict (client_id,file_name,sheet_name) do update set notes=excluded.notes, columns=excluded.columns;""")
    out.append(f"""insert into toc_rows(toc_file_id,row_number,day_label,topic,data)
select f.id,x.row_number,x.day_label,x.topic,x.data from toc_files f join clients c on c.id=f.client_id and c.name={t(CLIENT)}, jsonb_to_recordset({q(rws)}::jsonb) as x(row_number int, day_label text, topic text, data jsonb)
where f.file_name={t(v['file'])} and f.sheet_name={t(v['sheet'])}
on conflict (toc_file_id,row_number) do update set day_label=excluded.day_label, topic=excluded.topic, data=excluded.data;""")
for i in items:
    v = TOC[i['key']]
    out.append(f"""with ctx as (select c.id cid, tr.id tid, f.id fid from clients c join tracks tr on tr.client_id=c.id and tr.name={t(i['track'])} join toc_files f on f.client_id=c.id and f.file_name={t(v['file'])} and f.sheet_name={t(v['sheet'])} where c.name={t(CLIENT)}),
ins as (insert into contents(client_id,track_id,content_type,sequence_label,name,delivery_date,extra)
 select cid,tid,{t(i['type'])},{t(i['seq'])},{t(i['name'])},'{i['date']}',{q(i['extra'])}::jsonb from ctx
 on conflict (client_id,track_id,content_type,sequence_label,name) do update set delivery_date=excluded.delivery_date, extra=excluded.extra returning id)
insert into content_toc_links(content_id,toc_row_id)
select ins.id,r.id from ins cross join ctx join toc_rows r on r.toc_file_id=ctx.fid and r.row_number = any(array{i['hit']}::int[]) on conflict do nothing;""")
out.append('commit;')
print('\n'.join(out))
