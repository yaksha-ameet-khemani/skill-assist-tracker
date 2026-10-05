# Netcracker sheet of Details_SkillAssist.xlsx, rows 77-91 (user-confirmed 2026-10-04): "Netcracker React" -> track "React",
# CSM Priyanka, 19-08-2026 (merged). Assignment -> Daily Assignment, "Milestone Assessment N" -> Milestone Assessment N,
# Module 12 (Capstone Project) -> Capstone. Column B (Module Title) -> Course column, column A -> extra.program.
# TOC typed in from the "React Comprehensive Learning Journey" screenshot: one topic per ";" item, module title as group.
# Module assignment -> all topics of its module; milestone -> modules since the previous milestone; capstone -> module 12.
import openpyxl, json, re, warnings, sys
warnings.filterwarnings('ignore')
base = '/home/administrator/Downloads/IntelliJ Projects/Skill Assist Tracker/'
FILE, SHEET, CLIENT, CSM, TRACK, DATE = 'Details_SkillAssist.xlsx', 'Netcracker', 'Netcracker', 'Priyanka', 'React', '2026-08-19'
FN, SH = '(Added manually) Netcracker TOC screenshot', 'React Comprehensive Learning Journey'
TOC = [  # (module no, title, topics; hands-on; outcomes; duration) as in the screenshot
    (1, 'Module 1: Web & JavaScript Foundations for React', 'ES6+ syntax (let/const, arrow functions, destructuring, spread/rest); modules & imports; array methods (map, filter, reduce); promises & async/await; JSON; DOM basics; npm & package management',
     'Set up a React project; create functional components; build a simple profile page using JSX and props.', 'Write modern JavaScript confidently; understand the language features React is built on', '3-4 hrs'),
    (2, 'Module 2: React Fundamentals', 'What is React & why use it; JSX syntax; functional components; props & prop-types; rendering lists & keys; conditional rendering; component composition',
     'Build reusable components with props/state; implement event handling and controlled form inputs.', 'Build and compose simple functional components; understand JSX and the virtual DOM', '4-5 hrs'),
    (3, 'Module 3: State & Event Handling', 'useState hook; handling events (onClick, onChange, onSubmit); controlled vs uncontrolled forms; form validation basics; lifting state up',
     'Create a React mini app using conditional rendering, lists, keys and form validation.', 'Manage local component state and build interactive forms', '4-5 hrs'),
    (4, 'Module 4: Component Lifecycle & Core Hooks', 'useEffect (mount/update/unmount, cleanup, dependency arrays); useRef; useMemo & useCallback; custom hooks',
     'Build a multi-page React app using React Router with navigation, nested routes and a 404 page.', 'Manage side effects and component lifecycle using hooks; extract reusable logic into custom hooks', '5-6 hrs'),
    (5, 'Module 5: State Management at Scale', 'Context API & useContext; when to lift vs. centralize state; introduction to Redux Toolkit / Zustand; actions, reducers, store; connecting components to global state',
     'Implement React Hooks (useState/useEffect/useMemo); fetch and display data from a public REST API.', 'Choose and implement an appropriate state management strategy for a growing application', '6-8 hrs'),
    (6, 'Module 6: Routing & Navigation', 'React Router setup; route params & nested routes; programmatic navigation; protected/private routes; lazy loading routes',
     'Build a small application using Context API or Redux for shared state and implement protected routes.', 'Build multi-page single-page applications with client-side routing', '3-4 hrs'),
    (7, 'Module 7: Working with APIs & Async Data', 'fetch/axios; useEffect for data fetching; loading & error states; React Query / SWR for caching & sync; optimistic updates',
     'Integrate REST APIs with loading/error/empty states; implement search, filtering and pagination.', 'Integrate REST APIs into React apps with robust loading, error, and caching patterns', '5-6 hrs'),
    (8, 'Module 8: Performance & Advanced Patterns', 'React.memo, useMemo, useCallback in depth; code splitting & lazy/Suspense; render optimization & profiling; higher-order components & render props; error boundaries',
     'Create responsive React UI using CSS/Bootstrap/Tailwind and reusable UI components.', 'Diagnose and fix performance bottlenecks; apply advanced composition patterns', '5-6 hrs'),
    (9, 'Module 9: Styling & UI Component Libraries', 'CSS-in-JS (styled-components/Emotion); CSS Modules; Tailwind CSS; component libraries (MUI, Ant Design); responsive design & theming',
     'Optimize a React application using lazy loading, memoization and component-level performance techniques.', 'Style React applications using modern approaches and integrate a component library', '4-5 hrs'),
    (10, 'Module 10: Testing React Applications', 'Jest fundamentals; React Testing Library; unit vs integration tests; mocking API calls; snapshot testing; intro to E2E testing (Cypress/Playwright)',
     'Convert selected components to TypeScript; define interfaces/types and handle typed API responses.', 'Write reliable unit and integration tests for React components and hooks', '5-6 hrs'),
    (11, 'Module 11: Build Tools, TypeScript & Deployment', 'Vite/CRA build tooling; environment variables; TypeScript with React (typed props, hooks, generics); CI basics; deploying to Netlify/Vercel/cloud',
     'Write unit/component tests for React components using a suitable testing framework and mock API calls.', 'Configure a production build pipeline and add type safety with TypeScript', '5-6 hrs'),
    (12, 'Module 12: Capstone Project', 'End-to-end application combining routing, state management, API integration, styling, and testing; code review & best practices; deployment',
     'Develop and deploy an end-to-end React capstone application with authentication, API integration, testing and production build.', 'Independently design, build, test, and deploy a complete React application', '8-10 hrs')]
ws = openpyxl.load_workbook(base + FILE, data_only=True)[SHEET]
one = lambda v: re.sub(r'\s+', ' ', str(v)).strip()
assert one(ws['A76'].value) == 'Netcracker React' and one(ws['E77'].value) == '19-08-2026'
program = one(ws['A76'].value)
toc = []
for no, title, topics, hands, outcome, dur in TOC:
    for tp in topics.split('; '):
        toc.append(dict(row_number=len(toc) + 2, day_label=None, topic=tp,
                        data={'Module No.': str(no), 'Module': title, 'Topic': tp, 'Hands-on Learning': hands, 'Learning Outcomes': outcome, 'Duration': dur}))
mod_rows = lambda nos: [x['row_number'] for x in toc if int(x['data']['Module No.']) in nos]
items, since = [], []
for r in range(77, 92):
    mod, kind, name = one(ws[f'B{r}'].value), one(ws[f'C{r}'].value), one(ws[f'D{r}'].value)
    if mod.startswith('Milestone Assessment'):
        typ, seq, hit = 'Milestone Assessment', mod.split()[-1], mod_rows(since); since = []
    else:
        no = int(re.match(r'Module (\d+):', mod)[1])
        typ = 'Capstone' if 'Capstone' in mod else {'Assignment': 'Daily Assignment'}[kind]
        seq, hit = None, mod_rows([no]); since.append(no)
    assert hit, r
    items.append(dict(row=r, type=typ, seq=seq, name=name, course=mod, hit=hit))
    print(r, typ, seq or '', name, '->', len(hit), 'topics', file=sys.stderr)

q = lambda o: '$j$' + json.dumps(o, ensure_ascii=False) + '$j$'
t = lambda s: 'null' if s is None else '$n$' + s + '$n$'
cols = [{'letter': 'A', 'header': 'Module No.'}, {'letter': 'B', 'header': 'Module Title'}, {'letter': 'C', 'header': 'Topics Covered'},
        {'letter': 'D', 'header': 'Hands-on Learning'}, {'letter': 'E', 'header': 'Learning Outcomes'}, {'letter': 'F', 'header': 'Duration'}]
note = ('Typed in from the "Netcracker – React Comprehensive Learning Journey" screenshot shared on 2026-10-04; Topics Covered split '
        'into one topic per ";" item. Milestone Assessment / Practice Interview 1-4 rows are markers, not topics. In the screenshot the '
        'Hands-on Learning text of several modules (4-11) seems to belong to a neighbouring module; kept as shown.')
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
    extra = q({'source': {'file': FILE, 'sheet': SHEET, 'row': i['row']}, 'course': i['course'], 'program': program})
    out.append(f"""with ctx as (select c.id cid, tr.id tid, f.id fid from clients c join tracks tr on tr.client_id=c.id and tr.name={t(TRACK)} join toc_files f on f.client_id=c.id and f.file_name={t(FN)} and f.sheet_name={t(SH)} where c.name={t(CLIENT)}),
ins as (insert into contents(client_id,track_id,content_type,sequence_label,name,delivery_date,extra)
 select cid,tid,{t(i['type'])},{t(i['seq'])},{t(i['name'])},'{DATE}',{extra}::jsonb from ctx
 on conflict (client_id,track_id,content_type,sequence_label,name) do update set delivery_date=excluded.delivery_date, extra=excluded.extra returning id)
insert into content_toc_links(content_id,toc_row_id)
select ins.id,r.id from ins cross join ctx join toc_rows r on r.toc_file_id=ctx.fid and r.row_number = any(array{i['hit']}::int[]) on conflict do nothing;""")
out.append('commit;')
print('\n'.join(out))
