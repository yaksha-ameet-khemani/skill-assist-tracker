import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { cellRef, Message, useLookups } from '../components/common'
import { fetchAll, must, supabase, type TocFile, type TocRow } from '../lib/supabase'
import { RowDetails } from './ContentDetail'

export function Topics() {
  const { clients } = useLookups()
  const [params, setParams] = useSearchParams()
  const [files, setFiles] = useState<TocFile[]>([])
  const [rows, setRows] = useState<TocRow[] | null>(null)
  const [error, setError] = useState('')

  const clientId = Number(params.get('client')) || 0
  const fileId = Number(params.get('file')) || 0
  const used = params.get('used') ?? ''
  const q = params.get('q') ?? ''

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    if (k === 'client') next.delete('file')
    setParams(next, { replace: true })
  }

  async function load() {
    try {
      const [f, r] = await Promise.all([
        fetchAll<TocFile>(() => supabase.from('v_toc_files').select('*').order('client_name').order('file_name')),
        fetchAll<TocRow>(() => supabase.from('v_toc_rows').select('*').order('toc_file_id').order('row_number')),
      ])
      setFiles(f)
      setRows(r)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    if (!rows) return []
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return rows.filter((r) => {
      if (clientId && r.client_id !== clientId) return false
      if (fileId && r.toc_file_id !== fileId) return false
      if (used === 'yes' && !r.content_count) return false
      if (used === 'no' && r.content_count) return false
      if (words.length) {
        const hay = `${r.topic} ${r.day_label} ${Object.values(r.data).join(' ')} ${r.contents.map((c) => c.name).join(' ')}`.toLowerCase()
        if (!words.every((w) => hay.includes(w))) return false
      }
      return true
    })
  }, [rows, clientId, fileId, used, q])

  async function deleteFile(f: TocFile) {
    if (!window.confirm(`Delete TOC “${f.file_name} › ${f.sheet_name}” and its ${f.row_count} rows? Content stays, but loses its links to these rows.`))
      return
    try {
      must(await supabase.from('toc_files').delete().eq('id', f.id))
      if (fileId === f.id) setParam('file', '')
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const clientFiles = files.filter((f) => !clientId || f.client_id === clientId)

  return (
    <div className="page stack">
      <header className="page-head">
        <div>
          <h1>TOC topics</h1>
          <p className="muted">
            Search every uploaded TOC. For each topic you see the content already built on it, so similar requests can
            reuse it.
          </p>
        </div>
        <Link className="button primary" to="/toc/upload">
          Upload TOC
        </Link>
      </header>

      <details className="card">
        <summary>
          <b>Uploaded TOC sheets ({clientFiles.length})</b>
        </summary>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Client</th>
                <th>Track</th>
                <th>File › sheet</th>
                <th>Rows</th>
                <th>Uploaded</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clientFiles.map((f) => (
                <tr key={f.id}>
                  <td>{f.client_name}</td>
                  <td>{f.track_name}</td>
                  <td>
                    <a href={`?file=${f.id}`} onClick={(e) => (e.preventDefault(), setParam('file', String(f.id)))}>
                      {f.file_name} › {f.sheet_name}
                    </a>
                    {f.source_link && <div className="small muted">{f.source_link}</div>}
                  </td>
                  <td>{f.row_count}</td>
                  <td className="nowrap">{f.created_at.slice(0, 10)}</td>
                  <td>
                    <button className="small danger" onClick={() => deleteFile(f)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="filters">
        <input
          type="search"
          className="grow"
          placeholder="Search topics, sub-topics, labs (e.g. Spring Security JWT)"
          value={q}
          onChange={(e) => setParam('q', e.target.value)}
        />
        <select value={clientId || ''} onChange={(e) => setParam('client', e.target.value)}>
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={fileId || ''} onChange={(e) => setParam('file', e.target.value)}>
          <option value="">All TOC sheets</option>
          {clientFiles.map((f) => (
            <option key={f.id} value={f.id}>
              {f.file_name} › {f.sheet_name}
            </option>
          ))}
        </select>
        <select value={used} onChange={(e) => setParam('used', e.target.value)}>
          <option value="">Used or not</option>
          <option value="yes">Has content</option>
          <option value="no">No content yet</option>
        </select>
      </div>

      <Message kind="error">{error}</Message>
      {rows === null && !error && <p className="muted">Loading…</p>}
      <p className="muted small">{filtered.length} TOC rows</p>

      {filtered.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Client · track</th>
                <th>Source</th>
                <th>Day</th>
                <th>Topic</th>
                <th>Content built on it</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 500).map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.client_name}
                    {r.track_name && <div className="small muted">{r.track_name}</div>}
                  </td>
                  <td className="small">
                    {r.file_name} › {r.sheet_name} › <span className="ref">{cellRef(r)}</span>
                  </td>
                  <td className="nowrap">{r.day_label}</td>
                  <td>
                    <div className="strong">{r.topic}</div>
                    <RowDetails data={r.data} />
                  </td>
                  <td>
                    {r.contents.length ? (
                      <ul className="topic-list">
                        {r.contents.map((c) => (
                          <li key={c.id}>
                            <Link to={`/content/${c.id}`}>{c.name}</Link>{' '}
                            <span className="small muted">
                              {c.content_type}
                              {c.sequence_label ? ` ${c.sequence_label}` : ''}
                              {c.client_name !== r.client_name ? ` · ${c.client_name}` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="muted small">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 500 && <p className="muted small">Showing first 500. Narrow the search to see more.</p>}
        </div>
      )}
    </div>
  )
}
