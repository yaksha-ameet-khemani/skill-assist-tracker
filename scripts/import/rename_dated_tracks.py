# One-off (user, 2026-10-05): CIET and MVR track names carried their assessment date in mixed formats ("2nd Sep",
# "23-Sep-2026", "15.09.26"), so they sorted out of order. Rename them to one style "<name> - DD Mon YYYY" and store the
# date as tracks.extra.date, which the portal uses to order tracks (see migration 20261005000000_track_date.sql).
import re, datetime, json, subprocess
MON = {m: i for i, m in enumerate(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'], 1)}
rows = subprocess.run(['docker', 'exec', 'supabase_db_skill-assist-portal', 'psql', '-U', 'postgres', '-AtF', '\t', '-c',
                       "select t.id, cl.name, t.name from tracks t join clients cl on cl.id=t.client_id where cl.name in ('CIET','MVR')"],
                      capture_output=True, text=True, check=True).stdout.splitlines()
out = ['begin;']
for line in rows:
    tid, client, name = line.split('\t')
    m = (re.fullmatch(r'(Coding Assessment) (\d{1,2})(?:st|nd|rd|th) (\w{3})', name)  # CIET "Coding Assessment 2nd Sep"
         or re.fullmatch(r'(Coding Assessment) (\d{2})-(\w{3})-2026', name)          # CIET "Coding Assessment 23-Sep-2026"
         or re.fullmatch(r'(\w+ Coding Assessment) - (\d{2})\.(\d{2})\.26', name)    # MVR "Python Coding Assessment - 15.09.26"
         or re.fullmatch(r'(Coding Assessment) - (\d{2}) (\w{3}) 2026', name))       # already renamed (re-run)
    if not m: print('-- kept:', client, name); continue
    base, day, mon = m[1], int(m[2]), m[3]
    month = int(mon) if mon.isdigit() else MON[mon.lower()]
    d = datetime.date(2026, month, day)
    new = f"{base} - {d.strftime('%d %b %Y')}"
    print(f'-- {client}: {name} -> {new}')
    out.append(f"update tracks set name=$n${new}$n$, extra = extra || '{json.dumps({'date': d.isoformat()})}'::jsonb where id={tid};")
out.append('commit;')
print('\n'.join(out))
