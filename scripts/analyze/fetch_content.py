# Pull the problem statement / template / solution text behind each item's Doc link, 10 items at a time (2026-10-06).
# Files go to content-cache/<client>/<item id>/ (not in Git); the combined text goes into the LOCAL database
# (table content_text), where the Analyze page (localhost:5173 → More tools → Analyze content) can score it.
#   python3 scripts/analyze/fetch_content.py                     list clients: items with a link / fetched / analyzed
#   python3 scripts/analyze/fetch_content.py "Invesco"           fetch the next 10 not-yet-fetched items of a client
#   python3 scripts/analyze/fetch_content.py "Invesco" --batch 20
#   python3 scripts/analyze/fetch_content.py "Invesco" --retry   also try again the items that failed before
# Works only for links shared as "anyone with the link" (no Google login). Run from skill-assist-portal/.
import argparse, hashlib, html, io, json, pathlib, re, subprocess, sys, time, urllib.parse, urllib.request, zipfile
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
CACHE = ROOT / 'content-cache'
MAX_FILE = 40_000   # characters kept per file
MAX_TEXT = 80_000   # bytes kept per item (one D1 statement must stay under 100 KB)
TEXT_EXT = {'md', 'txt', 'py', 'js', 'jsx', 'ts', 'tsx', 'java', 'sql', 'json', 'html', 'htm', 'css', 'scss', 'cs', 'cpp',
            'cc', 'c', 'h', 'hpp', 'go', 'rb', 'php', 'kt', 'scala', 'r', 'sh', 'bash', 'ps1', 'yaml', 'yml', 'xml', 'csv',
            'properties', 'gradle', 'dart', 'swift', 'rs', 'vue', 'tf', 'hcl', 'ini', 'cfg', 'toml', 'feature', 'dockerfile'}
ROLES = [('solution', r'solution|answer|_key\b|reference'), ('template', r'template|starter|skeleton|boilerplate'),
         ('problem', r'problem|statement|question|participant|paper|task|assignment|assessment|readme')]
ROLE_ORDER = {'problem': 0, 'template': 1, 'other': 2, 'solution': 3}


def d1(sql=None, file=None):
    args = ['npx', 'wrangler', 'd1', 'execute', 'skill-assist-tracker', '--local', '--json']
    args += ['--command', sql] if sql else [f'--file={file}']
    res = subprocess.run(args, cwd=ROOT / 'cloudflare', capture_output=True, text=True)
    if res.returncode:
        sys.exit(f'wrangler failed:\n{res.stderr[-2000:]}')
    return json.loads(res.stdout)[0].get('results', []) if sql else None


def lit(v):
    return 'null' if v is None else "'" + str(v).replace('\x00', '').replace("'", "''") + "'"


def get(url):
    """(bytes, file name or None, content type); raises on HTTP errors."""
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (skill-assist-tracker content fetch)'})
    with urllib.request.urlopen(req, timeout=60) as r:
        cd = r.headers.get('content-disposition') or ''
        m = re.search(r"filename\*=UTF-8''([^;]+)", cd) or re.search(r'filename="([^"]+)"', cd)
        name = urllib.parse.unquote(m.group(1)) if m else None
        return r.read(), name, r.headers.get('content-type') or ''


def role_of(name):
    low = name.lower()
    return next((role for role, pat in ROLES if re.search(pat, low)), 'other')


def to_text(name, data):
    """Readable text of one downloaded file, or None when it is not a text-like file."""
    ext = name.rsplit('.', 1)[-1].lower() if '.' in name else ''
    if ext == 'docx' or ext == 'pptx':
        z = zipfile.ZipFile(io.BytesIO(data))
        parts = sorted(n for n in z.namelist() if re.match(r'word/document\.xml|ppt/slides/slide\d+\.xml', n))
        out = []
        for p in parts:
            xml = z.read(p).decode('utf-8', 'replace')
            xml = re.sub(r'</w:p>|</a:p>', '\n', xml).replace('<w:tab/>', '\t')
            out.append(html.unescape(re.sub(r'<[^>]+>', '', xml)))
        return '\n'.join(out)
    if ext == 'pdf':
        res = subprocess.run(['pdftotext', '-layout', '-', '-'], input=data, capture_output=True)
        return res.stdout.decode('utf-8', 'replace') if res.returncode == 0 else None
    if ext == 'ipynb':
        nb = json.loads(data)
        return '\n\n'.join(''.join(c.get('source', '')) for c in nb.get('cells', []))
    if ext in TEXT_EXT or name.lower() == 'dockerfile':
        return data.decode('utf-8', 'replace')
    return None


def fetch_doc(kind, doc_id):
    """A Google Docs / Sheets / Slides document, exported as text."""
    url = {'document': f'https://docs.google.com/document/d/{doc_id}/export?format=txt',
           'spreadsheets': f'https://docs.google.com/spreadsheets/d/{doc_id}/export?format=csv',
           'presentation': f'https://docs.google.com/presentation/d/{doc_id}/export/txt'}[kind]
    data, name, ctype = get(url)
    if 'text/html' in ctype:
        raise ValueError('not shared publicly (Google asked to sign in)')
    ext = 'csv' if kind == 'spreadsheets' else 'txt'
    name = re.sub(r'\.(docx?|xlsx?|pptx?)$', '', name or doc_id) + '.' + ext if name else f'{doc_id}.{ext}'
    return name, data


def fetch_file(file_id):
    # confirm=t skips Drive's "virus scan warning" page, which it shows for code files such as .py instead of the file.
    data, name, ctype = get(f'https://drive.usercontent.google.com/download?id={file_id}&export=download&confirm=t')
    if 'text/html' in ctype and not name:
        raise ValueError('not shared publicly, or too big to download without a login')
    return name or file_id, data


def list_folder(folder_id):
    """[(name, href)] of a public Drive folder, from Google's embeddable folder view (no login or API key)."""
    data, _, _ = get(f'https://drive.google.com/embeddedfolderview?id={folder_id}')
    page = data.decode('utf-8', 'replace')
    entries = re.findall(r'<a href="([^"]+)"[^>]*>.*?flip-entry-title">([^<]+)<', page, re.S)
    if not entries and 'flip-entries' not in page:
        raise ValueError('folder not shared publicly')
    return [(html.unescape(n), html.unescape(h)) for h, n in entries]


def fetch_link(url, folder, depth=0):
    """Downloads everything behind one link into folder; returns [(name, role, text or None, note or None)]."""
    m = re.search(r'docs\.google\.com/(document|spreadsheets|presentation)/d/([\w-]+)', url)
    if m:
        files = [fetch_doc(m.group(1), m.group(2))]
    elif m := re.search(r'drive\.google\.com/(?:file/d/|open\?id=|uc\?(?:export=download&)?id=)([\w-]+)', url):
        files = [fetch_file(m.group(1))]
    elif m := re.search(r'drive\.google\.com/drive/(?:u/\d+/)?folders/([\w-]+)', url):
        out = []
        for name, href in list_folder(m.group(1)):
            time.sleep(0.5)
            if '/folders/' in href:
                if depth < 2:
                    out += fetch_link(href, folder / safe(name), depth + 1)
                continue
            try:
                out += fetch_link(href, folder, depth)
            except Exception as e:  # one unreadable file does not stop the rest of the folder
                out.append((name, role_of(name), None, f'{e}'))
        return out
    else:
        raise ValueError(f'not a Google Drive / Docs link: {url}')
    out = []
    for name, data in files:
        folder.mkdir(parents=True, exist_ok=True)
        (folder / safe(name)).write_bytes(data)
        try:
            text = to_text(name, data)
        except Exception as e:
            out.append((name, role_of(name), None, f'could not read: {e}'))
            continue
        out.append((name, role_of(name), text, None if text is not None else 'not a text file, skipped'))
    return out


def safe(name):
    return re.sub(r'[\\/:*?"<>|\x00-\x1f]', '_', name).strip() or 'file'


def combine(files, kind):
    """One text with a header per readable file: problem statement first, solution last."""
    readable = sorted((f for f in files if f[2] and f[2].strip()), key=lambda f: (ROLE_ORDER[f[1]], f[0].lower()))
    if kind == 'doc' and len(readable) == 1:  # a single Doc is the problem statement (it may hold the solution too)
        readable = [(readable[0][0], 'problem', readable[0][2], None)]
    parts, total = [], 0
    for name, role, text, _ in readable:
        text = text.replace('\r\n', '\n').strip()
        if len(text) > MAX_FILE:
            text = text[:MAX_FILE] + '\n[... cut here, file is longer ...]'
        part = f'=== {name} ({role}) ===\n{text}\n'
        size = len(part.encode('utf-8'))
        if total + size > MAX_TEXT:
            part = part.encode('utf-8')[:max(0, MAX_TEXT - total)].decode('utf-8', 'ignore') + '\n[... cut here ...]\n'
            parts.append(part)
            break
        parts.append(part)
        total += size
    return '\n'.join(parts)


def list_clients():
    rows = d1("""select cl.name, count(*) items,
                 sum(json_extract(c.extra, '$.links.doc') is not null) linked,
                 sum(t.content_id is not null and t.error is null) fetched, sum(t.error is not null) failed,
                 sum(a.content_id is not null) analyzed
                 from contents c join clients cl on cl.id = c.client_id
                 left join content_text t on t.content_id = c.id left join content_analysis a on a.content_id = c.id
                 group by cl.name order by lower(cl.name)""")
    print(f"{'Client':28} {'items':>5} {'linked':>6} {'fetched':>7} {'failed':>6} {'analyzed':>8}")
    for r in rows:
        print(f"{r['name'][:28]:28} {r['items']:>5} {r['linked']:>6} {r['fetched']:>7} {r['failed']:>6} {r['analyzed']:>8}")
    print('\nFetch the next 10 of a client:  python3 scripts/analyze/fetch_content.py "<Client>"')


def main():
    ap = argparse.ArgumentParser(description='Pull the content behind Doc links into the local database.')
    ap.add_argument('client', nargs='?', help='client name; leave out to list clients')
    ap.add_argument('--batch', type=int, default=10, help='how many items to fetch (default 10)')
    ap.add_argument('--retry', action='store_true', help='also retry items that failed before')
    a = ap.parse_args()
    if not a.client:
        return list_clients()
    client, batch = a.client, a.batch
    found = d1(f"select id, name from clients where lower(name) = lower({lit(client)})")
    if not found:
        sys.exit(f'No client named "{client}". Run without arguments to see the list.')
    client_id, client = found[0]['id'], found[0]['name']
    skip = 't.content_id is null' + (' or t.error is not null' if a.retry else '')
    items = d1(f"""select c.id, c.name, json_extract(c.extra, '$.links.doc') doc, json_extract(c.extra, '$.links.doc_kind') kind,
                   json_extract(c.extra, '$.links.solution') solution
                   from contents c left join tracks tr on tr.id = c.track_id left join content_text t on t.content_id = c.id
                   where c.client_id = {client_id} and json_extract(c.extra, '$.links.doc') is not null and ({skip})
                   order by lower(tr.name), c.id limit {batch}""")
    if not items:
        return print(f'{client}: nothing left to fetch (items without a Doc link are skipped).')

    now = datetime.now(timezone.utc).isoformat(timespec='seconds')
    sql, ok = [], 0
    for it in items:
        folder = CACHE / safe(client) / str(it['id'])
        files, error = [], None
        try:
            files = fetch_link(it['doc'], folder)
            if it['solution'] and it['solution'] != it['doc']:
                files += [(n, 'solution' if r == 'other' else r, t, e) for n, r, t, e in fetch_link(it['solution'], folder / 'solution')]
        except Exception as e:
            error = str(e)
        text = combine(files, it['kind']) if files else ''
        if not error and not text:
            error = 'no readable file behind the link: ' + (', '.join(f'{n} ({e})' for n, _, _, e in files) or 'empty folder')
        if text:
            (folder / 'content.txt').write_text(text, encoding='utf-8')
        meta = [{'name': n, 'role': r, 'chars': len(t or ''), **({'note': e} if e else {})} for n, r, t, e in files]
        digest = hashlib.sha256(text.encode('utf-8')).hexdigest()[:16] if text else None
        sql.append(f"""insert into content_text (content_id, files, text, text_hash, error, fetched_at)
            values ({it['id']}, {lit(json.dumps(meta, ensure_ascii=False))}, {lit(text)}, {lit(digest)}, {lit(error)}, {lit(now)})
            on conflict (content_id) do update set files = excluded.files, text = excluded.text,
            text_hash = excluded.text_hash, error = excluded.error, fetched_at = excluded.fetched_at;""")
        ok += not error
        status = f'✓ {len([m for m in meta if m["chars"]])} file(s), {len(text):,} chars' if not error else f'✗ {error}'
        print(f"  {it['id']:>5}  {it['name'][:60]:60}  {status}", flush=True)
        time.sleep(1)

    out = CACHE / safe(client) / 'last_fetch.sql'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text('\n'.join(sql), encoding='utf-8')
    d1(file=str(out))
    left = d1(f"""select count(*) n from contents c left join content_text t on t.content_id = c.id
                  where c.client_id = {client_id} and json_extract(c.extra, '$.links.doc') is not null and t.content_id is null""")[0]['n']
    print(f'\n{client}: {ok} of {len(items)} fetched into the local database. {left} linked item(s) still to fetch.')


if __name__ == '__main__':
    main()
