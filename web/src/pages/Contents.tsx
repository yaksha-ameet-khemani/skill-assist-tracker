import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { cellRef, Message, TopicList, useLookups } from '../components/common'
import { downloadXlsx } from '../lib/excel'
import { fetchAll, supabase, type ContentRow } from '../lib/supabase'

export function Contents() {
  const { clients, tracks, types } = useLookups()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [rows, setRows] = useState<ContentRow[] | null>(null)
  const [error, setError] = useState('')

  const clientId = Number(params.get('client')) || 0
  const trackId = Number(params.get('track')) || 0
  const type = params.get('type') ?? ''
  const linked = params.get('linked') ?? ''
  const q = params.get('q') ?? ''

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    if (k === 'client') next.delete('track')
    setParams(next, { replace: true })
  }

  useEffect(() => {
    fetchAll<ContentRow>(() =>
      supabase
        .from('v_contents')
        .select('*')
        .order('client_name')
        .order('track_name')
        .order('type_order')
        .order('id'),
    )
      .then(setRows)
      .catch((e) => setError(e.message))
  }, [])

  const filtered = useMemo(() => {
    if (!rows) return []
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    return rows.filter((r) => {
      if (clientId && r.client_id !== clientId) return false
      if (trackId && r.track_id !== trackId) return false
      if (type && r.content_type !== type) return false
      if (linked === 'yes' && !r.link_count) return false
      if (linked === 'no' && r.link_count) return false
      if (words.length) {
        const hay = [
          r.name,
          r.client_name,
          r.track_name,
          r.content_type,
          r.notes,
          ...r.topics.map((t) => `${t.topic} ${Object.values(t.data).join(' ')}`),
        ]
          .join(' ')
          .toLowerCase()
        if (!words.every((w) => hay.includes(w))) return false
      }
      return true
    })
  }, [rows, clientId, trackId, type, linked, q])

  const countsByType = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of filtered) m.set(r.content_type, (m.get(r.content_type) ?? 0) + 1)
    return types.filter((t) => m.has(t.name)).map((t) => [t.name, m.get(t.name)!] as const)
  }, [filtered, types])

  function exportExcel() {
    const flat: Record<string, unknown>[] = []
    for (const r of filtered) {
      const base = {
        Client: r.client_name,
        Track: r.track_name ?? '',
        Type: r.content_type,
        'Day / No.': r.sequence_label ?? '',
        'Content name': r.name,
        Date: r.delivery_date ?? '',
      }
      if (!r.topics.length) flat.push({ ...base, 'TOC file': '', 'TOC sheet': '', 'TOC cell': '', 'TOC day': '', 'TOC topic': '', 'TOC details': '' })
      for (const t of r.topics)
        flat.push({
          ...base,
          'TOC file': t.file_name,
          'TOC sheet': t.sheet_name,
          'TOC cell': cellRef(t),
          'TOC day': t.day_label ?? '',
          'TOC topic': t.topic ?? '',
          'TOC details': Object.entries(t.data)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n'),
        })
    }
    const summary = countsByType.map(([name, n]) => ({ Type: name, Count: n }))
    downloadXlsx(`skill-assist-content-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      { name: 'Content with TOC', rows: flat },
      { name: 'Counts', rows: summary },
    ])
  }

  const clientTracks = tracks.filter((t) => !clientId || t.client_id === clientId)

  return (
    <div className="page stack">
      <header className="page-head">
        <div>
          <h1>Content</h1>
          <p className="muted">Everything created on Skill Assist and the TOC topics each item is based on.</p>
        </div>
        <div className="form-row">
          <button onClick={exportExcel} disabled={!filtered.length}>
            Export to Excel
          </button>
          <Link className="button primary" to="/content/new">
            Add content
          </Link>
        </div>
      </header>

      <div className="filters">
        <input
          type="search"
          className="grow"
          placeholder="Search content names and TOC topics (e.g. JWT, Python, Terraform)"
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
        <select value={trackId || ''} onChange={(e) => setParam('track', e.target.value)}>
          <option value="">All tracks</option>
          {clientTracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select value={type} onChange={(e) => setParam('type', e.target.value)}>
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t.name}>{t.name}</option>
          ))}
        </select>
        <select value={linked} onChange={(e) => setParam('linked', e.target.value)}>
          <option value="">Linked or not</option>
          <option value="yes">Linked to TOC</option>
          <option value="no">Not linked yet</option>
        </select>
      </div>

      <div className="stats">
        <div className="stat">
          <span className="stat-n">{filtered.length}</span>
          <span className="stat-l">Total</span>
        </div>
        {countsByType.map(([name, n]) => (
          <div className="stat" key={name}>
            <span className="stat-n">{n}</span>
            <span className="stat-l">{name}</span>
          </div>
        ))}
      </div>

      <Message kind="error">{error}</Message>
      {rows === null && !error && <p className="muted">Loading…</p>}
      {rows && !rows.length && (
        <div className="empty">
          <p>No content yet.</p>
          <p className="muted">
            Start by <Link to="/toc/upload">uploading a TOC</Link>, then <Link to="/content/import">import your content list</Link>.
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="table-wrap">
          <table className="data clickable">
            <thead>
              <tr>
                <th>Client</th>
                <th>Track</th>
                <th>Type</th>
                <th>Day/No.</th>
                <th>Content name</th>
                <th>Date</th>
                <th>Based on TOC topics</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/content/${r.id}`)}>
                  <td>{r.client_name}</td>
                  <td>{r.track_name}</td>
                  <td className="nowrap">{r.content_type}</td>
                  <td>{r.sequence_label}</td>
                  <td className="strong">{r.name}</td>
                  <td className="nowrap">{r.delivery_date}</td>
                  <td>
                    <TopicList topics={r.topics} max={4} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
