# Skill Assist Tracker

Records every piece of content created on Skill Assist (pre-assessments, daily assignments,
milestones, capstones, direct assessments, practice) and the TOC rows each one is based on,
so similar requests can reuse existing content.

- **Database + login:** Supabase (runs locally in Docker now; supabase.com free tier later)
- **Website:** React + Vite in `web/` (Cloudflare Pages / Netlify free tier later)

## Run it locally

```bash
# 1. Start the database (Docker must be running). First run downloads images.
cd skill-assist-portal
npx supabase start

# 2. Start the website
cd web
npm install        # first time only
npm run dev        # open http://localhost:5173
```

Stop with `Ctrl+C` (website) and `npx supabase stop` (database). Data is kept between restarts.

| What | URL |
|---|---|
| Website | http://localhost:5173 |
| Supabase Studio (view/edit tables directly) | http://127.0.0.1:54323 |

The login page is currently **off** (`VITE_REQUIRE_LOGIN=false` in `web/.env.local`): the site
signs in automatically with the local account set in the same file. To bring the login page back,
set it to `true` and restart `npm run dev`.

## How to use

**Order (home page):** clients, CSMs, tracks and types are A–Z ignoring capitals (numbers in number order, e.g. Week 2 before Week 10), in the filters and the table. Track names that differ only by a trailing date ("Coding Assessment - 02 Sep 2026" … "- 03 Oct 2026") go in date order. CIET and MVR dated track names use that one style (renamed 2026-10-05, `scripts/import/rename_dated_tracks.py`; the date is also kept in tracks.extra.date).

**Doc links (home page):** an item's name opens its problem-statement Doc link in a new tab (📁 Drive folder, 📄 Google Doc, 📎 Drive file); some also show a "Solution" link. Links come from the "TestCase-Count-ALL" Google Sheet, tab **SkillAssist_AI-Usecases** only (Doc link, Proficiency, Test Link, Tested, Remarks, Solution), stored in contents.extra.links. To refresh: download that sheet as `TestCase-Count-ALL.xlsx` into the tracker folder and run `python3 scripts/import/sync_doc_links.py > links.sql`, then load links.sql with psql (it rewrites all links). Matching is by name (letters/digits only); a prefix-only match ("Digit Analyzer" = "Java - Digit Analyzer") needs ≥ 20 letters/digits and never crosses two different prefixes. First run 2026-10-05: 771 of 1,184 items linked; 5 left without because the same name has two different Doc links in the sheet (IBM "C# Basics for Absolute Beginners - Use variables" rows 680/687; MVR + CIET "SQL - Employee Records Management" rows 999/1051 and "SQL - Employee Salary Analysis" rows 1000/1052).

**Adding in the browser (home page "+ Add content", top right):** opens the same popup empty, with the Client and Track you are filtered on already filled in; a new client or track name is created on save. "Save & add another" keeps client, track, CSM, type, date and week and clears the rest, for entering several items in a row.

**Editing in the browser (home page ✎, last column):** opens a popup with every field of the item: Track (typing a new name creates the track), CSM (applies to the whole track), Type, Day, Date, Content name, Doc link, Solution link, **Week** (greyed out until "Has week" is ticked; unticking removes the week), the optional columns (Course, Proficiency, Assessment, Project, Participant: the ones the client uses, the rest under "Show all fields"), Notes and Topics. Topics: search the client's TOC topics (also searches subtopics) and click "+ Add", remove with ×, or type a new topic, which is saved into the client's hand-written topic list (created if missing) when you click Save. Delete asks for a second click. The client itself can't be changed there (topics belong to the client).

**Adding missing Doc links (home page):** clients that still have items without a Doc link are shown in orange in the Client filter with "⚠ N without link"; tick **Only without link** to list just those items. Each such item has a **+ Link** button: paste the Drive folder / Google Doc link and press Enter (or Save). Linked items have a small **✎** to change the link; saving an empty box removes it. Links added this way are marked manual (extra.links.manual) and the sheet sync never overwrites them.

**Column widths (home page):** drag the right edge of any column header to resize it, like Excel; double-click the edge to fit the column to its content. Text wraps to the width you set (like Excel "wrap text"); long Day labels wrap by default. Widths are remembered in your browser; "Reset column widths" puts them back to automatic.

1. **Upload TOC**: pick client/track, the Excel file, sheet and header row; tick the columns to
   keep and choose which column is the Day and which is the Topic. Every row keeps its Excel row
   number, so a content item can point to e.g. *row 6 → F6/G6*.
2. **Import content**: pick a content-list Excel and tell it which columns hold the name, track,
   type, day/milestone number, date and (optionally) TOC row numbers (`6`, `6, 8`, `6-13`).
   For side-by-side layouts like the *Sony Priyanka* sheet, import one block of columns at a time.
   Daily assignments are auto-linked by day number; anything else can be linked by row numbers
   or by hand. Re-importing the same sheet updates items instead of duplicating them.
3. **Content**: search, filter, see counts by type, export to Excel, and open an item to link or
   unlink TOC rows by hand.
4. **TOC topics**: search all TOCs and see which content was already built on each topic. This is
   where you look for reusable content when a similar TOC arrives.

## Changing the structure

The core tables are fixed and small (`clients`, `tracks`, `toc_files`, `toc_rows`, `contents`,
`content_toc_links`, `content_types`). Client-specific TOC columns are stored as JSON in
`toc_rows.data`, so a new client format needs no schema change. Just choose the columns at upload.

- **New content type** (e.g. "Mock Interview"): add a row to `content_types` in Studio.
- **New field on content**: create a migration and apply it:
  ```bash
  npx supabase migration new add_skill_to_contents
  # edit the new file in supabase/migrations/, e.g.
  #   alter table public.contents add column skill text;
  npx supabase migration up
  ```
  Keeping changes as migration files means the cloud database can be brought to the same state
  with one command later.

## Analyze content (Gemini) — local copy, since 2026-10-06

Content Analyzer's tags + skeptical quality score, per item, with the free Gemini API (key in `cloudflare/.dev.vars` as
`GEMINI_API_KEY`). Works client by client, 10 items at a time:

```bash
cd skill-assist-portal
python3 scripts/analyze/fetch_content.py              # list clients: linked / fetched / analysed
python3 scripts/analyze/fetch_content.py "Invesco"    # pull the next 10 items' files (content-cache/, not in Git)
# then localhost:5173 → More tools → Analyze content → "Analyze next 10" (or Analyze on one row)
python3 scripts/analyze/run_next.py "Invesco"          # or: fetch + analyse the next 10 one by one, retrying by itself when Gemini is busy
python3 scripts/analyze/push_results.py "Invesco"     # when the client is done: copy its results to the live site
```
Code: `cloudflare/src/analyze.js` (prompt + Gemini call), tables in `cloudflare/analysis_schema.sql`, page
`web/src/pages/Analyze.tsx`. Design, decisions and status: `docs/content-analysis.md`. Only links shared as "anyone with the link" can be fetched.

## Online (Cloudflare, free) — live since 2026-10-05

**Site:** https://skill-assist-tracker.skillassisttracker.workers.dev (Cloudflare account maryshibu204@gmail.com,
workers.dev subdomain `skillassisttracker`). Anyone with the link can view; saving needs the **team passcode**
(🔒 Passcode, top right; stored in `cloudflare/TEAM_PASSCODE.txt` and as the Worker secret `TEAM_KEY`). The online D1
database is now the **master copy**; the local Supabase database below is an old backup that no longer receives changes.

Free-plan limits (far above our use): 100,000 requests/day, D1 5 GB storage and 5 million rows read/day.

| Piece | Where |
|---|---|
| Website | `web/` (React + Vite), built to `web/dist`, served by the Worker |
| API + passcode check | `cloudflare/src/worker.js` (`POST /api/db`, `/api/check-key`) |
| Database | Cloudflare D1 `skill-assist-tracker`, tables + views in `cloudflare/schema.sql` |
| Config | `cloudflare/wrangler.jsonc` |

```bash
cd skill-assist-portal
# publish website changes
(cd web && npm run build) && (cd cloudflare && npx wrangler deploy)
# back up the online database to a file
(cd cloudflare && npx wrangler d1 export skill-assist-tracker --remote --output=../backups/d1-$(date +%F).sql)
# change the team passcode (asks for the new one)
(cd cloudflare && npx wrangler secret put TEAM_KEY)
# local testing against a local copy of D1: (cd cloudflare && npx wrangler dev) then open http://127.0.0.1:8787
#   (npm run dev in web/ also works: it forwards /api to that local Worker)
```
If wrangler asks you to log in again: `npx wrangler login --browser=false` and open the printed link in Opera.

## Data backup on GitHub (JSON) — the main backup since 2026-10-05

`backups/data/` holds the **complete live database** (Cloudflare D1) as plain JSON: one file per table
(`clients`, `tracks`, `toc_files`, `toc_rows`, `contents`, `content_toc_links`, `content_types`), **one record per
line**, plus `counts.json`. Opens in any text editor; GitHub shows exactly which records changed between backups.

```bash
cd skill-assist-portal
python3 scripts/backup_data.py          # read the live database -> backups/data/*.jsonl
git add backups/data && git commit -m "Data backup $(date +%F)" && git push
# restore (tested 2026-10-05: rebuilt copy identical to the backup)
python3 scripts/restore_data.py         # backups/data -> restore.sql (empties tables, re-inserts everything)
(cd cloudflare && npx wrangler d1 execute skill-assist-tracker --remote --file=../restore.sql)   # replaces ALL live data
# an older backup: git checkout <commit> -- backups/data   then run restore_data.py
```

## Resuming work / backups

Data lives in the local Supabase database (Docker volume) and survives restarts.

```bash
cd skill-assist-portal
npx supabase start                 # database (if not running)
cd web && npm run dev              # website → http://localhost:5173
```

A full data backup is in `backups/` (latest: `backups/data-2026-10-04-1800-final.sql`, verified by restoring into a scratch database — all counts and a checksum matched; schema in `schema-2026-10-04-1800.sql`, login users in `auth-data-2026-10-04-1800.sql`). A second copy of the whole project (without node_modules) plus the source Excel files and TOC folders is in `~/skill-assist-backups/skill-assist-tracker-2026-10-04-1800.tar.gz`. Take a new one any time with:

```bash
npx supabase db dump --local --data-only --schema public -f backups/data-$(date +%F).sql
```

To restore into an empty database (after `npx supabase db reset`, which re-applies migrations):

```bash
docker exec -i supabase_db_skill-assist-portal psql -U postgres -c "truncate public.content_types cascade"
docker exec -i supabase_db_skill-assist-portal psql -U postgres < backups/data-2026-10-04-1800-final.sql
```

### Status at 2026-10-03
20 clients · 90 tracks · 27 TOC sheets (619 topic rows) · 582 content items · 1,162 content→topic links.
2026-10-04: + IBM (all rows 2–114) → 21 clients · 97 tracks · 39 TOC sheets (854 topic rows) · 687 content items · 1,522 links.
2026-10-04: + Netcracker (all rows, 2–91) → 22 clients · 106 tracks · 45 TOC sheets (1,053 topic rows) · 767 content items · 1,855 links.
2026-10-04: + Leadyne (all rows, 2–16) → 23 clients · 109 tracks · 46 TOC sheets (1,077 topic rows) · 781 content items · 1,931 links.
2026-10-04: + Straive (all rows, 2–48) → 24 clients · 114 tracks · 51 TOC sheets (1,187 topic rows) · 824 content items · 2,010 links.
2026-10-05: + MVR rows 14–61 (online copy) → 1,085 content items.
2026-10-05: + BCT Banking rows 24–57 (online copy) → 1,119 content items.
2026-10-05: + Capgemini rows 48–63 (online copy, KARAT pre-assessments) → 1,135 content items.
2026-10-05: + Netcracker GoLang rows 93–104 (online copy) → 1,147 content items.
2026-10-05: + CIET rows 12–23 (online copy) → 1,159 content items.
2026-10-05: + Myridius rows 2–21 (online copy) → 1,179 content items.
2026-10-05: + GoDigit rows 24–25 and Sony GET 2026 row 7 (online copy) → 1,182 content items.
2026-10-05: + Randstad rows 2–3 → 1,184 content items (rows 39–68 skipped).
2026-10-05: + Wipro (all rows, 2–234) → 25 clients · 125 tracks · 56 TOC sheets (1,292 topic rows) · 1,037 content items · 2,768 links.

| Client | CSM | Notes |
|---|---|---|
| Sony | Priyanka / Lishika (GET 2026) | 5 Priyanka tracks + GET 2026 Track A milestones. GET 2026 row 7 of the **online copy**: "Task Manager UI wired to a mock REST API" (24-07-2026) = Milestone Assessment with no number (the sheet gives none), linked to React (Frontend) Essentials |
| DXC | Ankit Kansara | 15 assessments, linked to all topics of their area |
| MVR | Anubha | Rows 2–13: 12 questions, topic "Python Basics" (manual). Rows 14–61 from the **online copy** of the Details sheet (Google Sheets, 2026-10-05; `scripts/import/mvr_online.py`): 48 questions in 24 assessments, track = Assessment Name (e.g. "Python Coding Assessment - 15.09.26", "C Hybrid Assessment"), type Assessment, Date = date in the name (C Hybrid: 16-09-2026), column F block date kept as extra.sheet_date; manual topics per language (Python Basics, SQL, HTML, CSS, C; "HTML & CSS" → both) |
| CIET | Anubha | 10 questions, 3 manual topics. Rows 12–23 of the **online copy** (`scripts/import/ciet_online.py`): 12 questions, track = Hybrid Assessment Name (6 new tracks, Coding Assessment 16th Sep → 03-Oct-2026), Date = Created Date (15-09 / 22-09 / 29-09-2026); new manual topics Data Structures & Algorithms, SQL, JavaScript (Java DSA questions → DSA + Collections Framework where they use collections) |
| Myridius | Internal Request | 39 items, skill used as topic. Rows 2–21 of the **online copy** (a new block above the old rows; `scripts/import/myr_online.py`): 20 items dated 16-07-2026, same rules (track = LP Name, blank = continues the LP above; Milestone N from Course Name, else Assignment): Java Jr Developer_L1 12 Assignments, Data Engineer_L2 (new track) M1 ×3 + M2 ×3, Associate Automation Engineer_L1 M3 ×2; new skill topics Programming Fundamentals, SQL, MySQL |
| Capgemini | Internal / Muzzamil (KARAT) | tracks = TOC week headings. Rows 48–63 from the **online copy** (`scripts/import/capg_karat_pre.py`): "KARAT Java + React Curriculum" → tracks "KARAT – Program 1 — Core Engineering Foundations" and "KARAT – Program 2 — Web & Delivery Foundations" (CSM Muzzamil), 16 Pre-Assessments, 30-07-2026, skill → Course column; TOC = the 6 MCQ topic areas of PreProgram_Readiness_Assessment_KARAT_Updated.docx (Downloads/Muzzamil Capgemini Karat) + manual "React": Java → Core Java + DSA (Singleton also Low-Level Design), SQL, GIT → Git & Agile, JS → JavaScript/Web/API, React → React |
| Invesco | Ayman | tracks = TOC week headings |
| Wisseninfotech | Vemula Meghana | 2 items, topics from the sheet's Learning Topics |
| Mphasis | Internal | tracks = skills; assessments stored as Milestone Assessment |
| LTM | Priyanka / Lishika (Cloud) | OS – Linux, Windows & SAP (6 daily + Day 7 milestone); Data Foundations, Snowflake, BI Engineering, Data Bricks (6 daily + Week 1 milestone linked to all 6 topics); Cloud: 6 incident questions as Milestone Assessment, 09-09-2026, manual topics. Rows 46–50 (track status table) skipped |
| CTRLS | Priyanka | Oracle track: 2 Milestone Assessments (milestone 2), 15-06-2026, manual topics |
| TCS ION | Priyanka | DMW Syllabus: Days 1–3 daily + Milestone 1 (linked to TOC weeks 1–5), 22-06-2026; TOC typed in from a screenshot |
| EY GDS | Muzzamil | AI & Data (rows 1–22, Weeks 1–2: 13 daily + Milestones 1–2; first loaded as week-heading tracks, merged into one track "AI & Data" on 2026-10-03, week names kept on each TOC topic as "Focus of the week" and on each item (extra.week → extra Week column on the home page); TOC = Daily Topic + Coverage; that TOC file was later removed from the folder but its rows stay in the DB). AI & Azure (rows 58–105, 29-09-2026): ShopEase = Pre-Assessment, practice questions = Daily Assignment linked to topics since the previous question, Milestones 1–7; TOC = 40-Day Planner (Module / Topic + Detailed Coverage); Wk column kept as "Week N" on topics and items (home-page Week column). Rows 23–49 have no content |
| Godrej | Priyanka | React with .NET (4) + Django with PostgreSQL (2), all Milestone Assessment, day blank, 13-05-2026; manual topics with skill as Module |
| Virtusa | Priyanka | SQL track: 3 Daily Assignments (Days 1–3 in row order), 30-04-2026; manual topics |
| Acuity | Ayman | 4 tracks (Backend, Frontend, Data Engineering, QA with GenAI): 7 Milestone Assessments M1–M4, 31-03-2026; TOC = 17-Day Training Plan (Topics + Subtopics); M3 linked to DE days 9–11 only |
| GoDigit | Ayman | Python Programming & Git (6 daily + M1) and Python for Analytics & SQL (14 daily + M2); sheet's Focus / Topics column = TOC; days numbered in row order; date = column E (06-04-2026) when present, else 09-03-2026. Rows 24–25 of the **online copy** (`scripts/import/godigit_sony_online.py`): track "Data Analytics with AI" (22-04-2026): Day 1 SQL Server assignment + Milestone 3, both linked to the new topic "SQL Server" |
| BCT Banking | Ayman | Pre-Learning (Phase 1: 4 items, all Milestone Assessment, day blank, 25-02-2026); Phase – 3 & 4 – FSE (26-02-2026) and Phase – 3 (22-05-2026): 7 daily + M1/M2 each; sheet's Module + Topic = TOC. Rows 24–57 from the **online copy** (`scripts/import/bct_track3.py`): track "TRACK 3: FULL STACK DEVELOPMENT" (sheet Module; its Track column "Phase – 3" kept as extra.phase): 30 Daily Assignments 1–30 (31-07-2026), each linked to its Topic keyword; Milestones 1–4 (13-08-2026): Python M1/M3 → AsyncIO, FastAPI, OpenAPI, Security; Java M2/M4 → the 12 Java/Spring topics |
| Randstad | Aarti | rows 9–36 only: Modules 1–4 as tracks (Module 1: ReactJs, 2: NextJs, 3: React Native, 4: React Navigation & State; Assignment → Daily, Assessment → Milestone); AI-Augmented Systems Engineer (1 milestone, 23-04-2026); Individual Assessments (7 Assessments, 02-09-2026, participant name on each item → Participant column on the home page). Rows 2–3 (`scripts/import/randstad_rows2_3.py`): two ReactJs assignments → Module 1: ReactJs Day 4–5 (20-02-2026), each linked to its own row (subtopic). Rows 39–68 ("PL3 HandsOn and Capstones" Level-3 badge status table, no content names) skipped by the user |
| IBM | — (rows 2–7) / Ayman (rest) | Rows 2–7: tracks SQL (3), Python (2), Java (1) = skill column; 6 Milestone Assessments, day and date blank; no TOC → one hand-written topic per item, skill as Module. Rows 9–21: track Big Data IBM PJT (15-06-2026): Days 1–9 Daily Assignment, Milestone 1 → TOC days 1–3, Milestone 2 → days 4–9, Capstone → days 10–11; TOC typed in from a screenshot (Day / Module / Topics / Subtopics / Course, 11 days). Rows 23–114 (`scripts/import/ibm.py`): tracks = **Phase 1 / Phase 2 / Phase 3 only** (user, 2026-10-04); the sheet's Course column is shown as-is in a home-page Course column (extra.course) and the LP Name is kept in extra.lp (not shown); everything except milestones and capstones → Daily Assignment (incl. rows the sheet marks Assessment), Milestone N → Milestone Assessment N, Capstone Project → Capstone; no day numbers. Dates 25-06 (Phase 1), 21-07 (Phase 2), 11-08 (RDBMS, .Net), 31-08 (capstone-only LPs), 23-09-2026 (Curriculum Open Source). TOC: Phases 1–2 = `IBM/TOC- IBM PJP …` (course level); Phase 3 = `IBM/Phase-3_TOC.xlsx`, one topic per course with modules in data (the .Net sheet also repeats the DevOps/Data Engineer LPs; only its .Net block is used). Item → its course; milestone → courses since the previous milestone; capstone → all courses of the LP. Curriculum Open Source has no TOC → manual topic. .Net rows 83 and 90 are the same item (stored once). Phase 2 Developer rows 46–53 look shifted by one course (see open questions) |
| Straive | Priyanka / Ayman (Pre-Assessment, Common Track) | Rows 2–14 (`scripts/import/straive.py`): tracks = column A (Snowflake Basic, Snowflake Intermediate), 23-01-2026; Assignment → Daily Assignment (linked to the TOC topic named in column B), Milestone 1 → Milestone Assessment 1 (linked to every topic of the Milestone 1 block); column B → Course column. TOCs typed in from 2 screenshots (one topic per bullet, with Competency, Course, Milestone block); the Intermediate screenshot starts at Milestone 2, so its Milestone 1 topic "Advanced SQL & Query Optimization" comes from the Details sheet. Rows 16–18 (same script): track "Pre-Assessment" (CSM Ayman, 19-08-2026), 3 Pre-Assessments (Git, Python, SQL; skill → Course column), each linked to every topic of its skill area in `Straive_MT_2026_PreAssessment_Topics.xlsx` (45 topics; file since removed from the folder, rows kept in the DB). Rows 21–48 ("Actual"): tracks "Common Track Day 1-16" and "Engineering Track Day 17-24" (CSM Ayman; dates per merged block 20-08 → 18-09-2026); TOC = `Straive/Straive_MT_Program_2026_Rev8_TOC.xlsx` (one topic per day = Session Title, full row in data). Day N → Daily Assignment N linked to TOC Day N; Milestone 1/2 → Days 1–8 / 9–12; "Day 21 Milestone 3" → Days 17–21; Common Capstone 1/2 (Technical / Business lens) → Days 15–16 (Common Capstone Bridge); Engineering "Day 22–24 Capstone 1–3" → own day; capstones show "Capstone N" in the Course column. Common Track was first linked to the pre-assessment file by mistake (wrong TOC pasted) and relinked on 2026-10-04. Straive complete (35 items) |
| Leadyne | Divyabharthi | Rows 2–11 (`scripts/import/leadyne.py`): tracks = column A Module (Engineering & Programming Foundations; Test Automation, CI/CD & AI-Driven QE), 30-01-2026; Assignment → Daily Assignment (linked to its TOC topic), Milestone 1 → Milestone Assessment 1, Incremental Project → **Capstone** with home-page **Project** column (extra.project = "Incremental Project 1" / "4", numbered as in the TOC); milestone and project link to every topic of their module. TOC typed in from 2 screenshots. Rows 13–16 (same script): track "Junit" (18-02-2026): "After <topic>" assignments → Daily Assignment linked to the TOC topics since the previous assignment up to that topic; Module end assessment → Milestone Assessment 1; Incremental Project 6 → Capstone + Project column; JUnit TOC (3rd screenshot) uses its Coverage Intent rows as topics. Leadyne complete (14 items) |
| Netcracker | Divyabharthi / Aditya (Demo) / Aarti / Priyanka (Demo - FSD, React) | Rows 2–9 (`scripts/import/netcracker.py`): tracks = column A (UI, BackEnd & FrontEnd), 30-01-2026; everything except Milestone 1 → Daily Assignment; Course Name → Course column. TOC typed in from two screenshots (Intern – Batch 2 = UI, For BE = BackEnd & FrontEnd), one topic per comma item; items named after a topic link to it, Java items to all Java topics, Milestone 1 to all courses above it. Rows 11–22 (`scripts/import/netcracker_levels.py`): demo content → track "Demo - Java" (CSM Aditya, 16-02-2026), 12 Daily Assignments; column C (L2–L5) → home-page Proficiency column, extra.demo = true; no TOC → one manual topic per item. Rows 24–61 (same script, not demo — user confirmed): tracks PostgreSQL, PLSQL (16-03-2026) and C++ (17-03-2026), CSM Aarti, 12 Daily Assignments each (L2–L5 × 3), manual topics. Rows 64–66 (`scripts/import/netcracker_final.py`): Final Assessment of "Netcracker Modular Learning 20 Feb 2026" → track "Final - Java" (CSM Aarti, 18-03-2026), 3 Milestone Assessments (no number), each linked to all 13 topics of the TOC typed in from a screenshot (Skill / Knowledge item / Course; cut-off last row not loaded). Rows 69–74 (`scripts/import/netcracker_fsd.py`): "Netcracker Demo August" → track "Demo - FSD" (CSM Priyanka, 03-08-2026, demo): 4 SQL Daily Assignments (modules 1–4) + Milestone Assessment 1 (all SQL topics) + Full Stack Capstone (module 19); TOC from screenshot, one topic per comma item. Rows 77–91 (`scripts/import/netcracker_react.py`): "Netcracker React" → track "React" (CSM Priyanka, 19-08-2026): 11 module Daily Assignments, Milestones 1–3 (modules since the previous milestone), Module 12 → Capstone; Module Title → Course column; TOC from the "React Comprehensive Learning Journey" screenshot, one topic per ";" item. Rows 93–104 of the **online copy** (`scripts/import/netcracker_golang.py`): "Technology skill map" → track "GoLang" (CSM Aarti, not demo; column A kept as extra.group), 12 Daily Assignments L2–L5 (28-09-2026 ×4, 01-10-2026 ×8), level → Proficiency, manual topic per item (Module GoLang). The local file is empty after row 91 — Netcracker complete (80 items; the Summary sheet's 58 predates the demo/React rows) |
| Amdocs | Muzzamil / Aarti | Java + SQL (Muzzamil, 13-02-2026): 6 Milestone Assessments, day blank, Course Name as topic. Java Fundamentals (Aarti, 09-03-2026): 13 daily + M1/M2, sheet's topic column = TOC |
| Wipro | Soma | All rows 2–234 (`scripts/import/wipro.py`): 11 tracks named as column A (3 Selenium with Python tracks — 9th January, batch 2 3rd Feb, April — kept separate). Day wise assignments → Daily Assignment (Day = sheet's day range); Milestone N → Milestone Assessment N; every Final (Final / Final Milestone / Final Assessment) → **Capstone**. Actual and Re-attempt are separate items; home-page **Assessment** column (extra.assessment) = Actual / Re-attempt / Final – Actual / Final – Re-attempt. Rows 62–67 (name NA) skipped. TOCs in `../Wipro/` (next to the tracker folder): Selenium with Python, Java Selenium SDET (also SDET Final Assessment + NGA SDET 23rd April), NGA JFS Angular (3rd Feb + both April Angular tracks), SQL PL/SQL Phase 1, Java J2EE. Daily → its day's topic(s); milestone → topics since the previous milestone; final → topics since the last milestone, whole TOC for SDET Final Assessment and SQL PLSQL. April NGA Java Angular / NGA JFS Angular link by content (M1 days 1–16, M2 days 25–31, Final microservices days 18–23). NGA_JFS Day 23 Kafka item → TOC Day 22 Kafka. Java J2EE: sheet's topic labels = TOC topics; the Day column shows that label as written (e.g. "OOPS / Inheritance", "Spring Boot (On Day 27)") — user, 2026-10-05; TOC topics carry the planner's Day Wise Planner days, own 1–25 numbering kept as Topic number |

Not yet loaded (left for later by the user, 2026-10-05): LTM_2 (sheet is in `~/Downloads/Details_SkillAssist 16.xlsx` and the online copy) and NTTDATA Pooja (online copy only).
