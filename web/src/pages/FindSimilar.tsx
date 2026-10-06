import { useEffect, useMemo, useState } from 'react'
import { Message } from '../components/common'
import { buildIndex, findSimilar, matchingLines, splitTopics, words, type Candidate } from '../lib/similar'
import { fetchAll, supabase, type ContentRow } from '../lib/supabase'
import { abc, DOC_KIND, links, TopicsPanel } from './Tracker'

/** Coverage of one requested topic → what it means for the new request. */
function verdict(score: number): { cls: string; label: string } {
  if (score >= 0.8) return { cls: 'good', label: 'Exists – reuse' }
  if (score >= 0.5) return { cls: 'part', label: 'Partly – adapt' }
  return { cls: 'none', label: 'Not found – new' }
}

const pct = (x: number) => `${Math.round(x * 100)}%`

/** The content name, opening its Doc link when one is recorded. */
function Name({ c }: { c: Candidate }) {
  const l = c.rows.map(links).find((x) => x.doc)
  if (!l?.doc) return <>{c.name}</>
  const [icon, title] = DOC_KIND[l.doc_kind ?? ''] ?? ['📎', 'Open the file']
  return (
    <>
      <a href={l.doc} target="_blank" rel="noopener noreferrer" title={title}>
        {c.name}
      </a>{' '}
      <span className="link-kind" title={title}>
        {icon}
      </span>
      {l.solution && (
        <>
          {' '}
          <a
            className="small-link"
            href={l.solution}
            target="_blank"
            rel="noopener noreferrer"
            title="Open the solution"
          >
            Solution
          </a>
        </>
      )}
    </>
  )
}

/** Where the content was used: "Wipro · SDET Final", one line per client/track. */
function UsedIn({ c, onView }: { c: Candidate; onView: (r: ContentRow) => void }) {
  return (
    <ul className="used-in">
      {c.rows.map((r) => (
        <li key={r.id}>
          <b>{r.client_name}</b>
          {r.track_name ? ` · ${r.track_name}` : ''}
          {r.sequence_label ? ` · ${r.content_type === 'Daily Assignment' ? 'Day ' : ''}${r.sequence_label}` : ''}{' '}
          <button className="link-btn" onClick={() => onView(r)} title="See the TOC topics this content was built on">
            topics
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Words of the text an item does not cover, as chips ("all covered" when none). */
function Missing({ all, matched, text }: { all: string[]; matched: string[]; text: string }) {
  // Show each word as it was typed ("Kubernetes"), not its matching form ("kubernete").
  const typed = new Map<string, string>()
  for (const raw of text.split(/[\s,;:/()]+/)) {
    const w = words(raw)[0]
    if (w && !typed.has(w)) typed.set(w, raw.replace(/[.]+$/, ''))
  }
  const miss = all.filter((w) => !matched.includes(w)).map((w) => typed.get(w) ?? w)
  if (!miss.length) return <span className="sim-good small">all covered</span>
  return (
    <div className="chips">
      {miss.slice(0, 10).map((w) => (
        <span key={w} className="chip">
          {w}
        </span>
      ))}
      {miss.length > 10 && <span className="muted small">+{miss.length - 10}</span>}
    </div>
  )
}

const DRAFT_KEY = 'find-similar-topics'
const MODE_KEY = 'find-similar-mode'

/** "split": each topic of the text matched on its own; "whole": the whole text is one topic. */
type Mode = 'split' | 'whole'
const read = (key: string) => {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}
const keep = (key: string, v: string) => {
  try {
    sessionStorage.setItem(key, v)
  } catch {
    /* not kept: fine */
  }
}
/** The topics to look for: the text split into topics, or the whole text as one. */
const topicsOf = (text: string, mode: Mode) =>
  mode === 'whole' ? (text.trim() ? [text.replace(/\s+/g, ' ').trim()] : []) : splitTopics(text)

/**
 * Paste the topics of a new client request; see which existing content already covers them,
 * to decide whether to reuse it or create new content.
 */
export function FindSimilar() {
  const [rows, setRows] = useState<ContentRow[] | null>(null)
  const [error, setError] = useState('')
  const [text, setText] = useState(() => read(DRAFT_KEY) ?? '')
  const [mode, setMode] = useState<Mode>(() => (read(MODE_KEY) === 'whole' ? 'whole' : 'split'))
  // What was searched: the topics and how they were matched.
  const [asked, setAsked] = useState<{ topics: string[]; mode: Mode }>(() => ({
    topics: topicsOf(text, mode),
    mode,
  }))
  const [type, setType] = useState('')
  const [client, setClient] = useState('')
  const [onlyLinked, setOnlyLinked] = useState(false)
  const [limit, setLimit] = useState(20)
  const [open, setOpen] = useState<ContentRow | null>(null)

  useEffect(() => {
    fetchAll<ContentRow>(() => supabase.from('v_contents').select('*').order('id'))
      .then(setRows)
      .catch((e) => setError(e.message))
  }, [])

  const index = useMemo(() => (rows ? buildIndex(rows) : null), [rows])
  const types = useMemo(() => [...new Set((rows ?? []).map((r) => r.content_type))].sort(abc), [rows])
  const clients = useMemo(() => [...new Set((rows ?? []).map((r) => r.client_name))].sort(abc), [rows])

  const found = useMemo(() => {
    if (!index || !asked.topics.length) return null
    return findSimilar(
      index,
      asked.topics,
      (c) =>
        c.rows.some(
          (r) =>
            (!type || r.content_type === type) &&
            (!client || r.client_name === client) &&
            (!onlyLinked || !!links(r).doc),
        ),
      asked.mode === 'whole',
    )
  }, [index, asked, type, client, onlyLinked])

  const search = (m: Mode = mode) => {
    setAsked({ topics: topicsOf(text, m), mode: m })
    setLimit(20)
    keep(DRAFT_KEY, text)
  }
  // Switching the mode searches again straight away, so both ways are easy to compare.
  const changeMode = (m: Mode) => {
    setMode(m)
    keep(MODE_KEY, m)
    if (asked.topics.length) search(m)
  }

  const counts = found
    ? found.byTopic.reduce(
        (acc, hits) => {
          acc[verdict(hits[0]?.score ?? 0).cls as 'good' | 'part' | 'none']++
          return acc
        },
        { good: 0, part: 0, none: 0 },
      )
    : null

  return (
    <div className="page stack">
      <header>
        <h1>Find similar content</h1>
        <p className="muted">
          Paste the topics of a new client request. Every item in the tracker is compared with them, so you can decide
          whether to reuse existing content or create new.
        </p>
      </header>

      <Message kind="error">{error}</Message>

      <div className="card stack">
        <label>
          Topics: one per line, or comma-separated (you can paste a column from Excel)
          <textarea
            rows={7}
            value={text}
            placeholder={'e.g.\nPython lists and dictionaries\nFile handling\nException handling\nSQL joins'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) search()
            }}
          />
        </label>
        <div className="mode-switch" role="radiogroup" aria-label="How to search">
          <label className="check" title="Every line / comma-separated item is a topic of its own, checked separately">
            <input type="radio" name="mode" checked={mode === 'split'} onChange={() => changeMode('split')} /> Split
            into topics <span className="muted small">– check each topic separately</span>
          </label>
          <label
            className="check"
            title="The whole text is one topic, e.g. one TOC cell: find content covering all of it together"
          >
            <input type="radio" name="mode" checked={mode === 'whole'} onChange={() => changeMode('whole')} /> Whole
            text as one topic <span className="muted small">– find content covering all of it together</span>
          </label>
        </div>
        <div className="filters">
          <button className="primary" onClick={() => search()} disabled={!rows || !text.trim()}>
            {rows ? 'Find matches' : 'Loading tracker…'}
          </button>
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select value={client} onChange={(e) => setClient(e.target.value)} aria-label="Client">
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <label className="check">
            <input type="checkbox" checked={onlyLinked} onChange={(e) => setOnlyLinked(e.target.checked)} /> Only
            content with a Doc link
          </label>
          {text.trim() && (
            <button
              className="small"
              onClick={() => {
                setText('')
                setAsked({ topics: [], mode })
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {found && counts && (
        <>
          <section className="stack">
            <h2>{asked.mode === 'whole' ? 'Your text, as one topic' : `Your topics (${asked.topics.length})`}</h2>
            {asked.mode === 'split' && (
              <div className="stats">
                <div className="stat">
                  <span className="stat-n sim-good">{counts.good}</span>
                  <span className="stat-l">already exist – reuse</span>
                </div>
                <div className="stat">
                  <span className="stat-n sim-part">{counts.part}</span>
                  <span className="stat-l">partly covered – adapt</span>
                </div>
                <div className="stat">
                  <span className="stat-n sim-none">{counts.none}</span>
                  <span className="stat-l">not found – create new</span>
                </div>
              </div>
            )}
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Topic</th>
                    <th>Verdict</th>
                    <th>Closest existing content</th>
                  </tr>
                </thead>
                <tbody>
                  {asked.topics.map((t, i) => {
                    const hits = found.byTopic[i]
                    const v = verdict(hits[0]?.score ?? 0)
                    return (
                      <tr key={t}>
                        <td className="strong">{t}</td>
                        <td className="nowrap">
                          <span className={`sim-badge sim-${v.cls}`}>{v.label}</span>
                        </td>
                        <td>
                          {hits.length === 0 && <span className="muted">Nothing in the tracker mentions this.</span>}
                          <ul className="used-in">
                            {hits.map((h) => (
                              <li
                                key={h.result.candidate.key}
                                className={h.score < 0.5 ? 'muted' : undefined}
                                title={h.score < 0.5 ? 'Weak match' : undefined}
                              >
                                <span className="sim-pct">{pct(h.score)}</span> <Name c={h.result.candidate} />{' '}
                                <span className="muted small">
                                  · {[...new Set(h.result.candidate.rows.map((r) => r.client_name))].join(', ')}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="stack">
            <h2>Best matching content</h2>
            <p className="muted small">
              {asked.mode === 'whole'
                ? 'Ranked by how much of your text each item covers.'
                : 'Ranked by how much of all your topics each item covers.'}{' '}
              Content used for several clients is listed once.
            </p>
            {found.ranked.length === 0 && <p className="muted">No content in the tracker shares these topics.</p>}
            {found.ranked.length > 0 && (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Match</th>
                      <th>Content</th>
                      <th>Type</th>
                      <th>{asked.mode === 'whole' ? 'Not covered' : 'Covers'}</th>
                      <th>Matching TOC topics</th>
                      <th>Used in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {found.ranked.slice(0, limit).map((r) => {
                      const c = r.candidate
                      const covered = r.perTopic.filter((s) => s >= 0.5).length
                      return (
                        <tr key={c.key}>
                          <td className="nowrap">
                            <div className="sim-bar" title={`Overall match ${pct(r.score)}`}>
                              <span style={{ width: pct(r.score) }} />
                            </div>
                            <span className="sim-pct">{pct(r.score)}</span>
                          </td>
                          <td>
                            <Name c={c} />
                          </td>
                          <td className="nowrap">{[...new Set(c.rows.map((x) => x.content_type))].join(', ')}</td>
                          {asked.mode === 'whole' ? (
                            <td title="Words of your text this item does not mention: what would need adapting">
                              <Missing all={found.topicWords[0]} matched={r.matched} text={asked.topics[0]} />
                            </td>
                          ) : (
                            <td className="nowrap" title="Your topics this item covers at least half of">
                              {covered} / {asked.topics.length}
                            </td>
                          )}
                          <td>
                            <ul className="topic-list small">
                              {matchingLines(c, r.matched).map((l) => (
                                <li key={l}>{l}</li>
                              ))}
                            </ul>
                          </td>
                          <td>
                            <UsedIn c={c} onView={setOpen} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {found.ranked.length > limit && (
              <button className="small" onClick={() => setLimit(limit + 20)}>
                Show more ({found.ranked.length - limit} left)
              </button>
            )}
          </section>
        </>
      )}

      {open && <TopicsPanel content={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
