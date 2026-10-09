# Fetch + analyse a client's next N items ONE AT A TIME, retrying by itself when Gemini is busy (2026-10-07).
# Needs the local Worker running (cd cloudflare && npx wrangler dev) - it holds the Gemini key.
#   python3 scripts/analyze/run_next.py "Invesco"            next 10 items
#   python3 scripts/analyze/run_next.py "Invesco" --count 3
# Order per item: an item already fetched but not analysed comes first, else fetch_content.py --batch 1 pulls a new one.
# Busy (503) / no reply: waits 30 s, 1, 2, 5, 5, 5 min, then skips the item (it is picked again next run).
# Per-minute limit: waits 1 min. Daily limit or Worker not running: stops. Run from skill-assist-portal/.
import argparse, json, pathlib, subprocess, sys, time, urllib.error, urllib.request

from fetch_content import ROOT, d1, lit

API = 'http://127.0.0.1:8787/api/analyze'
WAITS = [30, 60, 120, 300, 300, 300]


def team_key():
    for line in (ROOT / 'cloudflare' / '.dev.vars').read_text().splitlines():
        if line.startswith('TEAM_KEY'):
            return line.split('=', 1)[1].strip().strip('"\'')
    sys.exit('TEAM_KEY not found in cloudflare/.dev.vars')


def next_fetched(client_id, skipped):
    """An item with fetched text but no analysis yet (not one skipped in this run)."""
    rows = d1(f"""select c.id, c.name from contents c join content_text t on t.content_id = c.id
                  left join content_analysis a on a.content_id = c.id
                  where c.client_id = {client_id} and t.error is null and t.text is not null and a.content_id is null
                  {'and c.id not in (' + ','.join(map(str, skipped)) + ')' if skipped else ''}
                  order by c.id limit 1""")
    return rows[0] if rows else None


def unfetched(client_id):
    return d1(f"""select count(*) n from contents c left join content_text t on t.content_id = c.id
                  where c.client_id = {client_id} and json_extract(c.extra, '$.links.doc') is not null
                  and t.content_id is null""")[0]['n']


def saved(content_id):
    rows = d1(f'select quality_band, confidence, model from content_analysis where content_id = {content_id}')
    return rows[0] if rows else None


def call(content_id, key):
    """(status, body dict). status 0 = no reply (timeout / connection problem)."""
    req = urllib.request.Request(API, data=json.dumps({'content_id': content_id}).encode(), method='POST',
                                 headers={'content-type': 'application/json', 'x-team-key': key})
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except ValueError:
            return e.code, {}
    except urllib.error.URLError as e:
        if isinstance(e.reason, ConnectionRefusedError):
            sys.exit('The local Worker is not running: cd cloudflare && npx wrangler dev')
        return 0, {'error': str(e.reason)}
    except (TimeoutError, OSError) as e:
        return 0, {'error': str(e)}


def analyse(item, key):
    """True = analysed, False = gave up on it for now. Exits on the daily limit."""
    waits = list(WAITS)
    while True:
        t0 = time.time()
        status, body = call(item['id'], key)
        took = f'{time.time() - t0:.0f} s'
        if status == 200:
            print(f"    ✓ {body.get('quality_band')} / {body.get('confidence')}  ({body.get('model')}, {took})", flush=True)
            return True
        # The Worker sometimes saves the result although the reply never arrives here.
        if (s := saved(item['id'])):
            print(f"    ✓ {s['quality_band']} / {s['confidence']}  ({s['model']}, saved, {took})", flush=True)
            return True
        code = body.get('code') or ('no_reply' if status == 0 else f'http_{status}')
        if code == 'limit_day':
            sys.exit(f"    ✗ Gemini's daily free limit is used up - stopping. Run again tomorrow.")
        if code in ('passcode', 'no_key', 'no_item'):
            sys.exit(f"    ✗ {code}: {body.get('error')}")
        wait = 60 if code in ('limit_minute', 'limit') else (waits.pop(0) if waits else None)
        if wait is None:
            print(f'    ✗ still failing ({code}) - skipped; it will be picked again next run', flush=True)
            return False
        print(f'    … {code} after {took} - waiting {wait} s and trying again', flush=True)
        time.sleep(wait)


def main():
    ap = argparse.ArgumentParser(description='Fetch + analyse the next items one by one, retrying when Gemini is busy.')
    ap.add_argument('client')
    ap.add_argument('--count', type=int, default=10, help='how many items (default 10)')
    a = ap.parse_args()
    found = d1(f"select id, name from clients where lower(name) = lower({lit(a.client)})")
    if not found:
        sys.exit(f'No client named "{a.client}".')
    client_id, client = found[0]['id'], found[0]['name']
    key, done, skipped = team_key(), 0, []

    for n in range(1, a.count + 1):
        item = next_fetched(client_id, skipped)
        for _ in range(5):  # a fetch can fail (link not shared publicly) - then try the next unfetched item
            if item or not unfetched(client_id):
                break
            subprocess.run([sys.executable, str(pathlib.Path(__file__).with_name('fetch_content.py')), client, '--batch', '1'],
                           cwd=ROOT)
            item = next_fetched(client_id, skipped)
        if not item:
            print(f'{client}: nothing left to analyse.')
            break
        print(f"[{n}/{a.count}] {item['id']}  {item['name']}", flush=True)
        if analyse(item, key):
            done += 1
        else:
            skipped.append(item['id'])

    print(f'\n{client}: {done} analysed' + (f", skipped {', '.join(map(str, skipped))}" if skipped else '') + '.')


if __name__ == '__main__':
    main()
