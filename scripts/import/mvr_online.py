# MVR sheet rows 14-61 of the online copy of Details_SkillAssist.xlsx (Google Sheets, 2026-10-05; not in the local file).
# User-confirmed: CSM Anubha, type Assessment, one track per Assessment Name (as for rows 2-13), Date = the date in the
# assessment name (C Hybrid Assessment has none -> column F 16-09-2026). Column F (block date) kept as extra.sheet_date.
# No TOC: one hand-written topic per language in the existing "(Added manually) / MVR topics" sheet (Python Basics = row 2,
# plus SQL, HTML, CSS, C). "HTML & CSS - ..." links to both HTML and CSS.
import json, re, sys
CLIENT, CSM, FN, SH = 'MVR', 'Anubha', '(Added manually)', 'MVR topics'
SRC = 'Details_SkillAssist.xlsx (online copy, Google Sheets)'
TOPICS = {'Python': 2, 'SQL': 3, 'HTML': 4, 'CSS': 5, 'C': 6}
NEW_TOPICS = [(3, 'SQL'), (4, 'HTML'), (5, 'CSS'), (6, 'C')]
# (sheet row, question, assessment name or None = same as previous row, column F date or None)
ROWS = [
    (14, 'Python - Employee Salary Calculator', 'Python Coding Assessment - 15.09.26', '11-09-2026'),
    (15, 'Python - Loan Amount Category', None, None),
    (16, 'Python - Student Marks Analyzer', 'Python Coding Assessment - 16.09.26', None),
    (17, 'Python - Unique Programming Skills Tracker', None, None),
    (18, 'Python - Employee Information System', 'Python Coding Assessment - 17.09.26', None),
    (19, 'Python - Student Enrollment Tracker', None, None),
    (20, 'Python - Online Payment Processing System', 'Python Coding Assessment - 18.09.26', None),
    (21, 'Python - Virtual Paint Application', None, None),
    (22, 'Python - Employee Data File Manager', 'Python Coding Assessment - 19.09.26', None),
    (23, 'Python - Secure Bank Withdrawal System', None, None),
    (24, 'C - Sensor Record Analyzer', 'C Hybrid Assessment', '16-09-2026'),
    (25, 'C - Device Status Register Decoder', None, None),
    (26, 'Python - Camel Case', 'Python Coding Assessment - 21.09.26', '18-09-2026'),
    (27, 'Python - Tom and Jerry Toy Shopping', None, None),
    (28, 'Python - Sort Array by Number of Digits', 'Python Coding Assessment - 22.09.26', None),
    (29, 'Python - Sort Every Word', None, None),
    (30, 'Python - Multiples of 3', 'Python Coding Assessment - 23.09.26', None),
    (31, 'Python - Password Strength Analyzer', None, None),
    (32, 'Python - Product Search and Sort', 'Python Coding Assessment - 24.09.26', None),
    (33, 'Python - Student Rank Search', None, None),
    (34, 'Python - Product Discount Calculator Using Lambda Function', 'Python Coding Assessment - 25.09.26', None),
    (35, 'Python - Student Name Formatter Using Lambda Function', None, None),
    (36, 'Python - Circle Area Calculator Using Math Module', 'Python Coding Assessment - 26.09.26', None),
    (37, 'Python - Lucky Number Finder', None, None),
    (38, 'Python - Cold Drink Minimum Loss Using Recursion', 'Python Coding Assessment - 28.09.26', '25-09-2026'),
    (39, 'Python - Find the Second Highest Score', None, None),
    (40, 'SQL - Employee Records Management', 'SQL Coding Assessment - 29.09.26', None),
    (41, 'SQL - Employee Salary Analysis', None, None),
    (42, 'SQL - Employee Department Report', 'SQL Coding Assessment - 30.09.26', None),
    (43, 'SQL - Doctor Surgery Count Report', None, None),
    (44, 'SQL - Department-wise Average Salary Report', 'SQL Coding Assessment - 01.10.26', None),
    (45, 'SQL - Employee Salary Statistics', None, None),
    (46, 'SQL - Employee Salary Filter', 'SQL Coding Assessment - 02.10.26', None),
    (47, 'SQL - Top Performing Employees', None, None),
    (48, 'HTML - Event Registration Form', 'HTML Coding Assessment - 03.10.26', None),
    (49, 'HTML & CSS - Personal Portfolio Web Page', None, None),
    (50, 'SQL - Student Records Normalization', 'SQL Coding Assessment - 05.10.26', '01-10-2026'),
    (51, 'SQL - E-Commerce Order Records Normalization', None, None),
    (52, 'Python - Student Performance Evaluator', 'Python Coding Assessment - 06.10.26', None),
    (53, 'Python - Delivery Charge Calculator', None, None),
    (54, 'HTML - Student Profile Page', 'HTML Coding Assessment - 07.10.26', None),
    (55, 'HTML - College Club Registration Page', None, None),
    (56, 'Python - Unique Participant Analyzer', 'Python Coding Assessment - 08.10.26', None),
    (57, 'Python - Common Skills Finder', None, None),
    (58, 'CSS - Student Profile Card Styling', 'CSS Coding Assessment - 09.10.26', None),
    (59, 'CSS - Online Course Card Styling', None, None),
    (60, 'Python - Employee Bonus Calculator', 'Python Coding Assessment - 10.10.26', None),
    (61, 'Python - Ride Fare Calculator', None, None),
]
iso = lambda d: '-'.join(reversed(d.split('-')))
items, track, fdate = [], None, None
for r, name, a, f in ROWS:
    track, fdate = a or track, f or fdate
    m = re.search(r'(\d\d)\.(\d\d)\.(\d\d)$', track)
    date = f'20{m[3]}-{m[2]}-{m[1]}' if m else iso(fdate)
    # Track names use one date style "… - DD Mon YYYY" (renamed 2026-10-05, see rename_dated_tracks.py); the date is
    # stored as tracks.extra.date for ordering.
    shown = re.sub(r'(\d\d)\.(\d\d)\.(\d\d)$', lambda x: __import__('datetime').date(2000 + int(x[3]), int(x[2]), int(x[1])).strftime('%d %b %Y'), track)
    langs = ['HTML', 'CSS'] if name.startswith('HTML & CSS') else [name.split(' - ')[0]]
    items.append(dict(row=r, track=shown, tdate=date if m else None, name=name, date=date, sheet_date=iso(fdate), hit=[TOPICS[l] for l in langs]))
    print(r, track, '|', name, date, langs, file=sys.stderr)
print(len(items), 'items,', len({i['track'] for i in items}), 'tracks', file=sys.stderr)

q = lambda o: '$j$' + json.dumps(o, ensure_ascii=False) + '$j$'
t = lambda s: 'null' if s is None else '$n$' + s + '$n$'
out = ['begin;']
out.append(f"""insert into toc_rows(toc_file_id,row_number,day_label,topic,data)
select f.id,x.row_number,null,x.topic,x.data from toc_files f join clients c on c.id=f.client_id and c.name={t(CLIENT)},
 jsonb_to_recordset({q([dict(row_number=n, topic=tp, data={'Topic': tp}) for n, tp in NEW_TOPICS])}::jsonb) as x(row_number int, topic text, data jsonb)
where f.file_name={t(FN)} and f.sheet_name={t(SH)} on conflict (toc_file_id,row_number) do update set topic=excluded.topic, data=excluded.data;""")
for tr, td in dict.fromkeys((i['track'], i['tdate']) for i in items):
    ex = q({'date': td} if td else {})
    out.append(f"insert into tracks(client_id,name,csm,extra) select id,{t(tr)},{t(CSM)},{ex}::jsonb from clients where name={t(CLIENT)} on conflict (client_id,name) do update set csm=excluded.csm, extra=tracks.extra || excluded.extra;")
for i in items:
    ex = {'source': {'file': SRC, 'sheet': 'MVR', 'row': i['row']}, 'sheet_date': '-'.join(reversed(i['sheet_date'].split('-')))}
    out.append(f"""with ctx as (select c.id cid, tr.id tid, f.id fid from clients c join tracks tr on tr.client_id=c.id and tr.name={t(i['track'])} join toc_files f on f.client_id=c.id and f.file_name={t(FN)} and f.sheet_name={t(SH)} where c.name={t(CLIENT)}),
ins as (insert into contents(client_id,track_id,content_type,sequence_label,name,delivery_date,extra)
 select cid,tid,'Assessment',null,{t(i['name'])},'{i['date']}',{q(ex)}::jsonb from ctx
 on conflict (client_id,track_id,content_type,sequence_label,name) do update set delivery_date=excluded.delivery_date, extra=excluded.extra returning id)
insert into content_toc_links(content_id,toc_row_id)
select ins.id,r.id from ins cross join ctx join toc_rows r on r.toc_file_id=ctx.fid and r.row_number = any(array{i['hit']}::int[]) on conflict do nothing;""")
out.append('commit;')
print('\n'.join(out))
