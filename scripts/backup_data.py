# Full data backup of the live Cloudflare D1 database as plain JSON (2026-10-05).
# Writes backups/data/<table>.jsonl: one record per line, sorted by key, columns in table order, JSON columns
# (extra, data, columns) as real JSON. Commit + push the folder: Git then keeps every backup and shows exactly which
# records changed. Restore with scripts/restore_data.py.
#   python3 scripts/backup_data.py            (from skill-assist-portal/; needs `npx wrangler login`)
#   python3 scripts/backup_data.py --local    (back up the local test copy instead)
import json, subprocess, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'backups' / 'data'
WHERE = '--local' if '--local' in sys.argv else '--remote'
# Same order as restore needs (parents first); key columns used for sorting.
TABLES = [
    ('content_types', 'name'), ('clients', 'id'), ('tracks', 'id'), ('toc_files', 'id'),
    ('toc_rows', 'id'), ('contents', 'id'), ('content_toc_links', 'content_id, toc_row_id'),
]
JSON_COLS = {'extra', 'data', 'columns'}

def query(sql):
    res = subprocess.run(['npx', 'wrangler', 'd1', 'execute', 'skill-assist-tracker', WHERE, '--json', '--command', sql],
                         cwd=ROOT / 'cloudflare', capture_output=True, text=True)
    if res.returncode:
        sys.exit(f'wrangler failed:\n{res.stderr[-2000:]}')
    return json.loads(res.stdout)[0]['results']

OUT.mkdir(parents=True, exist_ok=True)
summary = {}
for table, key in TABLES:
    rows = []
    for offset in range(0, 10**9, 2000):  # page through big tables
        page = query(f'select * from {table} order by {key} limit 2000 offset {offset}')
        rows += page
        if len(page) < 2000: break
    with open(OUT / f'{table}.jsonl', 'w', encoding='utf-8') as f:
        for r in rows:
            for c in JSON_COLS & r.keys():
                if isinstance(r[c], str):
                    try: r[c] = json.loads(r[c])
                    except ValueError: pass
            f.write(json.dumps(r, ensure_ascii=False, separators=(', ', ': ')) + '\n')
    summary[table] = len(rows)
(OUT / 'counts.json').write_text(json.dumps(summary, indent=2) + '\n')
print(f'Backed up {WHERE[2:]} D1 to {OUT.relative_to(ROOT)}:', summary)
