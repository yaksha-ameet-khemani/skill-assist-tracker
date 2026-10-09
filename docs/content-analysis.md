# Content analysis (Gemini) — design, decisions, status

Started 2026-10-06. Brings the ideas of the separate **Content Analyzer** project
(`~/Downloads/IntelliJ Projects/Content Analyzer/`) into the tracker: Gemini reads each item's actual files, tags it and
gives it a skeptical quality score. How to run it: README → "Analyze content (Gemini)".

## Why (comparison of the two projects, 2026-10-06)

| | Content Analyzer | Skill Assist Tracker |
|---|---|---|
| Reads | the content files themselves | tracker sheet + TOC sheets (names, topics, Doc links) |
| Size | 2 clients, 69 items (Invesco 24 scored, LTM 45 not scored) | 25 clients, 1,184 items |
| Matching | planned "decompose TOC → LLM judges" (never built) | Find similar: word matching on topics (live) |
| Quality score | yes (LLM, skeptical rubric) | none, until this feature |
| Runs | local Java + Ollama llama3.1:8b, CPU only: 1–3 min/item, OOM on 16 GB | online, Cloudflare free |
| Status | paused 2026-08-13 (Phases 0–2 done) | live, used by the team |

Decision: do **not** port the Java/Ollama app. Reuse its prompts (`docs/prompts/extract_metadata.md` +
`quality_assess.md`, merged into one call), its asset fields, its skeptical 5-part rubric, its "two scores, never
blended" rule (Find similar = coverage, analysis = quality) and its lessons (retry bad answers, reject empty scores,
save each item as soon as it is done, safe to re-run).

## The user's plan (agreed 2026-10-06)

1. A script pulls content into a local temp folder, client by client, in small batches.
2. The user runs the engine by hand from localhost:5173, whenever they have time (day or night).
3. Results stay on the local copy; when a client is finished, its results are pushed to the live site.
4. **Go one item at a time** (fetch 1, analyse 1, check), not 8–10 at once. User's words: "do it 1 by 1 only".

## How it works

- **Fetching** (`scripts/analyze/fetch_content.py`): no Google login needed for links shared as "anyone with the link".
  - Google Doc / Sheet / Slides → `export?format=txt|csv`.
  - Drive file → `drive.usercontent.google.com/download?id=…&export=download&confirm=t` (the `confirm=t` is needed:
    for code files such as `.py` Drive otherwise returns a "virus scan warning" page instead of the file — this made
    item 313 score Poor at first because its solution was missing).
  - Drive folder → `drive.google.com/embeddedfolderview?id=…` lists the files (sub-folders 2 levels deep).
  - Text from md/txt/code files, .docx/.pptx (zip XML), .pdf (pdftotext), .ipynb. Roles from file names
    (problem / template / solution / other). Combined text capped at 80 KB per item (D1 statement limit).
  - Files saved in `content-cache/<client>/<id>/` (gitignored); text into the LOCAL table `content_text`.
  - Link counts on 2026-10-06: 431 folders, 250 Docs, 108 Drive files, 395 items with no link.
- **Analysing** (`cloudflare/src/analyze.js`, `POST /api/analyze {content_id, model?, save?}`): one Gemini call with
  structured JSON output; up to 3 tries; an answer without a quality score counts as a failure. Needs the team passcode
  and `GEMINI_API_KEY` in `cloudflare/.dev.vars`, so it only works on the local Worker. `model` + `save:false` run a
  test without storing it (used to compare models).
- **Models:** main `gemini-flash-latest` (was gemini-3.8-flash on 2026-10-06; `gemini-2.5-flash` is closed to new
  users). On 503 "high demand": waits 5 s and 15 s, then falls back to `gemini-3.6-flash` (env `GEMINI_FALLBACK`).
  Since 2026-10-07 also falls back on a 429 *daily* limit (free daily limits are per model).
- **Batch runner** (`scripts/analyze/run_next.py "<Client>" [--count 10]`, 2026-10-07): the user's "go ahead, next 10".
  Items already fetched but not analysed first, else `fetch_content.py --batch 1`; strictly one at a time. Busy / no
  reply: waits 30 s, 1, 2, 5, 5, 5 min, then skips the item; per-minute limit: waits 1 min; daily limit on all
  models: stops. If the HTTP reply never arrives it checks the DB (the Worker sometimes saves anyway).
- **Page** `web/src/pages/Analyze.tsx` (More tools → Analyze content): per client, fetched/analysed status, Analyze per
  row, "Analyze next N", Stop, details (sub-scores, flags, summary, tags, model, date), "changed" badge when the
  content changed after scoring.
- **Push** (`scripts/analyze/push_results.py "<Client>"`): copies only that client's `content_analysis` rows to the live
  D1 (creates the tables the first time), checks every item id still has the same name online, asks "yes" first.
- Tables in `cloudflare/analysis_schema.sql`; no foreign keys, so `restore_data.py` emptying `contents` can't wipe them.

## Free Gemini limits (as explained to the user)

- The free tier allows a fixed number of requests per minute and per day per model; exact numbers in AI Studio →
  Dashboard → Rate limits. Hitting OUR limit gives **429**.
- **503** = Google's servers busy for all free users (free users are turned away first). Not our limit; going 1 at a
  time doesn't prevent it. Usually clears in minutes to an hour.
- Free tier may use submitted content to improve Google products (see open questions).

## Model comparison on item 313 (FundFlow Transaction Validator), 2026-10-06

| | gemini-flash-latest (3.8) | gemini-flash-lite-latest |
|---|---|---|
| Overall | Excellent, High confidence | Excellent, High confidence |
| Sub-scores | all Excellent | all Excellent except difficulty_alignment Good |
| Tags | python, fill-in-template, has template + solution | same |
| Level | Intermediate | Basic |
| Skills | more specific | more generic |

Suggestion given: Flash as main, Lite as automatic backup when Flash is overloaded (each score records its model, so
Lite ones can be re-run later). **Waiting for the user's decision** — not implemented yet (current fallback is 3.6-flash).
Caveat: one easy "Excellent" item doesn't test skepticism much; compare on a weaker item too.

## Status (end of 2026-10-06)

- Invesco: items 312–322 fetched (11 of 18 linked; 7 still to fetch). Each had 3 files after the confirm=t fix.
- Analysed: **313 → Excellent / High** (gemini-3.8-flash). **322 (FundFlow Dashboard Component) fetched, analysis
  failed** (503 overload on both models) — retry it next.
- Nothing pushed to the live site. Nothing committed to Git (the feature is uncommitted in the working tree).
- Page not yet checked in a real browser.
- 2026-10-07: retried 322 twice — 503 on both models (~64 s), then 429 (free limit). A tiny test call answered fine,
  so big prompts are turned away first. Added the **error pop-up** on the Analyze page: the API now returns a reason
  `code` (overloaded, limit_minute/limit_day/limit, bad_answer, gemini_error, not_fetched, fetch_failed, passcode,
  no_key, no_item; page adds no_server) plus `detail` (models tried with status, Google's message, quota id,
  retry delay); the pop-up shows title / why / what to do / technical details. Not yet seen in a real browser.

## Status 2026-10-07

- Analysed (local only, all **Excellent / High**): 312, 313, 314, 322, 323, 324 (323/324/312/314 by fallback
  gemini-3.6-flash). Still to analyse: **315** (stopped on daily limit) and **325** (503). 4 Invesco items still to fetch.
- Gemini was very slow today: one call took 40 s to 10 min; 503s on both models; then the daily limit on BOTH
  flash-latest and 3.6-flash (flash-lite still had quota; not used — waiting for the user, question 1).
- **Offline Ollama test** (item 314, llama3.1:8b, same prompt, not saved; one-off script, not kept): 191 s vs Gemini
  19 s, laptop CPU fully loaded, ~5–6 GB RAM. Same overall band, but generic/odd sub-score notes (difficulty "Fair"
  because "JSON may be hard for beginners") and a wrong tag (urllib.parse). **User decided: Gemini only.**
- Explained to the user: "local" here only means the sender script; the analysis runs on Google's servers, so the free
  limits apply. Options: wait for the daily reset, Lite, or billing on the key (a few cents for all items).

## Status 2026-10-09

- **Invesco finished locally**: all 18 linked items (312–329) fetched and analysed. 17 Excellent / High;
  **327 (Adding Security to the FundFlow Pipeline) → Good / High**. Run took 12:42–12:56 IST, no daily-limit stop.
  Not pushed yet — user to review scores, then `push_results.py Invesco`.
- **DXC** (8 linked) chosen next. 186 (DotNet - Order Processing Engine, 9 files) fetched; analysis got 503 three
  times, then the daily limit on both Flash models (~14:05 IST). 7 DXC items still to fetch.
- Next: after 12:30 PM IST, start the Worker if down, then `python3 scripts/analyze/run_next.py DXC`.
- Linked items per client (local DB): Wipro 136, Mphasis 92, IBM 90, Netcracker 65, MVR 58, Capgemini 53,
  Myridius 44, EY GDS 34, Straive 31, BCT Banking 24, Randstad 22, Amdocs 21, CIET 20, Sony 20, GoDigit 18,
  Invesco 18 (done), DXC 8, Acuity 7, LTM 7, Godrej 6, Leadyne 6, TCS ION 4, Virtusa 3, CTRLS 2, Wisseninfotech 2.

## Open questions for the user

1. Flash main + Lite fallback? (see above)
2. Is it OK that the free Gemini tier may use the content (incl. solutions) to improve Google products?
3. Pushed grades/flags become visible to anyone with the live link (site is public-readable) — OK?
4. The Gemini key was pasted in chat on 2026-10-06; suggested deleting it in AI Studio and creating a new one.
5. Possible prompt tweak: "no solution file" currently pulls solution_correctness to Poor; maybe report a missing
   solution separately from quality.

## Next steps

1. When the user says "go ahead": start the Worker if needed, then `python3 scripts/analyze/run_next.py Invesco` in
   the background (picks up 315, 325, then fetches the remaining 4).
2. User checks the scores against their own judgement; then push Invesco (`push_results.py Invesco`).
3. After the first push: add `content_analysis` to `scripts/backup_data.py` / `restore_data.py`; later show the
   quality band on the home page and next to Find similar results (coverage + quality side by side).
4. Commit + deploy only when the user says it's final (local-first workflow).
