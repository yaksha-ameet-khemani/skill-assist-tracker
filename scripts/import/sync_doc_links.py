# Doc links from TestCase-Count-ALL.xlsx (download of the "TestCase-Count-ALL" Google Sheet, user, 2026-10-05), tab
# SkillAssist_AI-Usecases only, columns Doc link, Proficiency, Test Link, Tested, Remarks, Solution (user's choice).
# Re-runnable: download the sheet again to the tracker folder and run this script; it rewrites contents.extra.links.
#
# Matching a tracker item to a sheet row (Question Text), names compared lower-case with only letters/digits kept:
#   1. full name = full name ("Java - Camel Case" = "Java-Camel Case"), also via the item's extra.assessment_name;
#   2. only when ONE side has no technology prefix: the other side's name without its prefix ("Digit Analyzer" =
#      "Java - Digit Analyzer"), only for specific names (at least 20 letters/digits). Two different prefixes never match
#      ("Python - X" is not "Java - X").
# An item whose matches point to different Doc links is reported and left without a link (ambiguous).
# Stored per item: extra.links = {doc, doc_kind, solution, test_link, proficiency, tested, remarks, source}.
# Links added in the portal ("+ Link", extra.links.manual = true) are kept as they are.
import openpyxl, re, json, sys, subprocess, warnings
from collections import defaultdict
warnings.filterwarnings('ignore')
BASE = '/home/administrator/Downloads/IntelliJ Projects/Skill Assist Tracker/'
FILE, TAB = 'TestCase-Count-ALL.xlsx', 'SkillAssist_AI-Usecases'
PSQL = ['docker', 'exec', 'supabase_db_skill-assist-portal', 'psql', '-U', 'postgres']
PFX = re.compile(r'^(java|python|sql|js|javascript|react|reactjs|angular|html|css|c|c\+\+|go|junit|selenium|pytest|flask|'
                 r'spring ?boot|spring data|spring test|rest assured|numpy pandas|typescript|git|servlet|jsp|hibernate|spring aop|'
                 r'spring mvc|plsql|pl/sql|postgresql|oracle|bdd cucumber|python selenium|java selenium|vm)\s*[-:–—]\s*')
alnum = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())

def keys(name):
    """(full key, stripped key or None if the name has no prefix)"""
    n = name.strip().lower()
    s = PFX.sub('', n)
    return alnum(n), (alnum(s) if s != n else None)

def link(cell):
    if cell.hyperlink and cell.hyperlink.target: return cell.hyperlink.target.strip()
    v = cell.value
    if isinstance(v, str):
        m = re.search(r'HYPERLINK\("([^"]+)"', v) or re.search(r'https?://\S+', v)
        if m: return m.group(1) if m.lastindex else m.group(0)
    return None

def kind(url):
    if '/drive/folders/' in url: return 'folder'
    if 'docs.google.com/document' in url: return 'doc'
    if 'docs.google.com/spreadsheets' in url: return 'sheet'
    if 'docs.google.com/presentation' in url: return 'slides'
    return 'file'

ws = openpyxl.load_workbook(BASE + FILE)[TAB]
hdr = [str(c.value).strip() if c.value else '' for c in ws[1]]
col = {h: i + 1 for i, h in enumerate(hdr)}
for h in ('Question Text', 'Doc link', 'Proficiency', 'Test Link', 'Tested', 'Remarks', 'Solution'):
    assert h in col, (h, hdr)
txt = lambda r, h: (str(ws.cell(r, col[h]).value).strip() if ws.cell(r, col[h]).value not in (None, '') else None)
full_idx, strip_idx = defaultdict(list), defaultdict(list)
rows = {}
for r in range(2, ws.max_row + 1):
    q = txt(r, 'Question Text')
    doc = link(ws.cell(r, col['Doc link']))
    if not q or not doc: continue
    rec = {'doc': doc, 'doc_kind': kind(doc), 'solution': link(ws.cell(r, col['Solution'])), 'test_link': link(ws.cell(r, col['Test Link'])),
           'proficiency': txt(r, 'Proficiency'), 'tested': txt(r, 'Tested'), 'remarks': txt(r, 'Remarks'),
           'source': {'file': FILE, 'sheet': TAB, 'row': r, 'question': q}}
    rows[r] = {k: v for k, v in rec.items() if v}
    f, s = keys(q)
    full_idx[f].append(r)
    if s: strip_idx[s].append(r)
print(len(rows), 'sheet rows with a Doc link', file=sys.stderr)

items = subprocess.run(PSQL + ['-AtF', '\t', '-c',
    "select c.id, cl.name, c.name, coalesce(c.extra->>'assessment_name','') from contents c join clients cl on cl.id=c.client_id"],
    capture_output=True, text=True, check=True).stdout.splitlines()
found, ambiguous, by_client, total = {}, [], defaultdict(int), defaultdict(int)
for line in items:
    cid, client, name, an = line.split('\t')
    total[client] += 1
    hits = set()
    for nm in filter(None, (name, an)):
        f, s = keys(nm)
        hits.update(full_idx.get(f, []))
        # prefix-only matches need a specific name (>= 20 letters/digits): "Exception Handling" alone is too generic
        if s is None and len(f) >= 20: hits.update(strip_idx.get(f, []))  # our name has no prefix: vs sheet names minus prefix
        elif s and len(s) >= 20: hits.update(full_idx.get(s, []))          # our name has a prefix: its rest vs un-prefixed sheet names
    docs = {rows[r]['doc'] for r in hits}
    if len(docs) == 1:
        found[int(cid)] = rows[min(hits)]; by_client[client] += 1
    elif len(docs) > 1:
        ambiguous.append((client, name, sorted(hits)))
print(f'{len(found)} of {len(items)} items get a Doc link; {len(ambiguous)} ambiguous (left without):', file=sys.stderr)
for a in ambiguous: print('   AMBIGUOUS', a, file=sys.stderr)
print('   ' + ' ; '.join(f'{c} {by_client[c]}/{total[c]}' for c in sorted(total, key=str.lower)), file=sys.stderr)

q = lambda o: '$j$' + json.dumps(o, ensure_ascii=False) + '$j$'
# Links pasted in the portal (extra.links.manual = true) are the team's own: never removed or overwritten here.
KEEP = "coalesce(extra->'links'->>'manual', '') <> 'true'"
out = ['begin;', f"update contents set extra = extra - 'links' where extra ? 'links' and {KEEP};"]
out += [f"update contents set extra = extra || jsonb_build_object('links', {q(v)}::jsonb) where id={k} and {KEEP};" for k, v in found.items()]
out.append('commit;')
print('\n'.join(out))
