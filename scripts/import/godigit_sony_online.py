# Online copy of Details_SkillAssist.xlsx (Google Sheets, 2026-10-05): rows not in the local file.
# GoDigit rows 24-25 (same rules as godigit.py): CSM Ayman, track = Skill "Data Analytics with AI", the Focus / Topics
# column is the TOC (row 24 "SQL Server" added to the GoDigit topic sheet), assignment -> Daily Assignment 1 linked to its
# topic, "Milestone 3" -> Milestone Assessment 3 linked to all topics of the track; 22-04-2026 (first row only).
# Sony GET 2026 row 7 (user, 2026-10-05): "Task Manager UI wired to a mock REST API", 24-07-2026, Milestone Assessment
# with no number (the sheet gives none), linked to the "React (Frontend) Essentials" module (TOC row 14).
import json
SRC = 'Details_SkillAssist.xlsx (online copy, Google Sheets)'
q = lambda o: '$j$' + json.dumps(o, ensure_ascii=False) + '$j$'
t = lambda s: 'null' if s is None else '$n$' + s + '$n$'
GD, GTR, GFN, GSH = 'GoDigit', 'Data Analytics with AI', 'Details_SkillAssist.xlsx', 'GoDigit'
SY, STR, SFN, SSH = 'Sony', 'GET 2026 · Java FSD (Track A)', 'Sony_GET_FY2026_Plan_v5.xlsx', 'Track A — Java FSD'

def item(client, track, fn, sh, typ, seq, name, date, row, sheet, hit):
    ex = {'source': {'file': SRC, 'sheet': sheet, 'row': row}}
    return f"""with ctx as (select c.id cid, tr.id tid, f.id fid from clients c join tracks tr on tr.client_id=c.id and tr.name={t(track)} join toc_files f on f.client_id=c.id and f.file_name={t(fn)} and f.sheet_name={t(sh)} where c.name={t(client)}),
ins as (insert into contents(client_id,track_id,content_type,sequence_label,name,delivery_date,extra)
 select cid,tid,{t(typ)},{t(seq)},{t(name)},'{date}',{q(ex)}::jsonb from ctx
 on conflict (client_id,track_id,content_type,sequence_label,name) do update set delivery_date=excluded.delivery_date, extra=excluded.extra returning id)
insert into content_toc_links(content_id,toc_row_id)
select ins.id,r.id from ins cross join ctx join toc_rows r on r.toc_file_id=ctx.fid and r.row_number = any(array{hit}::int[]) on conflict do nothing;"""

out = ['begin;',
       f"insert into tracks(client_id,name,csm) select id,{t(GTR)},'Ayman' from clients where name={t(GD)} on conflict (client_id,name) do update set csm=excluded.csm;",
       f"""insert into toc_rows(toc_file_id,row_number,day_label,topic,data)
select f.id,24,null,'SQL Server',{q({'Skill': GTR, 'Focus / Topics': 'SQL Server'})}::jsonb from toc_files f join clients c on c.id=f.client_id and c.name={t(GD)}
where f.file_name={t(GFN)} and f.sheet_name={t(GSH)} on conflict (toc_file_id,row_number) do update set topic=excluded.topic, data=excluded.data;""",
       item(GD, GTR, GFN, GSH, 'Daily Assignment', '1', 'SQL - Extract a specific set of characters from tracking IDs for a security check',
            '2026-04-22', 24, 'GoDigit', [24]),
       item(GD, GTR, GFN, GSH, 'Milestone Assessment', '3',
            "SQL - Display all network towers and any associated maintenance records from 'Towers' and 'MaintenanceLogs' including towers without maintenance records",
            '2026-04-22', 25, 'GoDigit', [24]),
       item(SY, STR, SFN, SSH, 'Milestone Assessment', None, 'Task Manager UI wired to a mock REST API', '2026-07-24', 7, 'Sony GET 2026', [14]),
       'commit;']
print('\n'.join(out))
