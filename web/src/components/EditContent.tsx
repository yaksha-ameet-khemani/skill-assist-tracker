import { useEffect, useMemo, useState } from 'react'
import { ComboInput } from './common'
import { fetchAll, findOrCreateClient, findOrCreateTrack, must, supabase, type ContentRow, type ContentType } from '../lib/supabase'

/** Optional per-item fields shown as extra home-page columns (stored in contents.extra). Week has its own checkbox. */
const EXTRA_FIELDS: [key: string, label: string, hint: string][] = [
  ['course', 'Course', 'e.g. the course or skill the item belongs to'],
  ['proficiency', 'Proficiency', 'e.g. L3'],
  ['assessment', 'Assessment', 'Actual / Re-attempt / Final – Actual / Final – Re-attempt'],
  ['project', 'Project', 'e.g. Incremental Project 1'],
  ['participant', 'Participant', 'person the assessment was made for'],
]

type ClientRow = { id: number; name: string }
type TrackRow = { id: number; name: string; csm: string | null }
type TopicOption = { id: number; topic: string | null; day_label: string | null; sheet_name: string; file_name: string; module: string; text: string }
type Links = { doc?: string; doc_kind?: string; solution?: string; manual?: boolean; [k: string]: unknown }

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

function linkKind(url: string): string {
  if (url.includes('/drive/folders/')) return 'folder'
  if (url.includes('docs.google.com/document')) return 'doc'
  if (url.includes('docs.google.com/spreadsheets')) return 'sheet'
  return 'file'
}

/**
 * Popup to add a new content item (no `content`) or edit one: client (add only; a new name creates the client), track
 * (a new name creates the track), the track's CSM, type, day, name, date, Doc / Solution links, Week (only when "Has
 * week" is ticked), the optional extra columns, notes and the linked topics (pick from the client's TOCs or type a new
 * topic, which goes into the client's hand-written topic list). When editing, the client is fixed: topics belong to it.
 */
export function EditContent({
  content,
  defaults,
  usedExtrasFor,
  onClose,
  onSaved,
  onDeleted,
}: {
  /** The item to edit; leave out to add a new one. */
  content?: ContentRow
  /** Pre-filled values when adding (the client / track the home page is filtered on). */
  defaults?: { client?: string; track?: string }
  /** Extra fields a client already uses; others are behind "Show all fields". */
  usedExtrasFor: (client: string) => Set<string>
  onClose: () => void
  /** Called after a save; `keepOpen` = "Save & add another" (the popup stays open for the next item). */
  onSaved: (id: number, keepOpen?: boolean) => void
  onDeleted: (id: number) => void
}) {
  const isNew = !content
  const x = content?.extra ?? {}
  const links0 = (x.links && typeof x.links === 'object' ? x.links : {}) as Links
  const [clients, setClients] = useState<ClientRow[]>([])
  const [tracks, setTracks] = useState<TrackRow[]>([])
  const [types, setTypes] = useState<ContentType[]>([])
  const [options, setOptions] = useState<TopicOption[]>([])
  const blank = (keep: Record<string, string> = {}) =>
    ({
      client: content?.client_name ?? defaults?.client ?? '',
      track: content?.track_name ?? defaults?.track ?? '',
      csm: content?.csm ?? '',
      type: content?.content_type ?? '',
      day: content?.sequence_label ?? '',
      name: content?.name ?? '',
      date: content?.delivery_date ?? '',
      notes: content?.notes ?? '',
      doc: links0.doc ?? '',
      solution: links0.solution ?? '',
      week: str(x.week),
      ...Object.fromEntries(EXTRA_FIELDS.map(([k]) => [k, str(x[k])])),
      ...keep,
    }) as Record<string, string>
  const [form, setForm] = useState(blank)
  const [hasWeek, setHasWeek] = useState(!!str(x.week))
  const [linked, setLinked] = useState<number[]>(content?.topics.map((t) => t.toc_row_id) ?? [])
  const [find, setFind] = useState('')
  const [newTopic, setNewTopic] = useState('')
  // Typed topics wait here until Save (so Cancel leaves nothing behind).
  const [pending, setPending] = useState<string[]>([])
  const [allFields, setAllFields] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  // Client: fixed when editing; when adding, an existing client by name (or none yet = a new client).
  const chosenClient: ClientRow | undefined = content
    ? { id: content.client_id, name: content.client_name }
    : clients.find((c) => same(c.name, form.client))
  const clientId = chosenClient?.id

  useEffect(() => {
    Promise.all([
      supabase.from('content_types').select('name,sort_order').order('sort_order'),
      supabase.from('clients').select('id,name').order('name'),
    ])
      .then(([ty, cl]) => {
        const t: ContentType[] = must(ty)
        setTypes(t)
        setClients(must(cl))
        setForm((f) => (f.type ? f : { ...f, type: t.find((v) => v.name === 'Daily Assignment')?.name ?? t[0]?.name ?? '' }))
      })
      .catch((e) => setError(e.message))
  }, [])

  // Tracks and topics of the chosen client.
  useEffect(() => {
    if (!clientId) {
      setTracks([])
      setOptions([])
      return
    }
    ;(async () => {
      setTracks(must(await supabase.from('tracks').select('id,name,csm').eq('client_id', clientId).order('name')))
      const rows = await fetchAll<Omit<TopicOption, 'module' | 'text'> & { data: Record<string, unknown>; data_text: string | null }>(() =>
        supabase
          .from('v_toc_rows')
          .select('id,topic,day_label,sheet_name,file_name,data,data_text')
          .eq('client_id', clientId)
          .order('toc_file_id')
          .order('row_number'),
      )
      setOptions(
        rows.map((r) => ({ ...r, module: str(r.data?.Module ?? r.data?.['Module Title'] ?? r.data?.Skill), text: (r.data_text ?? '').toLowerCase() })),
      )
    })().catch((e) => setError(e.message))
  }, [clientId])

  // Switching client when adding: topics belong to a client, so picked ones are dropped.
  useEffect(() => {
    if (isNew) setLinked([])
  }, [clientId, isNew])

  // The CSM box follows the chosen track until it is edited.
  const [csmTouched, setCsmTouched] = useState(false)
  const chosenTrack = tracks.find((t) => same(t.name, form.track))
  useEffect(() => {
    if (!csmTouched) set('csm', chosenTrack?.csm ?? (isNew ? '' : form.csm))
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

  const usedExtras = usedExtrasFor(chosenClient?.name ?? form.client)
  const extrasShown = EXTRA_FIELDS.filter(([k]) => allFields || usedExtras.has(k) || form[k])
  const valid = form.client.trim() && form.name.trim() && form.type && form.track.trim() && (!hasWeek || form.week.trim())

  /** Saves; returns the item id, or null when it failed (the error is shown). */
  const save = async (): Promise<number | null> => {
    const doc = form.doc.trim()
    const sol = form.solution.trim()
    for (const u of [doc, sol]) if (u && !/^https?:\/\//i.test(u)) return (setError('Links must start with https://'), null)
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const client = chosenClient ?? (await findOrCreateClient(form.client))
      // Track: an existing one by name, or a new one; the CSM is stored on the track (applies to all its items).
      const track = chosenTrack ?? (await findOrCreateTrack(client.id, form.track))
      const csm = form.csm.trim() || null
      if ((chosenTrack?.csm ?? null) !== csm || !chosenTrack)
        must(await supabase.from('tracks').update({ csm }).eq('id', track.id).select('id'))

      const extra: Record<string, unknown> = { ...x }
      for (const [k] of EXTRA_FIELDS) {
        if (form[k].trim()) extra[k] = form[k].trim()
        else delete extra[k]
      }
      if (hasWeek && form.week.trim()) extra.week = form.week.trim()
      else delete extra.week
      // Links: a new / changed Doc or Solution link is marked manual so the sheet sync keeps it.
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
      if (isNew) extra.source = { portal: true, date: new Date().toISOString().slice(0, 10) }

      const fields = {
        track_id: track.id,
        content_type: form.type,
        sequence_label: form.day.trim() || null,
        name: form.name.trim(),
        delivery_date: form.date || null,
        notes: form.notes.trim() || null,
        extra,
      }
      const id: number = content
        ? (must(await supabase.from('contents').update(fields).eq('id', content.id).select('id')), content.id)
        : must(await supabase.from('contents').insert({ ...fields, client_id: client.id }).select('id').single()).id

      // Topics: add / remove links as ticked.
      const before = new Set(content?.topics.map((t) => t.toc_row_id) ?? [])
      const add = [...linked.filter((t) => !before.has(t)), ...(await createPending(client))]
      const remove = [...before].filter((t) => !linked.includes(t))
      if (add.length)
        must(await supabase.from('content_toc_links').insert(add.map((toc_row_id) => ({ content_id: id, toc_row_id }))).select('content_id'))
      if (remove.length) must(await supabase.from('content_toc_links').delete().eq('content_id', id).in('toc_row_id', remove).select('content_id'))
      if (!chosenClient) setClients((c) => [...c, client])
      return id
    } catch (e) {
      const m = (e as Error).message
      setError(m.includes('contents_identity') ? 'Another item in this track already has this type, day and name.' : m)
      return null
    } finally {
      setBusy(false)
    }
  }

  /** "Save & add another": keeps client, track, CSM, type, date and Week; clears the rest. */
  const saveAndNext = async () => {
    const id = await save()
    if (id == null) return
    onSaved(id, true)
    const keep = { client: form.client, track: form.track, csm: form.csm, type: form.type, date: form.date, week: form.week }
    setForm(blank(keep))
    setLinked([])
    setPending([])
    setFind('')
    setNotice(`Saved “${form.name.trim()}”. Add the next one.`)
  }

  /** Typed topics go into the client's hand-written topic list ("(Added manually)", created if missing) on Save. */
  const createPending = async (client: ClientRow): Promise<number[]> => {
    if (!pending.length) return []
    type F = { id: number; sheet_name: string }
    const files: F[] = must(
      await supabase.from('toc_files').select('id,sheet_name').eq('client_id', client.id).eq('file_name', '(Added manually)').order('id'),
    )
    const file: F =
      files[0] ??
      must(
        await supabase
          .from('toc_files')
          .insert({
            client_id: client.id,
            file_name: '(Added manually)',
            sheet_name: `${client.name} topics`,
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
    if (!content) return
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
          <h2 style={{ margin: 0 }}>{isNew ? 'Add content' : 'Edit content'}</h2>
          <button className="small" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="form-grid">
          <label>
            Client
            {isNew ? (
              <>
                <ComboInput value={form.client} onChange={(v) => set('client', v)} options={clients.map((c) => c.name)} />
                {form.client.trim() && !chosenClient && clients.length > 0 && <span className="small hint">New client will be created</span>}
              </>
            ) : (
              <input value={form.client} disabled title="The client cannot be changed here (topics belong to it)" />
            )}
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
          <div className="week-field">
            <label className="check">
              <input type="checkbox" checked={hasWeek} onChange={(e) => setHasWeek(e.target.checked)} /> Has week
            </label>
            <input
              aria-label="Week"
              value={form.week}
              disabled={!hasWeek}
              placeholder={hasWeek ? 'e.g. Week 2' : 'Tick “Has week” to fill'}
              title={hasWeek ? undefined : 'Tick “Has week” if this item belongs to a week'}
              onChange={(e) => set('week', e.target.value)}
            />
          </div>
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
            Show all fields (Course, Proficiency, Assessment, Project, Participant)
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
                const t = content?.topics.find((tt) => tt.toc_row_id === id)
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
          <input
            type="search"
            placeholder={clientId ? 'Find a topic of this client to add…' : 'Pick an existing client to search its topics…'}
            disabled={!clientId}
            value={find}
            onChange={(e) => setFind(e.target.value)}
          />
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

        {notice && <p className="ok-text">{notice}</p>}
        {error && <p className="error-text">{error}</p>}
        <div className="form-row" style={{ justifyContent: 'space-between' }}>
          <div className="form-row">
            <button
              className="primary"
              disabled={busy || !valid}
              onClick={async () => {
                const id = await save()
                if (id != null) onSaved(id)
              }}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            {isNew && (
              <button disabled={busy || !valid} onClick={saveAndNext} title="Save, then start the next item with the same client, track, type and date">
                Save & add another
              </button>
            )}
            <button disabled={busy} onClick={onClose}>
              Cancel
            </button>
          </div>
          {!isNew &&
            (confirmDelete ? (
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
            ))}
        </div>
      </div>
    </div>
  )
}
