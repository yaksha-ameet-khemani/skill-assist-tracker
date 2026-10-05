# Copies all tracker data from the local Supabase/Postgres database into data.sql for Cloudflare D1 (2026-10-05).
# Run: python3 export_to_d1.py  -> data.sql (INSERTs, ids kept, JSON columns as text, statements kept under D1's limit).
import json, subprocess, sys
PSQL = ['docker', 'exec', 'supabase_db_skill-assist-portal', 'psql', '-U', 'postgres', '-At', '-c']
TABLES = [  # order respects foreign keys
    ('content_types', ['name', 'sort_order']),
    ('clients', ['id', 'name', 'notes', 'extra', 'created_at']),
    ('tracks', ['id', 'client_id', 'name', 'notes', 'extra', 'created_at', 'csm']),
    ('toc_files', ['id', 'client_id', 'track_id', 'file_name', 'sheet_name', 'header_row', 'columns', 'day_column', 'topic_column',
                   'source_link', 'notes', 'extra', 'created_at']),
    ('toc_rows', ['id', 'toc_file_id', 'row_number', 'day_label', 'topic', 'data']),
    ('contents', ['id', 'client_id', 'track_id', 'content_type', 'sequence_label', 'name', 'delivery_date', 'notes', 'extra',
                  'created_at', 'updated_at']),
    ('content_toc_links', ['content_id', 'toc_row_id', 'created_at']),
]
JSON_COLS = {'extra', 'data', 'columns'}

def lit(v, col):
    if v is None: return 'null'
    if col in JSON_COLS: v = json.dumps(v, ensure_ascii=False, separators=(',', ':'))
    if isinstance(v, bool): return '1' if v else '0'
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"

out, counts = [], {}
for table, cols in TABLES:
    sel = ', '.join(f"to_char({c} at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as {c}" if c in ('created_at', 'updated_at')
                    else (f"to_char({c}, 'YYYY-MM-DD') as {c}" if c == 'delivery_date' else c) for c in cols)
    raw = subprocess.run(PSQL + [f"select coalesce(json_agg(t order by 1), '[]') from (select {sel} from {table}) t"],
                         capture_output=True, text=True, check=True).stdout
    rows = json.loads(raw)
    counts[table] = len(rows)
    head = f"insert into {table} ({', '.join(cols)}) values "
    batch, size = [], 0
    for r in rows:
        v = '(' + ', '.join(lit(r[c], c) for c in cols) + ')'
        if batch and size + len(v) > 40_000:
            out.append(head + ',\n'.join(batch) + ';')
            batch, size = [], 0
        batch.append(v)
        size += len(v)
    if batch: out.append(head + ',\n'.join(batch) + ';')
open('data.sql', 'w').write('\n'.join(out) + '\n')
print(counts, f'{len(out)} statements, {sum(map(len, out)) // 1024} KB', file=sys.stderr)
