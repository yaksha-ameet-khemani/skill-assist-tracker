import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { cellRef, ComboInput, Message, useLookups } from '../components/common'
import {
  fetchAll,
  findOrCreateClient,
  findOrCreateTrack,
  must,
  supabase,
  type ContentRow,
  type TocFile,
  type TocRow,
} from '../lib/supabase'

type Form = {
  clientName: string
  trackName: string
  content_type: string
  sequence_label: string
  name: string
  delivery_date: string
  notes: string
}

const EMPTY: Form = { clientName: '', trackName: '', content_type: '', sequence_label: '', name: '', delivery_date: '', notes: '' }

export function ContentDetail() {
  const { id } = useParams()
  const isNew = id === 'new'
  const contentId = isNew ? 0 : Number(id)
  const navigate = useNavigate()
  const { clients, tracks, types, reload: reloadLookups } = useLookups()

  const [content, setContent] = useState<ContentRow | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [form, setForm] = useState<Form>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    if (isNew) return
    const c = must(await supabase.from('v_contents').select('*').eq('id', contentId).maybeSingle()) as ContentRow | null
    setContent(c)
    setNotFound(!c)
    if (c)
      setForm({
        clientName: c.client_name,
        trackName: c.track_name ?? '',
        content_type: c.content_type,
        sequence_label: c.sequence_label ?? '',
        name: c.name,
        delivery_date: c.delivery_date ?? '',
        notes: c.notes ?? '',
      })
  }, [contentId, isNew])

  useEffect(() => {
    load().catch((e) => setMsg({ kind: 'error', text: e.message }))
  }, [load])

  const client = clients.find((c) => c.name.toLowerCase() === form.clientName.trim().toLowerCase())
  const clientTracks = tracks.filter((t) => t.client_id === client?.id)

  async function save() {
    setBusy(true)
    setMsg(null)
    try {
      const cl = await findOrCreateClient(form.clientName)
      const tr = form.trackName.trim() ? await findOrCreateTrack(cl.id, form.trackName) : null
      const record = {
        client_id: cl.id,
        track_id: tr?.id ?? null,
        content_type: form.content_type,
        sequence_label: form.sequence_label.trim() || null,
        name: form.name.trim(),
        delivery_date: form.delivery_date || null,
        notes: form.notes.trim() || null,
      }
      if (isNew) {
        const saved = must<{ id: number }>(await supabase.from('contents').insert(record).select('id').single())
        await reloadLookups()
        navigate(`/content/${saved.id}`, { replace: true })
      } else {
        must(await supabase.from('contents').update(record).eq('id', contentId))
        await reloadLookups()
        await load()
        setMsg({ kind: 'ok', text: 'Saved.' })
      }
    } catch (e) {
      const m = (e as Error).message
      setMsg({ kind: 'error', text: m.includes('contents_identity') ? 'This content already exists (same client, track, type, day and name).' : m })
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Delete “${form.name}”? Its TOC links are deleted too.`)) return
    try {
      must(await supabase.from('contents').delete().eq('id', contentId))
      navigate('/content')
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message })
    }
  }

  async function unlink(tocRowId: number) {
    must(await supabase.from('content_toc_links').delete().eq('content_id', contentId).eq('toc_row_id', tocRowId))
    await load()
  }

  const valid = form.clientName.trim() && form.name.trim() && form.content_type

  return (
    <div className="page stack">
      <p>
        <Link to="/content">← All content</Link>
      </p>
      <h1>{isNew ? 'Add content' : form.name || 'Content'}</h1>
      {!isNew && content === null && <p className="muted">{notFound ? 'This content does not exist (it may have been deleted).' : 'Loading…'}</p>}

      <section className="card stack">
        <div className="form-grid">
          <label>
            Client *
            <ComboInput value={form.clientName} onChange={(v) => setForm({ ...form, clientName: v })} options={clients.map((c) => c.name)} />
          </label>
          <label>
            Track
            <ComboInput value={form.trackName} onChange={(v) => setForm({ ...form, trackName: v })} options={clientTracks.map((t) => t.name)} />
          </label>
          <label>
            Type *
            <select value={form.content_type} onChange={(e) => setForm({ ...form, content_type: e.target.value })}>
              <option value="">— choose —</option>
              {types.map((t) => (
                <option key={t.name}>{t.name}</option>
              ))}
            </select>
          </label>
          <label>
            Day / milestone no.
            <input value={form.sequence_label} onChange={(e) => setForm({ ...form, sequence_label: e.target.value })} />
          </label>
          <label className="span-2">
            Content name *
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Date
            <input type="date" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} />
          </label>
          <label className="span-3">
            Notes
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
        </div>
        <div className="form-row">
          <button className="primary" disabled={busy || !valid} onClick={save}>
            {busy ? 'Saving…' : isNew ? 'Create' : 'Save changes'}
          </button>
          {!isNew && (
            <button className="danger" onClick={remove}>
              Delete
            </button>
          )}
        </div>
        {msg && <Message kind={msg.kind}>{msg.text}</Message>}
      </section>

      {!isNew && content && (
        <section className="card stack">
          <h2>Based on TOC topics ({content.topics.length})</h2>
          {content.topics.length === 0 && <p className="muted">Not linked yet. Pick the TOC rows below.</p>}
          {content.topics.length > 0 && (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>TOC file › sheet</th>
                    <th>Cell</th>
                    <th>Day</th>
                    <th>Topic and details</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {content.topics.map((t) => (
                    <tr key={t.toc_row_id}>
                      <td className="small">
                        {t.file_name} › {t.sheet_name}
                      </td>
                      <td className="ref">{cellRef(t)}</td>
                      <td>{t.day_label}</td>
                      <td>
                        <div className="strong">{t.topic}</div>
                        <RowDetails data={t.data} />
                      </td>
                      <td>
                        <button className="small" onClick={() => unlink(t.toc_row_id)}>
                          Unlink
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <LinkPicker
            clientId={content.client_id}
            trackId={content.track_id}
            contentId={content.id}
            linkedIds={new Set(content.topics.map((t) => t.toc_row_id))}
            onLinked={load}
          />
        </section>
      )}
    </div>
  )
}

export function RowDetails({ data }: { data: Record<string, string> }) {
  const entries = Object.entries(data)
  if (!entries.length) return null
  return (
    <details className="row-details">
      <summary className="small muted">All columns ({entries.length})</summary>
      <dl>
        {entries.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

function LinkPicker(props: {
  clientId: number
  trackId: number | null
  contentId: number
  linkedIds: Set<number>
  onLinked: () => Promise<void>
}) {
  const [files, setFiles] = useState<TocFile[]>([])
  const [fileId, setFileId] = useState<number | ''>('')
  const [rows, setRows] = useState<TocRow[]>([])
  const [q, setQ] = useState('')
  const [chosen, setChosen] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('v_toc_files')
      .select('*')
      .eq('client_id', props.clientId)
      .order('file_name')
      .then((res) => {
        const list: TocFile[] = res.data ?? []
        setFiles(list)
        setFileId(list.find((f) => f.track_id === props.trackId)?.id ?? (list.length === 1 ? list[0].id : ''))
      })
  }, [props.clientId, props.trackId])

  useEffect(() => {
    setChosen(new Set())
    if (!fileId) {
      setRows([])
      return
    }
    fetchAll<TocRow>(() => supabase.from('v_toc_rows').select('*').eq('toc_file_id', fileId).order('row_number'))
      .then(setRows)
      .catch((e) => setError(e.message))
  }, [fileId])

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return rows.filter((r) => {
      const hay = `${r.row_number} ${r.day_label} ${r.topic} ${Object.values(r.data).join(' ')}`.toLowerCase()
      return words.every((w) => hay.includes(w))
    })
  }, [rows, q])

  async function linkChosen() {
    try {
      must(
        await supabase
          .from('content_toc_links')
          .upsert([...chosen].map((toc_row_id) => ({ content_id: props.contentId, toc_row_id })), { ignoreDuplicates: true }),
      )
      setChosen(new Set())
      await props.onLinked()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="stack link-picker">
      <h3>Link more TOC rows</h3>
      {files.length === 0 ? (
        <p className="muted">
          No TOC uploaded for this client yet. <Link to="/toc/upload">Upload one</Link>.
        </p>
      ) : (
        <>
          <div className="form-row">
            <select value={fileId} onChange={(e) => setFileId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">— choose TOC —</option>
              {files.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.file_name} › {f.sheet_name}
                  {f.track_name ? ` (${f.track_name})` : ''}
                </option>
              ))}
            </select>
            <input type="search" className="grow" placeholder="Filter rows (e.g. day 3, JWT)" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="primary" disabled={!chosen.size} onClick={linkChosen}>
              Link {chosen.size || ''} selected
            </button>
          </div>
          <Message kind="error">{error}</Message>
          {fileId !== '' && (
            <div className="table-wrap short">
              <table className="data">
                <tbody>
                  {shown.map((r) => {
                    const already = props.linkedIds.has(r.id)
                    return (
                      <tr key={r.id} className={already ? 'muted' : undefined}>
                        <td>
                          <input
                            type="checkbox"
                            disabled={already}
                            checked={already || chosen.has(r.id)}
                            onChange={(e) => {
                              const next = new Set(chosen)
                              if (e.target.checked) next.add(r.id)
                              else next.delete(r.id)
                              setChosen(next)
                            }}
                          />
                        </td>
                        <td className="ref">{cellRef(r)}</td>
                        <td className="nowrap">{r.day_label}</td>
                        <td>
                          {r.topic}
                          {r.content_count > 0 && <span className="badge"> used by {r.content_count}</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
