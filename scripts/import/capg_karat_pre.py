# Capgemini rows 48-63 of the online copy of Details_SkillAssist.xlsx (Google Sheets, 2026-10-05; not in the local file).
# "KARAT Java + React Curriculum" pre-assessments. User-confirmed: one track per Program (column B), CSM Muzzamil, type
# Pre-Assessment, 30-07-2026 (written on the first row only); column C skill -> Course column.
# TOC = the 6 topic areas of "2.1 Topic Weightage - MCQ Section" in PreProgram_Readiness_Assessment_KARAT_Updated.docx
# (Downloads/Muzzamil Capgemini Karat/From Sonal Ma'am 08-07/), plus a hand-written "React" topic (not in the doc).
# Java -> Core Java/OOP/JVM + DSA (Singleton Data Manager also Low-Level Design); SQL -> SQL; GIT -> Git & Agile/SDLC;
# JS -> JavaScript/Web/API; React -> React.
import json, re, sys, zipfile, html
CLIENT, CSM, CURR = 'Capgemini', 'Muzzamil', 'KARAT Java + React Curriculum'
DOC = "/home/administrator/Downloads/Muzzamil Capgemini Karat/From Sonal Ma'am 08-07/PreProgram_Readiness_Assessment_KARAT_Updated.docx"
FN, SH = 'PreProgram_Readiness_Assessment_KARAT_Updated.docx', '2.1 Topic Weightage – MCQ Section'
SRC = 'Details_SkillAssist.xlsx (online copy, Google Sheets)'
P1, P2 = 'Program 1 — Core Engineering Foundations', 'Program 2 — Web & Delivery Foundations'
ROWS = [(48, P1, 'Java', 'Java - Core Class Design'), (49, P1, 'Java', 'Java - Virtual Paint'),
        (50, P1, 'Java', 'Java - Collection Iteration & Filtering'), (51, P1, 'Java', 'Java - Prefix and Suffix Product'),
        (52, P1, 'Java', 'Java - Infix expression to postfix expression'), (53, P1, 'Java', 'Java - Binary Tree In-Order Traversal'),
        (54, P1, 'SQL', 'SQL - Find out which patients are scheduled for surgery and the surgeons assigned to them'),
        (55, P1, 'Java', 'Java - Singleton Data Manager'),
        (56, P2, 'GIT', 'GIT - Remotes & Branching'), (57, P2, 'JS', 'JS - Destructured Contact Parsing'),
        (58, P2, 'JS', 'JS - Promise-Based Async CIBIL Check'), (59, P2, 'JS', 'JS - HTTP Method & Status Resolver'),
        (60, P2, 'JS', 'JS - API Failure Classifier & Token Validator'), (61, P2, 'React', 'React - Product Catalog & Form Flow'),
        (62, P2, 'React', 'React - Routed API-Connected Catalog'), (63, P2, 'React', 'React - Accessible Task Feed — Integrated Checkpoint')]

# ---- the doc's topic-weightage table: rows after the "Topic | # Questions | Rationale" header
x = zipfile.ZipFile(DOC).read('word/document.xml').decode()
tables = re.findall(r'<w:tbl>.*?</w:tbl>', x, re.S)
cell = lambda c: html.unescape(re.sub(r'<[^>]+>', '', re.sub(r'</w:p>', '\n', c))).strip()
grids = [[[cell(c) for c in re.findall(r'<w:tc>.*?</w:tc>', tr, re.S)] for tr in re.findall(r'<w:tr[ >].*?</w:tr>', tb, re.S)] for tb in tables]
grid = next(g for g in grids if g and g[0][:2] == ['Topic', '# Questions'])
areas = [g for g in grid[1:] if len(g) >= 3 and g[1].isdigit()]
assert len(areas) == 6, areas
toc = [dict(row_number=n, topic=a[0], data={'Topic': a[0], '# Questions': a[1], "Rationale (Why It's Pre-Entry, Not In-Program)": a[2]})
       for n, a in enumerate(areas, 1)]
toc.append(dict(row_number=7, topic='React', data={'Topic': 'React', 'Note': 'Added manually: React has no topic area in the readiness doc'}))
num = {}
for r in toc:
    k = r['topic'].lower()
    num['java'] = r['row_number'] if k.startswith('core java') else num.get('java')
    num['dsa'] = r['row_number'] if k.startswith('dsa') else num.get('dsa')
    num['sql'] = r['row_number'] if k.startswith('sql') else num.get('sql')
    num['js'] = r['row_number'] if k.startswith('javascript') else num.get('js')
    num['lld'] = r['row_number'] if k.startswith('low-level') else num.get('lld')
    num['git'] = r['row_number'] if k.startswith('git') else num.get('git')
num['react'] = 7
assert all(num.values()), num
HIT = {'Java': ['java', 'dsa'], 'SQL': ['sql'], 'GIT': ['git'], 'JS': ['js'], 'React': ['react']}
items = []
for r, prog, sk, name in ROWS:
    keys = HIT[sk] + (['lld'] if 'Singleton' in name else [])
    items.append(dict(row=r, track=f'KARAT – {prog}', course=sk, name=name, hit=[num[k] for k in keys]))
    print(r, prog[:9], sk, name[:45], '->', [toc[num[k] - 1]['topic'][:30] for k in keys], file=sys.stderr)

q = lambda o: '$j$' + json.dumps(o, ensure_ascii=False) + '$j$'
t = lambda s: 'null' if s is None else '$n$' + s + '$n$'
cols = [{'letter': 'A', 'header': 'Topic'}, {'letter': 'B', 'header': '# Questions'}, {'letter': 'C', 'header': "Rationale (Why It's Pre-Entry, Not In-Program)"}]
note = ('Pre-Program Readiness Assessment, KARAT-Aligned Edition (Java + React, 4–8 years): the MCQ topic-weightage table '
        '(section 2.1). Row numbers = order in that table; row 7 "React" added manually for the React pre-assessments.')
out = ['begin;']
for tr in dict.fromkeys(i['track'] for i in items):
    out.append(f"insert into tracks(client_id,name,csm) select id,{t(tr)},{t(CSM)} from clients where name={t(CLIENT)} on conflict (client_id,name) do update set csm=excluded.csm;")
out.append(f"""insert into toc_files(client_id,track_id,file_name,sheet_name,header_row,columns,topic_column,notes)
select c.id,(select id from tracks where client_id=c.id and name={t(items[0]['track'])}),{t(FN)},{t(SH)},1,{q(cols)}::jsonb,'A',{t(note)}
from clients c where c.name={t(CLIENT)} on conflict (client_id,file_name,sheet_name) do update set notes=excluded.notes, columns=excluded.columns;""")
out.append(f"""insert into toc_rows(toc_file_id,row_number,day_label,topic,data)
select f.id,x.row_number,null,x.topic,x.data from toc_files f join clients c on c.id=f.client_id and c.name={t(CLIENT)},
 jsonb_to_recordset({q(toc)}::jsonb) as x(row_number int, topic text, data jsonb)
where f.file_name={t(FN)} and f.sheet_name={t(SH)} on conflict (toc_file_id,row_number) do update set topic=excluded.topic, data=excluded.data;""")
for i in items:
    ex = {'source': {'file': SRC, 'sheet': 'Capgemini', 'row': i['row']}, 'course': i['course'], 'curriculum': CURR}
    out.append(f"""with ctx as (select c.id cid, tr.id tid, f.id fid from clients c join tracks tr on tr.client_id=c.id and tr.name={t(i['track'])} join toc_files f on f.client_id=c.id and f.file_name={t(FN)} and f.sheet_name={t(SH)} where c.name={t(CLIENT)}),
ins as (insert into contents(client_id,track_id,content_type,sequence_label,name,delivery_date,extra)
 select cid,tid,'Pre-Assessment',null,{t(i['name'])},'2026-07-30',{q(ex)}::jsonb from ctx
 on conflict (client_id,track_id,content_type,sequence_label,name) do update set delivery_date=excluded.delivery_date, extra=excluded.extra returning id)
insert into content_toc_links(content_id,toc_row_id)
select ins.id,r.id from ins cross join ctx join toc_rows r on r.toc_file_id=ctx.fid and r.row_number = any(array{i['hit']}::int[]) on conflict do nothing;""")
out.append('commit;')
print('\n'.join(out))
