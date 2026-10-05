import { useEffect, useMemo, useState } from 'react'
import { ComboInput } from './common'
import { fetchAll, findOrCreateTrack, must, supabase, type ContentRow, type ContentType } from '../lib/supabase'

/** Optional per-item fields shown as extra home-page columns (stored in contents.extra). */
const EXTRA_FIELDS: [key: string, label: string, hint: string][] = [
  ['course', 'Course', 'e.g. the course or skill the item belongs to'],
  ['proficiency', 'Proficiency', 'e.g. L3'],
  ['assessment', 'Assessment', 'Actual / Re-attempt / Final – Actual / Final – Re-attempt'],
  ['project', 'Project', 'e.g. Incremental Project 1'],
  ['week', 'Week', 'e.g. Week 2'],
  ['participant', 'Participant', 'person the assessment was made for'],
]

type TrackRow = { id: number; name: string; csm: string | null }
type TopicOption = { id: number; topic: string | null; day_label: string | null; sheet_name: string; file_name: string; module: string; text: string }
type Links = { doc?: string; doc_kind?: string; solution?: string; manual?: boolean; [k: string]: unknown }

const str = (v: unknown) => (typeof v === 'string' ? v : '')

function linkKind(url: string): string {
  if (url.includes('/drive/folders/')) return 'folder'
  if (url.includes('docs.google.com/document')) return 'doc'
  if (url.includes('docs.google.com/spreadsheets')) return 'sheet'
  return 'file'
}

/**
 * Popup to edit every field of one content item: track (new names create a track), the track's CSM, type, day, name,
 * date, Doc / Solution links, the optional extra columns, notes and the linked topics (pick from the client's TOCs or
 * type a new topic, which goes into the client's hand-written topic list). Client stays fixed: topics belong to it.
 */
export function EditContent({
  content,
  usedExtras,
  onClose,
  onSaved,
  onDeleted,
}: {
  content: ContentRow
  /** Extra fields this client already uses; others are behind "Show all fields". */
  usedExtras: Set<string>
  onClose: () => void
  onSaved: (id: number) => void
  onDeleted: (id: number) => void
}) {
  const x = content.extra ?? {}
  const links0 = (x.links && typeof x.links === 'object' ? x.links : {}) as Links
  const [tracks, setTracks] = useState<TrackRow[]>([])
  const [types, setTypes] = useState<ContentType[]>([])
  const [options, setOptions] = useState<TopicOption[]>([])
  const [form, setForm] = useState({
    track: content.track_name ?? '',
    csm: content.csm ?? '',
    type: content.content_type,
    day: content.sequence_label ?? '',
    name: content.name,
    date: content.delivery_date ?? '',
    notes: content.notes ?? '',
    doc: links0.doc ?? '',
    solution: links0.solution ?? '',
    ...Object.fromEntries(EXTRA_FIELDS.map(([k]) => [k, str(x[k])])),
  } as Record<string, string>)
  const [linked, setLinked] = useState<number[]>(content.topics.map((t) => t.toc_row_id))
  const [find, setFind] = useState('')
  const [newTopic, setNewTopic] = useState('')
  // Typed topics wait here until Save (so Cancel leaves nothing behind).
  const [pending, setPending] = useState<string[]>([])
  const [allFields, setAllFields] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    ;(async () => {
      const [t, ty] = await Promise.all([
        supabase.from('tracks').select('id,name,csm').eq('client_id', content.client_id).order('name'),
        supabase.from('content_types').select('name,sort_order').order('sort_order'),
      ])
      setTracks(must(t))
      setTypes(must(ty))
      const rows = await fetchAll<Omit<TopicOption, 'module' | 'text'> & { data: Record<string, unknown>; data_text: string | null }>(() =>
        supabase
          .from('v_toc_rows')
          .select('id,topic,day_label,sheet_name,file_name,data,data_text')
          .eq('client_id', content.client_id)
          .order('toc_file_id')
          .order('row_number'),
      )
      setOptions(
        rows.map((r) => ({ ...r, module: str(r.data?.Module ?? r.data?.['Module Title'] ?? r.data?.Skill), text: (r.data_text ?? '').toLowerCase() })),
      )
    })().catch((e) => setError(e.message))
  }, [content.client_id])

  // The CSM box follows the chosen track until it is edited.
  const [csmTouched, setCsmTouched] = useState(false)
  const chosenTrack = tracks.find((t) => t.name.toLowerCase() === form.track.trim().toLowerCase())
  useEffect(() => {
    if (!csmTouched && chosenTrack) set('csm', chosenTrack.csm ?? '')
  }, [chosenTrack?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options])
  const label = (o: TopicOption) => [o.day_label, o.topic, o.module && `(${o.module})`].filter(Boolean).join(' · ')
  const matches = useMemo(() => {
    const words = find.toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) return []
    return options
      .filter((o) => !linked.includes(o.id) && words.every((w) => `${label(o)} ${o.sheet_name} ${o.text}`.toLowerCase().includes(w)))
      .slice(0, 12)
  }, [find, options, linked])

  const extrasShown = EXTRA_FIELDS.filter(([k]) => allFields || usedExtras.has(k) || form[k])
  const valid = form.name.trim() && form.type && form.track.trim()

  const save = async () => {
    const doc = form.doc.trim()
    const sol = form.solution.trim()
    for (const u of [doc, sol]) if (u && !/^https?:\/\//i.test(u)) return setError('Links must start with https://')
    setBusy(true)
    setError('')
    try {
      // Track: an existing one by name, or a new one; the CSM is stored on the track (applies to all its items).
      const track = chosenTrack ?? (await findOrCreateTrack(content.client_id, form.track))
      const csm = form.csm.trim() || null
      if ((chosenTrack?.csm ?? null) !== csm || !chosenTrack)
        must(await supabase.from('tracks').update({ csm }).eq('id', track.id).select('id'))

      const extra: Record<string, unknown> = { ...x }
      for (const [k] of EXTRA_FIELDS) {
        if (form[k].trim()) extra[k] = form[k].trim()
        else delete extra[k]
      }
      // Links: a changed Doc / Solution link is marked manual so the sheet sync keeps it.
      const links: Links = { ...links0 }
      const changed = doc !== (links0.doc ?? '') || sol !== (links0.solution ?? '')
      if (doc) Object.assign(links, { doc, doc_kind: linkKind(doc) })
      else {
        delete links.doc
        delete links.doc_kind
      }
      if (sol) links.solution = sol
      else delete links.solution
      if (changed) Object.assign(links, { manual: true, source: { manual: true, date: new Date().toISOString().slice(0, 10) } })
      if (links.doc || links.solution) extra.links = links
      else delete extra.links

      must(
        await supabase
          .from('contents')
          .update({
            track_id: track.id,
            content_type: form.type,
            sequence_label: form.day.trim() || null,
            name: form.name.trim(),
            delivery_date: form.date || null,
            notes: form.notes.trim() || null,
            extra,
          })
          .eq('id', content.id)
          .select('id'),
      )

      // Topics: add / remove links as ticked.
      const before = new Set(content.topics.map((t) => t.toc_row_id))
      const add = [...linked.filter((id) => !before.has(id)), ...(await createPending())]
      const remove = [...before].filter((id) => !linked.includes(id))
      if (add.length)
        must(await supabase.from('content_toc_links').insert(add.map((toc_row_id) => ({ content_id: content.id, toc_row_id }))).select('content_id'))
      if (remove.length)
        must(await supabase.from('content_toc_links').delete().eq('content_id', content.id).in('toc_row_id', remove).select('content_id'))
      onSaved(content.id)
    } catch (e) {
      const m = (e as Error).message
      setError(m.includes('contents_identity') ? 'Another item in this track already has this type, day and name.' : m)
    } finally {
      setBusy(false)
    }
  }

  /** Typed topics go into the client's hand-written topic list ("(Added manually)", created if missing) on Save. */
  const createPending = async (): Promise<number[]> => {
    if (!pending.length) return []
    type F = { id: number; sheet_name: string }
    const files: F[] = must(
      await supabase.from('toc_files').select('id,sheet_name').eq('client_id', content.client_id).eq('file_name', '(Added manually)').order('id'),
    )
    const file: F =
      files[0] ??
      must(
        await supabase
          .from('toc_files')
          .insert({
            client_id: content.client_id,
            file_name: '(Added manually)',
            sheet_name: `${content.client_name} topics`,
            header_row: 1,
            columns: [{ letter: 'A', header: 'Topic' }],
            topic_column: 'A',
            notes: 'Topics typed in the portal (no TOC file).',
          })
          .select('id,sheet_name')
          .single(),
      )
    const last = must(
      await supabase.from('toc_rows').select('row_number').eq('toc_file_id', file.id).order('row_number', { ascending: false }).limit(1),
    )
    let n = last[0]?.row_number ?? 1
    const made: { id: number }[] = must(
      await supabase
        .from('toc_rows')
        .insert(pending.map((topic) => ({ toc_file_id: file.id, row_number: ++n, topic, data: { Topic: topic } })))
        .select('id'),
    )
    return made.map((m) => m.id)
  }

  const addNewTopic = () => {
    const topic = newTopic.trim()
    if (topic && !pending.includes(topic)) setPending((p) => [...p, topic])
    setNewTopic('')
  }

  const remove = async () => {
    setBusy(true)
    try {
      must(await supabase.from('contents').delete().eq('id', content.id).select('id'))
      onDeleted(content.id)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel card stack edit-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="form-row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Edit content</h2>
          <button className="small" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="form-grid">
          <label>
            Client
            <input value={content.client_name} disabled title="The client cannot be changed here (topics belong to it)" />
          </label>
          <label>
            Track
            <ComboInput value={form.track} onChange={(v) => set('track', v)} options={tracks.map((t) => t.name)} />
            {form.track.trim() && !chosenTrack && <span className="small hint">New track will be created</span>}
          </label>
          <label>
            CSM
            <input
              value={form.csm}
              onChange={(e) => {
                setCsmTouched(true)
                set('csm', e.target.value)
              }}
            />
            <span className="small hint">Applies to the whole track</span>
          </label>
          <label>
            Type
            <select value={form.type} onChange={(e) => set('type', e.target.value)}>
              {types.map((t) => (
                <option key={t.name}>{t.name}</option>
              ))}
            </select>
          </label>
          <label>
            Day
            <input value={form.day} placeholder="e.g. 3, 1-3, a topic name" onChange={(e) => set('day', e.target.value)} />
          </label>
          <label>
            Date
            <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </label>
          <label className="span-3">
            Content name
            <input value={form.name} onChange={(e) => set('name', e.target.value)} />
          </label>
          <label className="span-2">
            Doc link
            <input type="url" value={form.doc} placeholder="Drive folder / Google Doc" onChange={(e) => set('doc', e.target.value)} />
          </label>
          <label>
            Solution link
            <input type="url" value={form.solution} onChange={(e) => set('solution', e.target.value)} />
          </label>
          {extrasShown.map(([k, l, hint]) => (
            <label key={k}>
              {l}
              <input value={form[k]} placeholder={hint} onChange={(e) => set(k, e.target.value)} />
            </label>
          ))}
          <label className="span-3">
            Notes
            <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </label>
        </div>
        {extrasShown.length < EXTRA_FIELDS.length && (
          <button className="small link-like" onClick={() => setAllFields(true)}>
            Show all fields (Course, Proficiency, Assessment, Project, Week, Participant)
          </button>
        )}

        <section className="stack topic-edit">
          <h3 style={{ margin: 0 }}>Topics ({linked.length + pending.length})</h3>
          {linked.length + pending.length > 0 && (
            <div className="chips">
              {pending.map((p) => (
                <span className="chip" key={`new-${p}`} title="New topic, created when you save">
                  {p} <span className="muted small">(new)</span>{' '}
                  <button className="chip-x" title="Remove this topic" onClick={() => setPending((l) => l.filter((v) => v !== p))}>
                    ×
                  </button>
                </span>
              ))}
              {linked.map((id) => {
                const o = byId.get(id)
                const t = content.topics.find((tt) => tt.toc_row_id === id)
                return (
                  <span className="chip" key={id} title={o ? `${o.file_name} / ${o.sheet_name}` : undefined}>
                    {o ? label(o) : t?.topic ?? `#${id}`}{' '}
                    <button className="chip-x" title="Remove this topic" onClick={() => setLinked((l) => l.filter((v) => v !== id))}>
                      ×
                    </button>
                  </span>
                )
              })}
            </div>
          )}
          <input type="search" placeholder="Find a topic of this client to add…" value={find} onChange={(e) => setFind(e.target.value)} />
          {matches.length > 0 && (
            <ul className="topic-matches">
              {matches.map((o) => (
                <li key={o.id}>
                  <button
                    className="small"
                    onClick={() => {
                      setLinked((l) => [...l, o.id])
                      setFind('')
                    }}
                  >
                    + Add
                  </button>{' '}
                  {label(o)} <span className="muted small">— {o.sheet_name}</span>
                </li>
              ))}
            </ul>
          )}
          {find && !matches.length && options.length > 0 && <p className="muted small">No matching topic for this client.</p>}
          <div className="form-row">
            <input
              className="grow"
              placeholder="…or type a new topic (no TOC needed)"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addNewTopic()}
            />
            <button className="small" disabled={!newTopic.trim()} onClick={addNewTopic}>
              Add new topic
            </button>
          </div>
        </section>

        {error && <p className="error-text">{error}</p>}
        <div className="form-row" style={{ justifyContent: 'space-between' }}>
          <div className="form-row">
            <button className="primary" disabled={busy || !valid} onClick={save}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button disabled={busy} onClick={onClose}>
              Cancel
            </button>
          </div>
          {confirmDelete ? (
            <div className="form-row">
              <span className="small">Delete this item for good?</span>
              <button className="danger" disabled={busy} onClick={remove}>
                Yes, delete
              </button>
              <button className="small" onClick={() => setConfirmDelete(false)}>
                No
              </button>
            </div>
          ) : (
            <button className="danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
