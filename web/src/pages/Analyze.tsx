import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Message, useLookups } from '../components/common'
import { getTeamKey } from '../lib/db'
import { fetchAll, must, supabase, type ContentRow } from '../lib/supabase'
import { abc, links } from './Tracker'

/**
 * Analyze content (2026-10-06): Content Analyzer's tags + skeptical quality score for tracker items, one Gemini call
 * per item (cloudflare/src/analyze.js). The text comes from scripts/analyze/fetch_content.py; analysing runs on the
 * local copy only, and a finished client is pushed to the live site with scripts/analyze/push_results.py.
 */

type Fetched = { content_id: number; files: { name: string; role: string; chars: number; note?: string }[]; error: string | null; text_hash: string | null }
type Sub = { band: string; note: string }
type Result = {
  title: string
  primary_technology: string
  secondary_technologies: string[]
  topic: string
  subtopics: string[]
  proficiency: string
  learning_objectives: string[]
  skills_tested: string[]
  submission_mode: string
  case_study_coupling: string
  rubric_present: boolean
  has_template: boolean
  has_solution: boolean
  max_points: number | null
  estimated_minutes: number | null
  low_confidence: boolean
  quality: { overall_band: string; confidence: string; sub_scores: Record<string, Sub>; flags: string[]; summary: string }
}
type Analysis = { content_id: number; quality_band: string; confidence: string; low_confidence: number; result: Result; model: string; text_hash: string | null; analyzed_at: string }
type Item = Pick<ContentRow, 'id' | 'track_name' | 'content_type' | 'sequence_label' | 'name' | 'extra'>

const SUB_LABEL: Record<string, string> = {
  rubric_coherence: 'Rubric',
  solution_correctness: 'Solution correct',
  difficulty_alignment: 'Difficulty fits level',
  completeness: 'Completeness',
  clarity: 'Clarity',
}

/** An /api/analyze failure: reason code + details from cloudflare/src/analyze.js, shown in <ErrorPopup>. */
type Detail = {
  http_status?: number
  google_message?: string | null
  tried?: { model: string; status: number }[]
  quota?: string | null
  retry_after?: string | null
  fetch_error?: string
  last_problem?: string
  model?: string
}
class AnalyzeError extends Error {
  code: string
  status: number | null
  detail: Detail | null
  constructor(message: string, code: string, status: number | null, detail: Detail | null) {
    super(message)
    this.code = code
    this.status = status
    this.detail = detail
  }
}
type Failure = { item: string; error: AnalyzeError; done: number; total: number }

async function analyzeOne(id: number): Promise<Analysis> {
  let res: Response
  try {
    res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-team-key': getTeamKey() },
      body: JSON.stringify({ content_id: id }),
    })
  } catch (e) {
    throw new AnalyzeError((e as Error).message, 'no_server', null, null)
  }
  const body = await res.json().catch(() => ({ error: `Server error (${res.status})`, code: 'server_error' }))
  if (!res.ok) throw new AnalyzeError(body.error ?? `Server error (${res.status})`, body.code ?? 'server_error', res.status, body.detail ?? null)
  return body as Analysis
}

/** Plain-words title / reason / what to do for each reason code. */
function explain(e: AnalyzeError): { title: string; why: string; todo: string } {
  switch (e.code) {
    case 'overloaded':
      return {
        title: "Google's Gemini servers are busy (503)",
        why: 'Google turned the request away because too many people are using Gemini right now; free users are turned away first. This is not our limit and nothing is wrong with the item. Big items fail sooner than small ones.',
        todo: 'Wait a few minutes (or try later in the day) and press Analyze on this item again.',
      }
    case 'limit_minute':
      return {
        title: 'Free per-minute limit used up (429)',
        why: 'The free Gemini key allows only a few requests per minute. Retries after a busy (503) answer also count.',
        todo: 'Wait about one minute, then press Analyze again.',
      }
    case 'limit_day':
      return {
        title: 'Free daily limit used up (429)',
        why: 'The free Gemini key has a daily request limit and it is used up for today.',
        todo: 'Try again tomorrow (the limit resets around midnight Pacific time, about 1:30 pm India time).',
      }
    case 'limit':
      return {
        title: 'Free Gemini limit used up (429)',
        why: 'Google did not say whether the per-minute or the daily limit ran out.',
        todo: 'Wait one minute and try again. If it still fails, the daily limit is used up, so try tomorrow.',
      }
    case 'bad_answer':
      return {
        title: 'Gemini answered, but the answer was unusable',
        why: 'Gemini replied 3 times, but each reply had no quality score or was not valid JSON. Usually the item is very large or unusual.',
        todo: 'Try once more. If it keeps failing, note the item; it may need a look at its files.',
      }
    case 'gemini_error':
      return {
        title: 'Gemini returned an error',
        why: "Google refused the request for a reason other than being busy or over the limit (see Google's message below; e.g. bad key or request too big).",
        todo: "Read Google's message below. A key problem means the key in cloudflare/.dev.vars needs replacing.",
      }
    case 'not_fetched':
      return {
        title: "This item's files are not fetched yet",
        why: "Analysis reads the item's files from the local cache, and this item has none yet.",
        todo: 'Run: python3 scripts/analyze/fetch_content.py "<Client>" --batch 1 — then reload this page.',
      }
    case 'fetch_failed':
      return {
        title: "This item's files could not be fetched",
        why: 'The fetch script could not download the linked files (often the link is not shared as "anyone with the link").',
        todo: 'Check the item\'s Doc/Solution link and its sharing setting, then fetch again.',
      }
    case 'no_item':
      return {
        title: 'Item not found in this database',
        why: 'The item was probably deleted or the database was restored since the page loaded.',
        todo: 'Reload the page and pick the client again.',
      }
    case 'passcode':
      return {
        title: 'Team passcode missing or wrong',
        why: 'Analysing saves results, so it needs the team passcode.',
        todo: 'Click 🔒 at the top right, enter the passcode, then try again.',
      }
    case 'no_key':
      return {
        title: 'Analysis is not available here',
        why: 'There is no Gemini key on this server; analysis runs on the local copy only.',
        todo: 'Use the local copy (localhost) with the Worker started from the cloudflare folder.',
      }
    case 'no_server':
      return {
        title: 'Cannot reach the local server',
        why: 'The page could not talk to the local Worker at all; it is probably not running.',
        todo: 'Start it: cd cloudflare && npx wrangler dev — then try again.',
      }
    default:
      return {
        title: 'Something went wrong on the server',
        why: 'An unexpected error happened (see the message below).',
        todo: 'Try again; if it repeats, share the details below.',
      }
  }
}

function ErrorPopup({ failure, onClose }: { failure: Failure; onClose: () => void }) {
  const { error: e, item, done, total } = failure
  const { title, why, todo } = explain(e)
  const d = e.detail
  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel card stack error-popup" role="alertdialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
        <header className="form-row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>⚠ {title}</h2>
          <button className="small" onClick={onClose} autoFocus>
            Close
          </button>
        </header>
        <p>
          <b>Item:</b> {item}
          {total > 1 && <span className="muted"> — stopped the run here ({done} of {total} done before it)</span>}
        </p>
        <p>
          <b>Why:</b> {why}
        </p>
        <p>
          <b>What to do:</b> {todo}
        </p>
        <details open={e.code === 'gemini_error' || e.code === 'server_error'}>
          <summary>Technical details</summary>
          <dl className="error-details">
            <dt>Reason code</dt>
            <dd>{e.code}</dd>
            {e.status != null && (
              <>
                <dt>Server reply</dt>
                <dd>HTTP {e.status}</dd>
              </>
            )}
            <dt>Message</dt>
            <dd>{e.message}</dd>
            {d?.tried?.length ? (
              <>
                <dt>Gemini attempts</dt>
                <dd>{d.tried.map((t, i) => <div key={i}>{i + 1}. {t.model} → {t.status}</div>)}</dd>
              </>
            ) : null}
            {d?.quota && (
              <>
                <dt>Quota hit</dt>
                <dd>{d.quota}</dd>
              </>
            )}
            {d?.retry_after && (
              <>
                <dt>Google says retry after</dt>
                <dd>{d.retry_after}</dd>
              </>
            )}
            {d?.google_message && (
              <>
                <dt>Google's message</dt>
                <dd>{d.google_message}</dd>
              </>
            )}
            {d?.fetch_error && (
              <>
                <dt>Fetch error</dt>
                <dd>{d.fetch_error}</dd>
              </>
            )}
            {d?.last_problem && (
              <>
                <dt>Last problem</dt>
                <dd>{d.last_problem}{d.model ? ` (${d.model})` : ''}</dd>
              </>
            )}
            <dt>Time</dt>
            <dd>{new Date().toLocaleString()}</dd>
          </dl>
        </details>
      </div>
    </div>
  )
}

const Band = ({ band }: { band?: string }) => (band ? <span className={`qband q-${band.toLowerCase()}`}>{band}</span> : null)

export function Analyze() {
  const { clients } = useLookups()
  const [clientId, setClientId] = useState<number | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [texts, setTexts] = useState<Map<number, Fetched>>(new Map())
  const [results, setResults] = useState<Map<number, Analysis>>(new Map())
  const [available, setAvailable] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const [failure, setFailure] = useState<Failure | null>(null)
  const [busy, setBusy] = useState<number | null>(null) // item being analysed
  const [runLeft, setRunLeft] = useState(0) // items left in an "Analyze next N" run
  const [howMany, setHowMany] = useState(10)
  const [open, setOpen] = useState<number | null>(null)
  const stop = useRef(false)

  useEffect(() => {
    fetch('/api/analyze')
      .then((r) => r.json())
      .then((b) => setAvailable(!!b.available))
      .catch(() => setAvailable(false))
  }, [])

  const load = useCallback(async (cid: number) => {
    setError('')
    try {
      const rows = await fetchAll<Item>(() =>
        supabase.from('v_contents').select('id,track_name,content_type,sequence_label,name,extra').eq('client_id', cid).order('id'),
      )
      rows.sort((a, b) => abc(a.track_name ?? '', b.track_name ?? '') || a.id - b.id) // same order as fetch_content.py
      const ids = rows.map((r) => r.id)
      const [t, a] = ids.length
        ? await Promise.all([
            supabase.from('content_text').select('content_id,files,error,text_hash').in('content_id', ids),
            supabase.from('content_analysis').select('*').in('content_id', ids),
          ])
        : [{ data: [], error: null }, { data: [], error: null }]
      setItems(rows)
      setTexts(new Map((must(t) as Fetched[]).map((x) => [x.content_id, x])))
      setResults(new Map((must(a) as Analysis[]).map((x) => [x.content_id, x])))
    } catch (e) {
      const msg = (e as Error).message
      setError(msg.includes('no such table') ? 'The analysis tables are not on this database yet (they arrive with the first push).' : msg)
    }
  }, [])

  useEffect(() => {
    if (clientId) load(clientId)
  }, [clientId, load])

  const counts = useMemo(() => {
    const linked = items.filter((i) => links(i as ContentRow).doc).length
    const fetched = items.filter((i) => texts.get(i.id) && !texts.get(i.id)?.error).length
    const failed = items.filter((i) => texts.get(i.id)?.error).length
    return { linked, fetched, failed, analyzed: results.size, toFetch: linked - fetched - failed }
  }, [items, texts, results])

  const ready = (id: number) => {
    const t = texts.get(id)
    const a = results.get(id)
    return !!t && !t.error && (!a || a.text_hash !== t.text_hash)
  }

  async function run(ids: number[]) {
    const name = (id: number) => items.find((x) => x.id === id)?.name ?? `item ${id}`
    if (!getTeamKey()) {
      const e = new AnalyzeError('No team passcode entered.', 'passcode', null, null)
      return setFailure({ item: name(ids[0]), error: e, done: 0, total: ids.length })
    }
    stop.current = false
    setError('')
    setFailure(null)
    setRunLeft(ids.length)
    for (const [i, id] of ids.entries()) {
      if (stop.current) break
      setBusy(id)
      try {
        const a = await analyzeOne(id)
        setResults((m) => new Map(m).set(id, a))
      } catch (e) {
        const err = e instanceof AnalyzeError ? e : new AnalyzeError((e as Error).message, 'server_error', null, null)
        setFailure({ item: `${name(id)} (#${id})`, error: err, done: i, total: ids.length })
        break
      } finally {
        setRunLeft(ids.length - i - 1)
      }
    }
    setBusy(null)
    setRunLeft(0)
  }

  const client = clients.find((c) => c.id === clientId)
  const next = items.filter((i) => ready(i.id)).slice(0, howMany)
  const running = busy !== null

  return (
    <div className="page stack">
      <header>
        <h1>Analyze content</h1>
        <p className="muted">
          Gemini reads each item's files, tags it (technology, skills, level) and scores its quality skeptically. Runs on
          the local copy; a finished client is pushed to the live site.
        </p>
      </header>
      {available === false && (
        <Message kind="info">
          Analysing works only on the local copy (<code>npx wrangler dev</code> + <code>npm run dev</code>, with
          GEMINI_API_KEY in cloudflare/.dev.vars). Pushed results are shown below.
        </Message>
      )}
      <div className="analyze-bar">
        <label>
          Client{' '}
          <select value={clientId ?? ''} onChange={(e) => setClientId(Number(e.target.value) || null)} disabled={running}>
            <option value="">Choose…</option>
            {[...clients].sort((a, b) => abc(a.name, b.name)).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {clientId && (
          <span className="muted small">
            {items.length} items · {counts.linked} with a Doc link · {counts.fetched} fetched
            {counts.failed ? ` · ${counts.failed} could not be fetched` : ''} · {counts.analyzed} analysed
          </span>
        )}
      </div>

      {client && counts.toFetch > 0 && (
        <Message kind="info">
          {counts.toFetch} linked item(s) not fetched yet. Fetch the next 10 in a terminal (in skill-assist-portal/), then
          reload this page: <code>python3 scripts/analyze/fetch_content.py "{client.name}"</code>
        </Message>
      )}

      {clientId && available && (
        <div className="analyze-bar">
          <button className="primary" disabled={running || !next.length} onClick={() => run(next.map((i) => i.id))}>
            Analyze next{' '}
            <input
              type="number"
              className="num-inline"
              min={1}
              max={50}
              value={howMany}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setHowMany(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            />
          </button>
          {running && (
            <>
              <span className="muted small">Working… {runLeft} left (about 1–2 min each)</span>
              <button className="small" onClick={() => (stop.current = true)}>
                Stop after this one
              </button>
            </>
          )}
          {!running && !next.length && items.length > 0 && <span className="muted small">Nothing fetched is waiting to be analysed.</span>}
        </div>
      )}
      <Message kind="error">{error}</Message>
      {failure && <ErrorPopup failure={failure} onClose={() => setFailure(null)} />}

      {clientId && (
        <table className="data analyze-table">
          <thead>
            <tr>
              <th>Track</th>
              <th>Type</th>
              <th>Name</th>
              <th>Content</th>
              <th>Quality</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const t = texts.get(i.id)
              const a = results.get(i.id)
              const stale = a && t && a.text_hash !== t.text_hash
              return (
                <Fragment key={i.id}>
                  <tr className={open === i.id ? 'open' : ''}>
                    <td>{i.track_name}</td>
                    <td className="nowrap">
                      {i.content_type}
                      {i.sequence_label ? ` ${i.sequence_label}` : ''}
                    </td>
                    <td>
                      {a ? (
                        <button className="linklike" onClick={() => setOpen(open === i.id ? null : i.id)}>
                          {open === i.id ? '▾' : '▸'} {i.name}
                        </button>
                      ) : (
                        i.name
                      )}
                    </td>
                    <td className="small">
                      {!links(i as ContentRow).doc ? (
                        <span className="muted">no link</span>
                      ) : !t ? (
                        <span className="muted">not fetched</span>
                      ) : t.error ? (
                        <span className="error" title={t.error}>
                          ✗ {t.error.slice(0, 40)}
                        </span>
                      ) : (
                        <span title={t.files.map((f) => `${f.name} (${f.role})${f.note ? ` – ${f.note}` : ''}`).join('\n')}>
                          ✓ {t.files.filter((f) => f.chars).map((f) => f.role).join(', ')}
                        </span>
                      )}
                    </td>
                    <td className="nowrap">
                      <Band band={a?.quality_band} />
                      {a && <span className="muted small"> {a.confidence} conf.</span>}
                      {a?.low_confidence ? <span className="badge warn" title="Tags were guessed: check them">check tags</span> : null}
                      {stale && <span className="badge warn" title="The content changed since this score">changed</span>}
                    </td>
                    <td className="nowrap">
                      {available && t && !t.error && (
                        <button className="small" disabled={running} onClick={() => run([i.id])}>
                          {busy === i.id ? 'Analysing…' : a ? 'Re-analyze' : 'Analyze'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {open === i.id && a && (
                    <tr className="detail">
                      <td colSpan={6}>
                        <Detail a={a} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function Detail({ a }: { a: Analysis }) {
  const r = a.result
  const q = r.quality
  return (
    <div className="analysis stack">
      <p>
        <Band band={q.overall_band} /> <b>{q.confidence} confidence.</b> {q.summary}
      </p>
      {q.flags.length > 0 && (
        <ul className="flags">
          {q.flags.map((f) => (
            <li key={f}>⚠ {f}</li>
          ))}
        </ul>
      )}
      <table className="subscores">
        <tbody>
          {Object.entries(q.sub_scores).map(([k, s]) => (
            <tr key={k}>
              <td className="nowrap">{SUB_LABEL[k] ?? k}</td>
              <td>
                <Band band={s.band} />
              </td>
              <td>{s.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="tags">
        <dt>Technology</dt>
        <dd>
          <b>{r.primary_technology}</b>
          {r.secondary_technologies.length ? ` + ${r.secondary_technologies.join(', ')}` : ''}
        </dd>
        <dt>Level · mode</dt>
        <dd>
          {r.proficiency} · {r.submission_mode} · case study {r.case_study_coupling.toLowerCase()}
          {r.estimated_minutes ? ` · ~${r.estimated_minutes} min` : ''}
          {r.max_points ? ` · ${r.max_points} points` : ''}
        </dd>
        <dt>Has</dt>
        <dd>
          {[r.rubric_present && 'rubric', r.has_template && 'template', r.has_solution && 'solution'].filter(Boolean).join(', ') || 'none of rubric / template / solution'}
        </dd>
        <dt>Skills tested</dt>
        <dd>{r.skills_tested.join(' · ')}</dd>
        <dt>Subtopics</dt>
        <dd>{r.subtopics.join(' · ')}</dd>
      </dl>
      <p className="muted small">
        {a.model} · {new Date(a.analyzed_at).toLocaleString()}
      </p>
    </div>
  )
}
