import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { cellRef, Message } from '../components/common'
import { useColumnWidths } from '../components/columns'
import { EditContent } from '../components/EditContent'
import { GROUP_KEY, SUBTOPIC_KEY } from '../lib/similar'
import { fetchAll, must, supabase, type ContentRow, type LinkedTopic } from '../lib/supabase'

/**
 * Short topic labels for the table: "Testing & Data Access Hardening (JUnit, Mockito)" and
 * "Spring Boot Fundamentals, REST Controllers" become separate short pieces, brackets dropped.
 */
function shortTopics(topics: LinkedTopic[]): string[] {
  // Plain topic lists (DXC, MVR, CIET, Sony GET) are one topic per row or a ";" list: never split on commas.
  const plain = isPlainList(topics)
  const out: string[] = []
  for (const t of topics) {
    const text = (t.topic ?? '').replace(/\s*\([^)]*\)/g, '')
    // " + " joins two topics in one cell (Invesco: "Snowflake Data Warehousing + Case Study Checkpoint 1").
    for (const piece of plain && !isCommaList(t) ? text.split(/[;\n]|\s\+\s/) : text.split(/[,;\n]|\s\+\s/)) {
      const p = piece.trim()
      if (/[\p{L}\p{N}]/u.test(p) && !out.some((o) => o.toLowerCase() === p.toLowerCase())) out.push(p)
    }
  }
  return out
}

/** "Day 9 A" for daily assignments, "M2" for milestones, the raw label otherwise. */
function dayLabel(r: ContentRow): string {
  const seq = r.sequence_label?.trim()
  if (!seq) return '—'
  if (!/^\d/.test(seq)) return seq
  if (r.content_type === 'Daily Assignment') return `Day ${seq}`
  if (r.content_type === 'Milestone Assessment') return `M${seq}`
  return seq
}

/** Week name kept on content whose track spans several TOC weeks (EY GDS · AI & Data). */
function week(r: ContentRow): string | null {
  return typeof r.extra?.week === 'string' ? r.extra.week : null
}

/** Participant an individual assessment was made for (Randstad · Individual Assessments). */
function participant(r: ContentRow): string | null {
  return typeof r.extra?.participant === 'string' ? r.extra.participant : null
}

/** Course column of the client's sheet, written as-is (IBM · Phases 1–3). */
function course(r: ContentRow): string | null {
  return typeof r.extra?.course === 'string' ? r.extra.course : null
}

/** Proficiency level from the client's sheet, e.g. "L3" (Netcracker · Demo). */
function proficiency(r: ContentRow): string | null {
  return typeof r.extra?.proficiency === 'string' ? r.extra.proficiency : null
}

/** Marks a capstone that is really an incremental project, e.g. "Incremental Project 1" (Leadyne). */
function project(r: ContentRow): string | null {
  return typeof r.extra?.project === 'string' ? r.extra.project : null
}

/** Actual / Re-attempt version of an assessment, "Final – …" for finals stored as Capstone (Wipro). */
function assessment(r: ContentRow): string | null {
  return typeof r.extra?.assessment === 'string' ? r.extra.assessment : null
}

/** Links found for the item in the TestCase-Count-ALL sheet (scripts/import/sync_doc_links.py). */
export type ContentLinks = { doc?: string; doc_kind?: string; solution?: string; test_link?: string; manual?: boolean }
export function links(r: ContentRow): ContentLinks {
  const l = r.extra?.links
  return l && typeof l === 'object' ? (l as ContentLinks) : {}
}

export const DOC_KIND: Record<string, [string, string]> = {
  folder: ['📁', 'Open the Drive folder'],
  doc: ['📄', 'Open the Google Doc'],
  sheet: ['📊', 'Open the Google Sheet'],
}

/** Doc link kind from the URL, so a pasted link gets the same 📁 / 📄 / 📊 marker as synced ones. */
function linkKind(url: string): string {
  if (url.includes('/drive/folders/')) return 'folder'
  if (url.includes('docs.google.com/document')) return 'doc'
  if (url.includes('docs.google.com/spreadsheets')) return 'sheet'
  return 'file'
}

/**
 * Content name; opens its Doc link (problem statement) in a new tab when one is recorded, plus a Solution link.
 * "+ Link" / "✎" lets the team paste or fix the Doc link here; such links are marked manual so the sheet sync
 * (scripts/import/sync_doc_links.py) never overwrites them. Saving an empty box removes the link.
 */
function ContentName({ r, onSaved }: { r: ContentRow; onSaved: (extra: ContentRow['extra']) => void }) {
  const l = links(r)
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    const v = url.trim()
    if (v && !/^https?:\/\//i.test(v)) return setErr('Paste a full link starting with https://')
    setBusy(true)
    setErr('')
    const rest = { ...r.extra }
    delete rest.links
    const extra = v
      ? { ...rest, links: { ...l, doc: v, doc_kind: linkKind(v), manual: true, source: { manual: true, date: new Date().toISOString().slice(0, 10) } } }
      : rest
    const { error } = await supabase.from('contents').update({ extra }).eq('id', r.id)
    setBusy(false)
    if (error) return setErr(error.message)
    onSaved(extra)
    setEditing(false)
  }

  if (editing)
    return (
      <div className="link-edit">
        <div>{r.name}</div>
        <input
          type="url"
          autoFocus
          placeholder="Paste the Drive / Docs link"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
        <div className="row-gap">
          <button className="small primary" disabled={busy} onClick={save}>
            Save
          </button>
          <button className="small" disabled={busy} onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
        {err && <div className="small error-text">{err}</div>}
      </div>
    )

  const edit = (
    <button
      className={l.doc ? 'link-btn' : 'link-btn add'}
      title={l.doc ? 'Change the Doc link' : 'Add the Doc link (Drive folder / Google Doc)'}
      onClick={() => {
        setUrl(l.doc ?? '')
        setErr('')
        setEditing(true)
      }}
    >
      {l.doc ? '✎' : '+ Link'}
    </button>
  )
  if (!l.doc)
    return (
      <>
        {r.name} {edit}
      </>
    )
  const [icon, title] = DOC_KIND[l.doc_kind ?? ''] ?? ['📎', 'Open the file']
  return (
    <>
      <a href={l.doc} target="_blank" rel="noopener noreferrer" title={title}>
        {r.name}
      </a>{' '}
      <span className="link-kind" title={title}>
        {icon}
      </span>
      {l.solution && (
        <>
          {' '}
          <a className="small-link" href={l.solution} target="_blank" rel="noopener noreferrer" title="Open the solution">
            Solution
          </a>
        </>
      )}{' '}
      {edit}
    </>
  )
}

/** "2026-09-16" → "16-09-2026", the format used in our trackers. */
function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

/** A–Z ignoring capitals, with numbers in number order ("Week 2" before "Week 10"). */
export const abc = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true })

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
/** "Coding Assessment - 03 Oct 2026" → ["Coding Assessment", "2026-10-03"]; names without a trailing date → [name, null]. */
function splitDate(name: string): [string, string | null] {
  const m = name.match(/^(.*?)\s*-\s*(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/)
  const mon = m ? MONTHS.indexOf(m[3].toLowerCase()) : -1
  if (!m || mon < 0) return [name, null]
  return [m[1], `${m[4]}-${String(mon + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`]
}

/**
 * Track names A–Z; names that differ only by a trailing date ("… - 02 Sep 2026", "… - 03 Oct 2026") go in date order,
 * which plain A–Z would get wrong (03 Oct before 05 Sep).
 */
function trackOrder(a: string, b: string): number {
  const [pa, da] = splitDate(a)
  const [pb, db] = splitDate(b)
  if (da && db && abc(pa, pb) === 0) return da < db ? -1 : da > db ? 1 : 0
  return abc(a, b)
}

/** Client A–Z, then track (see trackOrder; content without a track last), then type and id. */
function sortRows(rows: ContentRow[]): ContentRow[] {
  return [...rows].sort(
    (a, b) =>
      abc(a.client_name, b.client_name) ||
      Number(!a.track_name) - Number(!b.track_name) ||
      trackOrder(a.track_name ?? '', b.track_name ?? '') ||
      a.type_order - b.type_order ||
      a.id - b.id,
  )
}

/** Home page: one simple table of client → content → its main topics. */
export function Tracker() {
  const [rows, setRows] = useState<ContentRow[] | null>(null)
  const cols = useColumnWidths('tracker')
  const [error, setError] = useState('')
  const [open, setOpen] = useState<ContentRow | null>(null)
  // The item open in the edit popup, or 'new' for "+ Add content".
  const [editing, setEditing] = useState<ContentRow | 'new' | null>(null)

  // Filters live in the URL so a filtered view survives a refresh and can be shared.
  const [params, setParams] = useSearchParams()
  const f = {
    q: params.get('q') ?? '',
    client: params.get('client') ?? '',
    csm: params.get('csm') ?? '',
    track: params.get('track') ?? '',
    type: params.get('type') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    // "1" = only items without a Doc link (for filling in missing links)
    nolink: params.get('nolink') ?? '',
  }
  const setFilter = (k: keyof typeof f, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    if (k === 'client') {
      next.delete('csm')
      next.delete('track')
      next.delete('type')
    }
    setParams(next, { replace: true })
  }
  const anyFilter = Object.values(f).some(Boolean)

  useEffect(() => {
    fetchAll<ContentRow>(() =>
      supabase.from('v_contents').select('*').order('client_name').order('track_name').order('type_order').order('id'),
    )
      .then((all) => setRows(sortRows(all)))
      .catch((e) => setError(e.message))
  }, [])

  // Dropdown options come from what is recorded, so they never offer an empty choice.
  const options = useMemo(() => {
    const all = rows ?? []
    const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))]
    return {
      // Every list is A–Z ignoring capitals (tracks: see trackOrder).
      clients: uniq(all.map((r) => r.client_name)).sort(abc),
      // CSMs, tracks and types belong to a client, so they are offered only once a client is chosen.
      csms: uniq(all.filter((r) => r.client_name === f.client).map((r) => r.csm)).sort(abc),
      tracks: uniq(all.filter((r) => r.client_name === f.client && (!f.csm || r.csm === f.csm)).map((r) => r.track_name)).sort(trackOrder),
      types: uniq(all.filter((r) => r.client_name === f.client).map((r) => r.content_type)).sort(abc),
    }
  }, [rows, f.client, f.csm])

  // Items still without a Doc link, per client: such clients are highlighted in the Client filter.
  const missing = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows ?? []) if (!links(r).doc) m.set(r.client_name, (m.get(r.client_name) ?? 0) + 1)
    return m
  }, [rows])

  const shown = useMemo(() => {
    const words = f.q.toLowerCase().split(/\s+/).filter(Boolean)
    return (rows ?? []).filter((r) => {
      if (f.client && r.client_name !== f.client) return false
      if (f.nolink && links(r).doc) return false
      if (f.client && f.csm && r.csm !== f.csm) return false
      if (f.client && f.track && r.track_name !== f.track) return false
      if (f.client && f.type && r.content_type !== f.type) return false
      if (f.from && (!r.delivery_date || r.delivery_date < f.from)) return false
      if (f.to && (!r.delivery_date || r.delivery_date > f.to)) return false
      if (words.length) {
        // Only what the page shows: content name, module, topic and sub-topics.
        const hay = [
          r.name,
          ...r.topics.map((t) => {
            const extra = Object.entries(t.data).filter(([k]) => GROUP_KEY.test(k) || SUBTOPIC_KEY.test(k))
            return `${t.topic} ${extra.map(([, v]) => v).join(' ')}`
          }),
        ]
          .join(' ')
          .toLowerCase()
        if (!words.every((w) => hay.includes(w))) return false
      }
      return true
    })
  }, [rows, f.q, f.client, f.csm, f.track, f.type, f.from, f.to, f.nolink])

  // The Week column appears only when a client is chosen and some of its shown content has a week.
  const showWeek = !!f.client && shown.some((r) => week(r))
  // Same for the Participant column (individual assessments).
  const showParticipant = !!f.client && shown.some((r) => participant(r))
  // Same for the Course column (IBM).
  const showCourse = !!f.client && shown.some((r) => course(r))
  // Same for the Proficiency column (Netcracker).
  const showProficiency = !!f.client && shown.some((r) => proficiency(r))
  // Same for the Project column (Leadyne incremental projects).
  const showProject = !!f.client && shown.some((r) => project(r))
  // Same for the Assessment column (Wipro actual / re-attempt / final).
  const showAssessment = !!f.client && shown.some((r) => assessment(r))

  // Header cells in display order: [id, label]. The id keys the column's saved width.
  const columns = (
    [
      ['sno', 'S.No.'],
      ['client', 'Client'],
      ['csm', 'CSM'],
      ['track', 'Track'],
      showWeek && ['week', 'Week'],
      showParticipant && ['participant', 'Participant'],
      showCourse && ['course', 'Course'],
      showProficiency && ['proficiency', 'Proficiency'],
      showProject && ['project', 'Project'],
      showAssessment && ['assessment', 'Assessment'],
      ['day', 'Day'],
      ['content', 'Content'],
      ['type', 'Type'],
      ['date', 'Date'],
      ['topics', 'Topics'],
      ['view', ''],
      ['edit', ''],
    ] as ([string, string] | false)[]
  ).filter((c): c is [string, string] => !!c)

  return (
    <div className="page stack">
      <header className="tracker-head">
        <div>
          <h1>Content tracker</h1>
          <p className="muted">Each piece of content we created and the TOC topics it is based on.</p>
        </div>
        <button className="primary" onClick={() => setEditing('new')} title="Add a new content item">
          + Add content
        </button>
      </header>

      <Message kind="error">{error}</Message>
      {rows === null && !error && <p className="muted">Loading…</p>}
      {rows && rows.length === 0 && <p className="muted">Nothing recorded yet.</p>}

      {rows && rows.length > 0 && (
        <div className="filters">
          <input
            type="search"
            className="grow"
            placeholder="Search content or topics"
            value={f.q}
            onChange={(e) => setFilter('q', e.target.value)}
          />
          <select value={f.client} onChange={(e) => setFilter('client', e.target.value)} aria-label="Client">
            <option value="">All clients</option>
            {options.clients.map((c) => {
              const n = missing.get(c) ?? 0
              return (
                <option key={c} value={c} className={n ? 'missing-links' : undefined}>
                  {n ? `${c}  ⚠ ${n} without link` : c}
                </option>
              )
            })}
          </select>
          <select
            value={f.csm}
            onChange={(e) => setFilter('csm', e.target.value)}
            aria-label="CSM"
            disabled={!f.client}
            title={f.client ? undefined : 'Select a client first'}
          >
            <option value="">{f.client ? 'All CSMs' : 'CSM: select a client first'}</option>
            {options.csms.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            value={f.track}
            onChange={(e) => setFilter('track', e.target.value)}
            aria-label="Track"
            disabled={!f.client}
            title={f.client ? undefined : 'Select a client first'}
          >
            <option value="">{f.client ? 'All tracks' : 'Track: select a client first'}</option>
            {options.tracks.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select
            value={f.type}
            onChange={(e) => setFilter('type', e.target.value)}
            aria-label="Type"
            disabled={!f.client}
            title={f.client ? undefined : 'Select a client first'}
          >
            <option value="">{f.client ? 'All types' : 'Type: select a client first'}</option>
            {options.types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <label className="inline">
            From
            <input type="date" value={f.from} onChange={(e) => setFilter('from', e.target.value)} />
          </label>
          <label className="inline">
            To
            <input type="date" value={f.to} onChange={(e) => setFilter('to', e.target.value)} />
          </label>
          <label className="inline" title="Show only items that still need a Doc link">
            <input type="checkbox" checked={!!f.nolink} onChange={(e) => setFilter('nolink', e.target.checked ? '1' : '')} />
            Only without link
          </label>
          {cols.resized && (
            <button title="Put every column back to its automatic width" onClick={cols.reset}>
              Reset column widths
            </button>
          )}
          {anyFilter && (
            <button onClick={() => setParams(new URLSearchParams(), { replace: true })}>Clear</button>
          )}
        </div>
      )}

      {rows && rows.length > 0 && (
        <p className="muted small">
          Showing {shown.length} of {rows.length}
        </p>
      )}

      {rows && rows.length > 0 && shown.length === 0 && <p className="muted">No content matches these filters.</p>}

      {shown.length > 0 && (
        <div className="table-wrap tracker">
          <table className={cols.resized ? 'data resized' : 'data'} style={cols.tableStyle(columns.map(([id]) => id))}>
            <thead>
              <tr ref={cols.headRow}>{columns.map(([id, label]) => cols.th(id, label))}</tr>
            </thead>
            <tbody>
              {shown.map((r, i) => {
                const short = shortTopics(r.topics)
                return (
                  <tr key={r.id}>
                    <td className="muted">{i + 1}</td>
                    <td className="nowrap">{r.client_name}</td>
                    <td className="nowrap">{r.csm ?? <span className="muted">—</span>}</td>
                    <td>{r.track_name ?? <span className="muted">—</span>}</td>
                    {showWeek && <td>{week(r) ?? <span className="muted">—</span>}</td>}
                    {showParticipant && <td className="nowrap">{participant(r) ?? <span className="muted">—</span>}</td>}
                    {showCourse && <td>{course(r) ?? <span className="muted">—</span>}</td>}
                    {showProficiency && <td className="nowrap">{proficiency(r) ?? <span className="muted">—</span>}</td>}
                    {showProject && <td className="nowrap">{project(r) ?? <span className="muted">—</span>}</td>}
                    {showAssessment && <td className="nowrap">{assessment(r) ?? <span className="muted">—</span>}</td>}
                    {/* Long day labels (Wipro J2EE topic names) wrap; short ones like "Day 15-17" stay on one line. */}
                    <td className={dayLabel(r).length > 14 ? 'wrap-long' : 'nowrap'}>{dayLabel(r)}</td>
                    <td className="strong">
                      <ContentName
                        r={r}
                        onSaved={(extra) => setRows((all) => all && all.map((x) => (x.id === r.id ? { ...x, extra } : x)))}
                      />
                    </td>
                    <td className="nowrap muted">{r.content_type}</td>
                    <td className="nowrap">{formatDate(r.delivery_date)}</td>
                    <td>
                      {short.length ? (
                        <div className="chips">
                          {short.slice(0, 3).map((s) => (
                            <span className="chip" key={s}>
                              {s}
                            </span>
                          ))}
                          {short.length > 3 && <span className="muted small">+{short.length - 3}</span>}
                        </div>
                      ) : (
                        <span className="muted small">—</span>
                      )}
                    </td>
                    <td>
                      <button className="small" disabled={!r.topics.length} onClick={() => setOpen(r)}>
                        View topics
                      </button>
                    </td>
                    <td>
                      <button className="small edit-btn" title="Edit all fields of this item" aria-label="Edit" onClick={() => setEditing(r)}>
                        ✎
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && <TopicsPanel content={open} onClose={() => setOpen(null)} />}
      {editing && (
        <EditContent
          content={editing === 'new' ? undefined : editing}
          defaults={{ client: f.client, track: f.track }}
          usedExtrasFor={(client) =>
            new Set(
              (rows ?? [])
                .filter((x) => x.client_name === client)
                .flatMap((x) => ['course', 'proficiency', 'assessment', 'project', 'participant'].filter((k) => x.extra?.[k])),
            )
          }
          onClose={() => setEditing(null)}
          onSaved={async (id, keepOpen) => {
            // Re-read the saved row (track, CSM and topics come from the view); a new item is added to the list.
            const fresh = must(await supabase.from('v_contents').select('*').eq('id', id).single()) as ContentRow
            setRows((all) => all && sortRows(all.some((x) => x.id === id) ? all.map((x) => (x.id === id ? fresh : x)) : [...all, fresh]))
            if (!keepOpen) setEditing(null)
          }}
          onDeleted={(id) => {
            setRows((all) => all && all.filter((x) => x.id !== id))
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

/** TOC row values in the sheet's own column order (JSON storage does not keep key order). */
function orderedEntries(t: LinkedTopic): [string, string][] {
  const order = (t.columns ?? []).map((c) => c.header)
  const pos = (k: string) => (order.indexOf(k) === -1 ? order.length : order.indexOf(k))
  return Object.entries(t.data).sort(([a], [b]) => pos(a) - pos(b))
}

// GROUP_KEY: grouping columns shown above the topic: "Module" (Sony), "Phase / Module" (Mphasis), "Assessment Area" /
// "Sub-Category" (DXC), "Focus of the week" (EY). SUBTOPIC_KEY: detail column shown under the topic: "Sub Topic" (Sony),
// "Key Concepts Covered" (Capgemini), "Coverage" / "Detailed Coverage" (EY), "Core Topics" (Straive). Both live in lib/similar.ts.

/** Sub-topics; a " · " list (Straive "Core Topics") becomes bullet points. */
function SubTopics({ text }: { text: string }) {
  const items = text.split(/\s+·\s+/).map((x) => x.trim()).filter(Boolean)
  if (items.length < 2) return <>{text}</>
  return (
    <ul className="merged-topics">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

/** Module, topic and sub-topics up front; every other TOC column behind a button. */
function TopicBlock({ topic: t }: { topic: LinkedTopic }) {
  const [showAll, setShowAll] = useState(false)
  const entries = orderedEntries(t)
  const groups = entries.filter(([k]) => GROUP_KEY.test(k))
  const subTopics = entries.find(([k]) => SUBTOPIC_KEY.test(k))
  const others = entries.filter(
    ([k, v]) => !GROUP_KEY.test(k) && !SUBTOPIC_KEY.test(k) && v !== t.topic && v !== t.day_label,
  )

  return (
    <section className="topic-block">
      <dl>
        {groups.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        <div>
          <dt>Topic</dt>
          <dd className="strong">{t.topic}</dd>
        </div>
        {subTopics && (
          <div>
            <dt>{subTopics[0]}</dt>
            <dd>
              <SubTopics text={subTopics[1]} />
            </dd>
          </div>
        )}
      </dl>
      <button className="small" onClick={() => setShowAll(!showAll)}>
        {showAll ? 'Hide details' : 'Show all details'}
      </button>
      {showAll && (
        <dl>
          <div>
            <dt>TOC location</dt>
            <dd>
              {t.file_name} › {t.sheet_name} › {cellRef(t)}
              {t.day_label ? ` · ${t.day_label}` : ''}
            </dd>
          </div>
          {others.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

/** A "Learning Topics" cell (Data Analytics) is a comma-separated list of separate topics. */
function isCommaList(t: LinkedTopic): boolean {
  return Object.keys(t.data).some((k) => /learning topics/i.test(k))
}

/** True for simple topic lists (no sub-topic column), as opposed to detailed TOC rows. */
function isPlainList(topics: LinkedTopic[]): boolean {
  return !topics.some((t) => Object.keys(t.data).some((k) => SUBTOPIC_KEY.test(k)))
}

/**
 * Plain topic lists (no sub-topic column, e.g. DXC): one merged list of topics,
 * grouping columns such as "Assessment Area" shown once, locations behind a button.
 */
function MergedTopics({ topics }: { topics: LinkedTopic[] }) {
  const [showAll, setShowAll] = useState(false)
  // A cell like "Java setup/IDE; variables & types; control flow" becomes separate bullet points.
  const items = topics.flatMap((t) =>
    (t.topic ?? '')
      .split(isCommaList(t) ? /[;,]\s*/ : /;\s*/)
      .map((x) => x.trim())
      .filter(Boolean),
  )
  // Grouping values shared by every topic (e.g. Assessment Area: AWS) are shown once.
  const shared = orderedEntries(topics[0]).filter(
    ([k, v]) => GROUP_KEY.test(k) && topics.every((t) => t.data[k] === v),
  )

  return (
    <section className="topic-block">
      <dl>
        {shared.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        <div>
          <dt>Topics ({items.length})</dt>
          <dd>
            <ul className="merged-topics">
              {items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
      <button className="small" onClick={() => setShowAll(!showAll)}>
        {showAll ? 'Hide details' : 'Show all details'}
      </button>
      {showAll && (
        <dl>
          {topics.map((t) => {
            const groups = orderedEntries(t).filter(([k, v]) => GROUP_KEY.test(k) && !shared.some(([sk, sv]) => sk === k && sv === v))
            return (
              <div key={t.toc_row_id}>
                <dt>
                  {t.file_name} › {t.sheet_name} › {cellRef(t)}
                </dt>
                <dd>
                  {groups.map(([, v]) => `${v} › `).join('')}
                  {t.topic}
                </dd>
              </div>
            )
          })}
        </dl>
      )}
    </section>
  )
}

export function TopicsPanel({ content, onClose }: { content: ContentRow; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel card stack" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="page-head">
          <div>
            <h2>{content.name}</h2>
            <p className="muted small">
              {content.client_name}
              {content.track_name ? ` · ${content.track_name}` : ''} · {content.content_type}
              {content.sequence_label ? ` ${content.sequence_label}` : ''}
            </p>
          </div>
          <button className="small" onClick={onClose}>
            Close
          </button>
        </div>
        {isPlainList(content.topics) ? (
          <MergedTopics topics={content.topics} />
        ) : (
          content.topics.map((t) => <TopicBlock key={t.toc_row_id} topic={t} />)
        )}
      </div>
    </div>
  )
}
