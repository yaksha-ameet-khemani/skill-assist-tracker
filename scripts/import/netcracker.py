# Netcracker sheet of Details_SkillAssist.xlsx, rows 2-9 (user-confirmed 2026-10-04): CSM Divyabharthi, track = column A
# ("UI", "BackEnd & FrontEnd"), 30-01-2026 (merged). Everything except "Milestone N" -> Daily Assignment (as IBM);
# Course Name -> Course column (extra.course). TOC typed in from two screenshots ("Intern – Batch 2" = UI, "For BE" = BackEnd
# & FrontEnd): one topic per comma item of the TOC column, Course Name as Module. Items named after a TOC topic link to it,
# others to all topics of their course; Milestone 1 links to every course above it in the TOC.
import json, sys
FILE, SHEET, CLIENT, CSM, DATE = 'Details_SkillAssist.xlsx', 'Netcracker', 'Netcracker', 'Divyabharthi', '2026-01-30'
TOCS = {  # track -> (toc sheet name, [(course, skill, [topics], hands-on, outcome)])
    'UI': ('Intern – Batch 2', [
        ('Java Programming', 'JAVA', ['Java Basics', 'Data Types', 'Control Statements', 'OOP Concepts', 'Collections Basics', 'Exception Handling', 'Java Packages'],
         'Write Java programs, use OOP concepts, handle exceptions, work with collections', 'Develop basic Java applications using OOP principles'),
        ('Microservices with Spring Boot', 'Springboot', ['Microservices Basics', 'Spring Boot Overview', 'Creating REST APIs', 'Configuration Management', 'Exception Handling', 'Actuator Basics'],
         'Build REST microservice, configure properties, test endpoints', 'Develop and run Spring Boot microservices'),
        ('Microservices with Spring Boot and Spring Cloud', 'Springboot and SpringCloud', ['Spring Cloud Overview', 'Service Discovery', 'Config Server', 'API Gateway', 'Circuit Breaker', 'Distributed Tracing Basics'],
         'Implement service discovery, externalize config, use gateway', 'Build resilient microservices using Spring Cloud')]),
    'BackEnd & FrontEnd': ('For BE', [
        ('Spring Boot and Spring Microservices', 'Spring Boot & Microservices', ['Spring Boot Architecture', 'Microservices Principles', 'Project Setup', 'REST API Development', 'Request/Response Handling', 'Configuration using application.yml', 'Profiles and Environments', 'Exception Handling', 'Inter-Service Communication (Basic)', 'Actuator and Health Checks'],
         'Create Spring Boot project, build REST APIs, configure properties and profiles, test services locally', 'Design and develop basic Spring Boot microservices'),
        ('Quarkus Super-Heroes Workshop', 'Quarkus', ['Quarkus Architecture', 'Project Bootstrap', 'RESTEasy APIs', 'Dev Mode and Live Reload', 'Configuration Management', 'Dependency Injection', 'Reactive Concepts (Intro)', 'Native Build Overview', 'Testing Basics'],
         'Run Super-Heroes demo, modify APIs, use dev mode, test endpoints', 'Build fast and lightweight microservices using Quarkus')]),
}
# (row, track, type, seq, name, course, link) ; link = topic name in that course, '*' = whole course, 'M' = all courses above
ITEMS = [(2, 'UI', 'Daily Assignment', None, 'Java - Divisible by 25', 'Java Programming', '*'),
         (3, 'UI', 'Daily Assignment', None, 'Java - Cold Drink using Recursion', 'Java Programming', '*'),
         (4, 'UI', 'Daily Assignment', None, 'Spring Boot - Spring Boot Overview', 'Microservices with Spring Boot', 'Spring Boot Overview'),
         (5, 'UI', 'Daily Assignment', None, 'Spring Boot - Creating REST APIs', 'Microservices with Spring Boot', 'Creating REST APIs'),
         (6, 'UI', 'Milestone Assessment', '1', 'Spring Boot - Student Score Management & Monitoring Service', 'Milestone 1', 'M'),
         (7, 'BackEnd & FrontEnd', 'Daily Assignment', None, 'Spring Boot - Configuration Management', 'Spring Boot and Spring Microservices', 'Configuration using application.yml'),
         (8, 'BackEnd & FrontEnd', 'Daily Assignment', None, 'Spring Boot - Exception Handling', 'Spring Boot and Spring Microservices', 'Exception Handling'),
         (9, 'BackEnd & FrontEnd', 'Milestone Assessment', '1', 'Spring Boot - Order Price Calculator & System Monitor', 'Milestone 1', 'M')]

toc = {}  # track -> list of rows
for tr, (sh, courses) in TOCS.items():
    rows = []
    for cn, skill, topics, hands, outcome in courses:
        for tp in topics:
            rows.append(dict(row_number=len(rows) + 2, day_label=None, topic=tp,
                             data={'Module': cn, 'Skill': skill, 'Topic': tp, 'Hands-On Learning': hands, 'Learning Outcome': outcome}))
    toc[tr] = rows
for it in ITEMS:
    row, tr, _, _, name, course, link = it
    rs = toc[tr]
    if link == 'M': hit = [r['row_number'] for r in rs]
    elif link == '*': hit = [r['row_number'] for r in rs if r['data']['Module'] == course]
    else: hit = [r['row_number'] for r in rs if r['data']['Module'] == course and r['topic'] == link]
    assert hit, it
    ITEMS[ITEMS.index(it)] = it + (hit,)
    print(row, tr, name, '->', [r['topic'] for r in rs if r['row_number'] in hit][:4], len(hit), file=sys.stderr)

q = lambda o: '$j$' + json.dumps(o, ensure_ascii=False) + '$j$'
t = lambda s: 'null' if s is None else '$n$' + s + '$n$'
FN = '(Added manually) Netcracker TOC screenshot'
cols = [{'letter': 'A', 'header': 'Module'}, {'letter': 'B', 'header': 'Skill'}, {'letter': 'C', 'header': 'Topic'}, {'letter': 'D', 'header': 'Hands-On Learning'}, {'letter': 'E', 'header': 'Learning Outcome'}]
out = ['begin;', f"insert into clients(name) values ({t(CLIENT)}) on conflict do nothing;"]
for tr, (sh, _) in TOCS.items():
    out.append(f"insert into tracks(client_id,name,csm) select id,{t(tr)},{t(CSM)} from clients where name={t(CLIENT)} on conflict (client_id,name) do update set csm=excluded.csm;")
    out.append(f"""insert into toc_files(client_id,track_id,file_name,sheet_name,header_row,columns,topic_column,notes)
select c.id,(select id from tracks where client_id=c.id and name={t(tr)}),{t(FN)},{t(sh)},1,{q(cols)}::jsonb,'C','Typed in from the screenshot shared on 2026-10-04; the TOC column is split into one topic per comma item.'
from clients c where c.name={t(CLIENT)} on conflict (client_id,file_name,sheet_name) do nothing;""")
    out.append(f"""insert into toc_rows(toc_file_id,row_number,day_label,topic,data)
select f.id,x.row_number,x.day_label,x.topic,x.data from toc_files f join clients c on c.id=f.client_id and c.name={t(CLIENT)}, jsonb_to_recordset({q(toc[tr])}::jsonb) as x(row_number int, day_label text, topic text, data jsonb)
where f.file_name={t(FN)} and f.sheet_name={t(sh)}
on conflict (toc_file_id,row_number) do update set topic=excluded.topic, data=excluded.data;""")
for row, tr, typ, seq, name, course, _, hit in ITEMS:
    extra = q({'source': {'file': FILE, 'sheet': SHEET, 'row': row}, 'course': course})
    out.append(f"""with ctx as (select c.id cid, tr.id tid, f.id fid from clients c join tracks tr on tr.client_id=c.id and tr.name={t(tr)} join toc_files f on f.client_id=c.id and f.file_name={t(FN)} and f.sheet_name={t(TOCS[tr][0])} where c.name={t(CLIENT)}),
ins as (insert into contents(client_id,track_id,content_type,sequence_label,name,delivery_date,extra)
 select cid,tid,{t(typ)},{t(seq)},{t(name)},'{DATE}',{extra}::jsonb from ctx
 on conflict (client_id,track_id,content_type,sequence_label,name) do update set delivery_date=excluded.delivery_date, extra=excluded.extra returning id)
insert into content_toc_links(content_id,toc_row_id)
select ins.id,r.id from ins cross join ctx join toc_rows r on r.toc_file_id=ctx.fid and r.row_number = any(array{hit}::int[]) on conflict do nothing;""")
out.append('commit;')
print('\n'.join(out))
