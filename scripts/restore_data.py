# Rebuild the database from the JSON backup in backups/data/ (made by scripts/backup_data.py), 2026-10-05.
# Writes restore.sql: empties every table, then inserts all records with their original ids. Load it with
#   (cd cloudflare && npx wrangler d1 execute skill-assist-tracker --local  --file=../restore.sql)   # test copy
#   (cd cloudflare && npx wrangler d1 execute skill-assist-tracker --remote --file=../restore.sql)   # LIVE: replaces all data
# The tables must exist (cloudflare/schema.sql). To restore an older backup: git checkout <commit> -- backups/data
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'backups' / 'data'
ORDER = ['content_types', 'clients', 'tracks', 'toc_files', 'toc_rows', 'contents', 'content_toc_links']
JSON_COLS = {'extra', 'data', 'columns'}

def lit(v, col):
    if v is None: return 'null'
    if col in JSON_COLS and not isinstance(v, str): v = json.dumps(v, ensure_ascii=False, separators=(',', ':'))
    if isinstance(v, bool): return '1' if v else '0'
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"

out = [f'delete from {t};' for t in reversed(ORDER)]  # children first
counts = {}
for t in ORDER:
    rows = [json.loads(l) for l in (SRC / f'{t}.jsonl').read_text(encoding='utf-8').splitlines() if l.strip()]
    counts[t] = len(rows)
    if not rows: continue
    cols = list(rows[0].keys())
    head = f"insert into {t} ({', '.join(cols)}) values "
    batch, size = [], 0
    for r in rows:
        v = '(' + ', '.join(lit(r.get(c), c) for c in cols) + ')'
        if batch and size + len(v) > 40_000:  # stay under D1's statement size limit
            out.append(head + ',\n'.join(batch) + ';'); batch, size = [], 0
        batch.append(v); size += len(v)
    out.append(head + ',\n'.join(batch) + ';')
(ROOT / 'restore.sql').write_text('\n'.join(out) + '\n', encoding='utf-8')
print('restore.sql written:', counts)
