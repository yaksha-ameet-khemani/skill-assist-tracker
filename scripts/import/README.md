One-off import scripts used to load each client from `Details_SkillAssist.xlsx` and its TOC.
Each prints a match preview to stderr and writes SQL; the SQL was run with
`docker exec -i supabase_db_skill-assist-portal psql -U postgres -v ON_ERROR_STOP=1 < file.sql`.
Re-running is safe (upserts), but later manual fixes (CSM names, track renames, DXC re-linking,
Mphasis type change) were applied directly in the database — the backup in ../../backups is the source of truth.

- load_track.py + fse_arch.json / full_stack.json / sre.json — Sony tracks (Data Architect was loaded the same way)
- get.py — Sony GET 2026 Track A milestones
- dxc.py, myr.py, capg.py, inv.py, mph.py — DXC, Myridius, Capgemini, Invesco, Mphasis
- ctrls.py — CTRLS (Oracle track)
- tcs_ion.py — TCS ION DMW (TOC typed in from screenshot)
- ey.py — EY GDS rows 1–22 (its TOC file has since been removed, so it can't be re-run; DB backup has the data)
- ey_ai_azure.py — EY GDS rows 58–105, AI & Azure 40-day plan
- godrej.py — Godrej
- virtusa.py — Virtusa
- acuity.py — Acuity (TOC in ../../../Acuity/)
- godigit.py — GoDigit
- bct.py — BCT Banking
- randstad.py — Randstad rows 9–36
- amdocs.py — Amdocs
- sync_doc_links.py — Doc / Solution links from TestCase-Count-ALL.xlsx (tab SkillAssist_AI-Usecases) into contents.extra.links; re-runnable
- randstad_rows2_3.py — Randstad rows 2–3 (rows 39–68 skipped)
- godigit_sony_online.py — GoDigit rows 24–25 + Sony GET 2026 row 7 from the online copy
- myr_online.py — Myridius rows 2–21 (16-07-2026 block) from the online copy
- rename_dated_tracks.py — one-off: CIET/MVR dated track names → "… - DD Mon YYYY" + tracks.extra.date
- ciet_online.py — CIET Anu rows 12–23 from the online copy
- netcracker_golang.py — Netcracker GoLang rows 93–104 from the online copy
- capg_karat_pre.py — Capgemini rows 48–63 (KARAT pre-assessments) from the online copy; TOC read from the readiness .docx
- bct_track3.py — BCT Banking rows 24–57 (TRACK 3) from the online copy, data typed into the script
- mvr_online.py — MVR rows 14–61 from the online (Google Sheets) copy, data typed into the script
- wipro.py — whole WIPRO sheet (TOCs in ../../../../Wipro/)
- ltm.py — whole LTM sheet (OS track, 4 Week 1 tracks, Cloud questions)
