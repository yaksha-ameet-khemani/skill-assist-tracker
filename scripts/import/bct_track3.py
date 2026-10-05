# BCT Banking rows 24-57 of the online copy of Details_SkillAssist.xlsx (Google Sheets, 2026-10-05; not in the local file).
# User-confirmed: track "TRACK 3: FULL STACK DEVELOPMENT" (the sheet's Module column; its Track column says "Phase – 3",
# which already names the May batch), CSM Ayman. Assignment -> Daily Assignment numbered 1-30 in row order (31-07-2026);
# Milestone N -> Milestone Assessment N (13-08-2026). The sheet's Topic column is the TOC (added to the existing BCT
# Banking topic sheet at the same row numbers): an assignment links to its own topic; Python milestones (M1, M3) link to
# the Python-side topics, Java milestones (M2, M4) to the Java/Spring-side topics.
import json, sys
CLIENT, CSM, TRACK, PHASE = 'BCT Banking', 'Ayman', 'TRACK 3: FULL STACK DEVELOPMENT', 'Phase – 3'
FN, SH = 'Details_SkillAssist.xlsx', 'BCT Banking'  # existing BCT topic sheet in the DB
SRC = 'Details_SkillAssist.xlsx (online copy, Google Sheets)'
ASSIGN = [  # (row, topic, name) - all 31-07-2026
    (24, 'Concurrency', 'Implementing Multithreading and Concurrency in Java'),
    (25, 'JVM', 'Optimizing JVM Performance for Spring Boot Microservices'),
    (26, 'AI', 'Practical Applications of AI-Assisted Development Tools'),
    (27, 'AsyncIO', 'Async IO in Python: A Practical Hands-on Assignment'),
    (28, 'FastAPI', 'Building a Data Processing API with Pandas, NumPy, and FastAPI'),
    (29, 'OpenAPI', 'Designing a REST API with OpenAPI/Swagger Documentation'),
    (30, 'Security', 'Securing and Documenting APIs with OAuth2, JWT, and AI-Powered Tools'),
    (31, 'PostgreSQL', 'Optimizing PostgreSQL Performance: A Hands-on Approach'),
    (32, 'Oracle', 'Optimizing and Recovering an Oracle Database'),
    (33, 'JUnit', 'Hands-on JUnit-5: Mastering Annotations, Assertions, and Advanced Concepts'),
    (34, 'SpringSecurity', 'Implementing Spring Security Fundamentals in a Real-World Scenario'),
    (35, 'OAuth2', 'Implementing LDAP and OAuth2 Security: A Practical Approach'),
    (36, 'SpringCloud', 'Implementing Spring Cloud Service Discovery and Config with a Practical Use Case'),
    (37, 'APIGateway', 'Designing API Gateway and Service Communication for a Simple E-commerce Application'),
    (38, 'Temenos', 'Integrating Temenos T24 APIs for Secure Open Banking'),
    (39, 'Testing', 'Practical Application of Functional, Compliance, Performance Testing, and AI Log Analysis'),
    (40, 'Docker', 'Hands-on Docker Fundamentals: Creating a Simple Web Server'),
    (41, 'JIRA', 'Implementing Agile Project Execution with JIRA'),
    (42, 'FullStack', 'Full Stack Integration Lab: Deploying a Secure, Containerized Service'),
    (43, 'Integration', 'Composite System Assessment: Testing, Security, and Integration'),
    (44, 'Resilience', 'Implementing Resilience and Fault Tolerance in Spring Boot'),
    (45, 'Messaging', 'Designing a Messaging-Driven Architecture for Banking Systems'),
    (46, 'SQL', 'Optimizing Queries with Execution Plans and Indexing Strategies'),
    (47, 'OWASP', 'Enhancing Banking App Security: OWASP Top 10, Secure Code Review, and Vulnerability Management'),
    (48, 'ContractTesting', 'Practical Integration and Contract Testing'),
    (49, 'Profiling', 'Hands-on JVM Profiling and Load Testing'),
    (50, 'Git', 'Implementing Collaborative Workflows with Git Branching Strategies'),
    (51, 'Batch', 'Batch Processing and Reconciliation in Temenos T24'),
    (52, 'Microservices', 'Designing a Microservice-Based Banking System'),
    (53, 'Refactoring', 'Full Stack Consolidation: Peer Review and Refactoring Exercise'),
]
MILESTONES = [  # (row, n, skill, name) - all 13-08-2026
    (54, '1', 'Python', 'Real-Time Loan Application Risk Analytics & REST API Service'),
    (55, '2', 'Java', 'Microservice API Gateway & RBAC Authorization Engine'),
    (56, '3', 'Python', 'Open Banking Payment Gateway & Fraud Risk Integration Service'),
    (57, '4', 'Java', 'Banking Microservice Resilience & Fault Tolerance Engine'),
]
SIDE = {'Python': ['AsyncIO', 'FastAPI', 'OpenAPI', 'Security'],
        'Java': ['Concurrency', 'JVM', 'JUnit', 'SpringSecurity', 'OAuth2', 'SpringCloud', 'APIGateway', 'Resilience',
                 'Messaging', 'ContractTesting', 'Profiling', 'Microservices']}
row_of = {tp: r for r, tp, _ in ASSIGN}

items = [dict(row=r, type='Daily Assignment', seq=str(n), name=nm, date='2026-07-31', hit=[r], course=tp)
         for n, (r, tp, nm) in enumerate(ASSIGN, 1)]
items += [dict(row=r, type='Milestone Assessment', seq=n, name=nm, date='2026-08-13', hit=[row_of[x] for x in SIDE[sk]], course=sk)
          for r, n, sk, nm in MILESTONES]
for i in items: print(i['row'], i['type'], i['seq'], i['name'][:50], '->', len(i['hit']), 'topics', file=sys.stderr)

q = lambda o: '$j$' + json.dumps(o, ensure_ascii=False) + '$j$'
t = lambda s: 'null' if s is None else '$n$' + s + '$n$'
toc = [dict(row_number=r, topic=tp, data={'Topic': tp, 'Track': PHASE, 'Module': TRACK}) for r, tp, _ in ASSIGN]
out = ['begin;',
       f"insert into tracks(client_id,name,csm) select id,{t(TRACK)},{t(CSM)} from clients where name={t(CLIENT)} on conflict (client_id,name) do update set csm=excluded.csm;",
       f"""insert into toc_rows(toc_file_id,row_number,day_label,topic,data)
select f.id,x.row_number,null,x.topic,x.data from toc_files f join clients c on c.id=f.client_id and c.name={t(CLIENT)},
 jsonb_to_recordset({q(toc)}::jsonb) as x(row_number int, topic text, data jsonb)
where f.file_name={t(FN)} and f.sheet_name={t(SH)} on conflict (toc_file_id,row_number) do update set topic=excluded.topic, data=excluded.data;"""]
for i in items:
    ex = {'source': {'file': SRC, 'sheet': SH, 'row': i['row']}, 'phase': PHASE}
    out.append(f"""with ctx as (select c.id cid, tr.id tid, f.id fid from clients c join tracks tr on tr.client_id=c.id and tr.name={t(TRACK)} join toc_files f on f.client_id=c.id and f.file_name={t(FN)} and f.sheet_name={t(SH)} where c.name={t(CLIENT)}),
ins as (insert into contents(client_id,track_id,content_type,sequence_label,name,delivery_date,extra)
 select cid,tid,{t(i['type'])},{t(i['seq'])},{t(i['name'])},'{i['date']}',{q(ex)}::jsonb from ctx
 on conflict (client_id,track_id,content_type,sequence_label,name) do update set delivery_date=excluded.delivery_date, extra=excluded.extra returning id)
insert into content_toc_links(content_id,toc_row_id)
select ins.id,r.id from ins cross join ctx join toc_rows r on r.toc_file_id=ctx.fid and r.row_number = any(array{i['hit']}::int[]) on conflict do nothing;""")
out.append('commit;')
print('\n'.join(out))
