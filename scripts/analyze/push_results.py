# Push one client's analysis results from the local copy to the LIVE database (2026-10-06).
# Copies only content_analysis rows (the fetched text stays local). Asks before writing; checks first that every item
# still exists online with the same name, so a result never lands on the wrong item.
#   python3 scripts/analyze/push_results.py "Invesco"          (from skill-assist-portal/; needs `npx wrangler login`)
#   python3 scripts/analyze/push_results.py "Invesco" --yes    (no question)
import argparse, json, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
COLS = ['content_id', 'quality_band', 'confidence', 'low_confidence', 'result', 'model', 'prompt_version', 'text_hash', 'analyzed_at']


def d1(where, sql=None, file=None):
    args = ['npx', 'wrangler', 'd1', 'execute', 'skill-assist-tracker', f'--{where}', '--json']
    args += ['--command', sql] if sql else [f'--file={file}']
    res = subprocess.run(args, cwd=ROOT / 'cloudflare', capture_output=True, text=True)
    if res.returncode:
        sys.exit(f'wrangler failed:\n{res.stderr[-2000:]}')
    return json.loads(res.stdout)[0].get('results', []) if sql else None


def lit(v):
    if v is None: return 'null'
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"


ap = argparse.ArgumentParser()
ap.add_argument('client')
ap.add_argument('--yes', action='store_true')
a = ap.parse_args()

rows = d1('local', f"""select a.*, c.name item_name from content_analysis a join contents c on c.id = a.content_id
                       join clients cl on cl.id = c.client_id where lower(cl.name) = lower({lit(a.client)}) order by a.content_id""")
if not rows:
    sys.exit(f'No analysis results for "{a.client}" in the local copy.')
total = d1('local', f"""select count(*) n from contents c join clients cl on cl.id = c.client_id
                        where lower(cl.name) = lower({lit(a.client)})""")[0]['n']

d1('remote', file='analysis_schema.sql')  # creates the tables online the first time; no-op after that
ids = ','.join(str(r['content_id']) for r in rows)
online = {r['id']: r['name'] for r in d1('remote', f'select id, name from contents where id in ({ids})')}
bad = [r for r in rows if online.get(r['content_id']) != r['item_name']]
if bad:
    for r in bad:
        print(f"  {r['content_id']}: local \"{r['item_name']}\" / online \"{online.get(r['content_id'], '(missing)')}\"")
    sys.exit(f'{len(bad)} item(s) differ between the local copy and the live database: nothing pushed.')

bands = {}
for r in rows:
    bands[r['quality_band']] = bands.get(r['quality_band'], 0) + 1
print(f"{a.client}: {len(rows)} of {total} items analysed ({', '.join(f'{n} {b}' for b, n in sorted(bands.items()))}).")
if not a.yes and input('Push these results to the LIVE site? Type yes: ').strip().lower() != 'yes':
    sys.exit('Nothing pushed.')

sql = [f"insert into content_analysis ({', '.join(COLS)}) values ({', '.join(lit(r[c]) for c in COLS)}) "
       f"on conflict (content_id) do update set {', '.join(f'{c} = excluded.{c}' for c in COLS[1:])};" for r in rows]
out = ROOT / 'content-cache' / 'last_push.sql'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text('\n'.join(sql), encoding='utf-8')
d1('remote', file=str(out))
print(f'Pushed {len(rows)} result(s) for {a.client} to the live site.')
