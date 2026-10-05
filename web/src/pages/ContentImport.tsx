import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cellRef, ComboInput, Message, useLookups } from '../components/common'
import { SheetPicker, type PickedSheet } from '../components/SheetPicker'
import { cell, headerColumns, isMergeCopy, parseDateCell } from '../lib/excel'
import { dayNumber, guessContentType, parseRowList } from '../lib/match'
import {
  chunk,
  fetchAll,
  findOrCreateClient,
  findOrCreateTrack,
  must,
  supabase,
  type TocFile,
} from '../lib/supabase'

type Item = {
  row: number
  name: string
  track: string
  type: string | null
  typeRaw: string
  seq: string
  date: string | null
  tocRowsText: string
}

type TocRowLite = { id: number; row_number: number; day_label: string | null; topic: string | null }

type Mapping = {
  name: string
  trackCol: string
  trackFixed: string
  typeCol: string
  typeFixed: string
  seq: string
  date: string
  tocRows: string
}

const EMPTY_MAP: Mapping = { name: '', trackCol: '', trackFixed: '', typeCol: '', typeFixed: '', seq: '', date: '', tocRows: '' }

function guessMapping(cols: { letter: string; header: string }[]): Mapping {
  const find = (re: RegExp) => cols.find((c) => re.test(c.header))?.letter ?? ''
  return {
    ...EMPTY_MAP,
    name: find(/name|title/i) || find(/assignment|assessment/i),
    trackCol: find(/track|course|program|lp/i),
    typeCol: find(/type/i),
    seq: find(/^day$|^day\b|milestone|seq|^#$|^no\.?$/i),
    date: find(/date/i),
    tocRows: find(/toc|row/i),
  }
}

const key = (trackId: number | null, type: string, seq: string | null, name: string) =>
  `${trackId ?? ''}|${type}|${seq ?? ''}|${name}`

export function ContentImport() {
  const { clients, types, reload } = useLookups()
  const [clientName, setClientName] = useState('')
  const [picked, setPicked] = useState<PickedSheet | null>(null)
  const [map, setMap] = useState<Mapping>(EMPTY_MAP)
  const [startRow, setStartRow] = useState<number | ''>('')
  const [endRow, setEndRow] = useState<number | ''>('')
  const [tocFiles, setTocFiles] = useState<TocFile[]>([])
  const [trackFile, setTrackFile] = useState<Record<string, number | ''>>({})
  const [tocRows, setTocRows] = useState<Record<number, TocRowLite[]>>({})
  const [autoDay, setAutoDay] = useState(true)
  const [replaceLinks, setReplaceLinks] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: ReactNode } | null>(null)

  const client = clients.find((c) => c.name.toLowerCase() === clientName.trim().toLowerCase())
  const columns = useMemo(() => (picked ? headerColumns(picked.grid, picked.headerRow) : []), [picked])

  useEffect(() => {
    setMap(guessMapping(columns))
    setStartRow('')
    setEndRow('')
  }, [columns])

  // TOC files of the chosen client.
  const clientId = client?.id
  useEffect(() => {
    if (!clientId) {
      setTocFiles([])
      return
    }
    supabase
      .from('v_toc_files')
      .select('*')
      .eq('client_id', clientId)
      .order('file_name')
      .then((res) => setTocFiles(res.data ?? []))
  }, [clientId])

  const items: Item[] = useMemo(() => {
    if (!picked || !map.name) return []
    const from = startRow || picked.headerRow + 1
    const to = endRow || picked.grid.rows.length
    const out: Item[] = []
    for (let r = from; r <= to; r++) {
      const name = cell(picked.grid, r, map.name)
      if (!name || isMergeCopy(picked.grid, r, map.name)) continue
      const typeRaw = map.typeCol ? cell(picked.grid, r, map.typeCol) : map.typeFixed
      out.push({
        row: r,
        name,
        track: (map.trackCol ? cell(picked.grid, r, map.trackCol) : map.trackFixed).trim(),
        type: map.typeCol ? guessContentType(typeRaw, types.map((t) => t.name)) : map.typeFixed || null,
        typeRaw,
        seq: map.seq ? cell(picked.grid, r, map.seq) : '',
        date: map.date ? parseDateCell(picked.grid, r, map.date) : null,
        tocRowsText: map.tocRows ? cell(picked.grid, r, map.tocRows) : '',
      })
    }
    return out
  }, [picked, map, startRow, endRow, types])

  const distinctTracks = useMemo(() => [...new Set(items.map((i) => i.track))], [items])

  // Pre-select a TOC file per track when the names match (or when the client has only one TOC).
  useEffect(() => {
    setTrackFile((prev) => {
      const next = { ...prev }
      for (const t of distinctTracks) {
        if (next[t] !== undefined) continue
        const byTrack = tocFiles.find((f) => f.track_name && f.track_name.toLowerCase() === t.toLowerCase())
        next[t] = byTrack?.id ?? (tocFiles.length === 1 ? tocFiles[0].id : '')
      }
      return next
    })
  }, [distinctTracks, tocFiles])

  // Load TOC rows for every chosen file.
  useEffect(() => {
    const ids = [...new Set(Object.values(trackFile).filter((v): v is number => typeof v === 'number'))]
    for (const id of ids) {
      if (tocRows[id]) continue
      fetchAll<TocRowLite>(() =>
        supabase.from('toc_rows').select('id,row_number,day_label,topic').eq('toc_file_id', id).order('row_number'),
      ).then((rows) => setTocRows((prev) => ({ ...prev, [id]: rows })))
    }
  }, [trackFile, tocRows])

  function matchesFor(item: Item): { rows: TocRowLite[]; how: string; missing: number[] } {
    const fileId = trackFile[item.track]
    const rows = typeof fileId === 'number' ? tocRows[fileId] ?? [] : []
    if (!rows.length) return { rows: [], how: '', missing: [] }
    if (item.tocRowsText.trim()) {
      const wanted = parseRowList(item.tocRowsText)
      const found = rows.filter((r) => wanted.includes(r.row_number))
      return { rows: found, how: 'rows given', missing: wanted.filter((w) => !found.some((f) => f.row_number === w)) }
    }
    if (autoDay && item.type === 'Daily Assignment') {
      const n = dayNumber(item.seq)
      if (n != null) return { rows: rows.filter((r) => dayNumber(r.day_label) === n), how: `day ${n}`, missing: [] }
    }
    return { rows: [], how: '', missing: [] }
  }

  const matched = items.map((i) => ({ item: i, ...matchesFor(i) }))
  const invalid = matched.filter((m) => !m.item.type)
  const linkedCount = matched.filter((m) => m.rows.length).length
  const tocFileById = new Map(tocFiles.map((f) => [f.id, f]))

  async function save() {
    if (!clientName.trim() || !items.length || invalid.length) return
    setBusy(true)
    setMsg(null)
    try {
      const cl = await findOrCreateClient(clientName)
      const trackIds = new Map<string, number | null>()
      for (const t of distinctTracks) trackIds.set(t, t ? (await findOrCreateTrack(cl.id, t)).id : null)

      // Same item twice in one sheet → keep the last one.
      const byKey = new Map<string, (typeof matched)[number]>()
      for (const m of matched) byKey.set(key(trackIds.get(m.item.track) ?? null, m.item.type!, m.item.seq || null, m.item.name), m)
      const unique = [...byKey.values()]

      const idByKey = new Map<string, number>()
      for (const part of chunk(unique, 300)) {
        const saved = must(
          await supabase
            .from('contents')
            .upsert(
              part.map(({ item }) => ({
                client_id: cl.id,
                track_id: trackIds.get(item.track) ?? null,
                content_type: item.type!,
                sequence_label: item.seq || null,
                name: item.name,
                delivery_date: item.date,
                extra: { source: { file: picked!.fileName, sheet: picked!.sheetName, row: item.row } },
              })),
              { onConflict: 'client_id,track_id,content_type,sequence_label,name' },
            )
            .select('id,track_id,content_type,sequence_label,name'),
        )
        for (const s of saved) idByKey.set(key(s.track_id, s.content_type, s.sequence_label, s.name), s.id)
      }

      const links: { content_id: number; toc_row_id: number }[] = []
      const relinked: number[] = []
      for (const [k, m] of byKey) {
        const id = idByKey.get(k)
        if (!id || !m.rows.length) continue
        relinked.push(id)
        for (const r of m.rows) links.push({ content_id: id, toc_row_id: r.id })
      }
      if (replaceLinks) {
        for (const ids of chunk(relinked, 200)) must(await supabase.from('content_toc_links').delete().in('content_id', ids))
      }
      for (const part of chunk(links, 500)) {
        must(await supabase.from('content_toc_links').upsert(part, { ignoreDuplicates: true }))
      }

      await reload()
      setMsg({
        kind: 'ok',
        text: (
          <>
            Saved {unique.length} content items ({relinked.length} linked to TOC, {links.length} links).{' '}
            <Link to={`/content?client=${cl.id}`}>Open in Content</Link>
          </>
        ),
      })
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const colSelect = (value: string, onChange: (v: string) => void, required = false) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{required ? '— choose —' : '— none —'}</option>
      {columns.map((c) => (
        <option key={c.letter} value={c.letter}>
          {c.letter} · {c.header}
        </option>
      ))}
    </select>
  )

  const pickedRows = new Set(items.map((i) => i.row))

  return (
    <div className="page stack">
      <header>
        <h1>Import content</h1>
        <p className="muted">
          Read a list of created content from Excel and link each item to the TOC rows it is based on. Works on one block
          of columns at a time, so side-by-side tracks (like the Sony Priyanka sheet) can be imported block by block.
        </p>
      </header>

      <section className="card stack">
        <h2>1. Client</h2>
        <div className="form-row">
          <label>
            Client *
            <ComboInput value={clientName} onChange={setClientName} options={clients.map((c) => c.name)} placeholder="e.g. Sony" />
          </label>
          {client && <span className="muted">{tocFiles.length} TOC sheet(s) uploaded for this client.</span>}
          {clientName.trim() && !client && <span className="muted">New client, will be created on save.</span>}
        </div>
      </section>

      <section className="card stack">
        <h2>2. Content list file</h2>
        <SheetPicker onChange={setPicked} highlight={(r) => pickedRows.has(r)} />
      </section>

      {picked && columns.length > 0 && (
        <section className="card stack">
          <h2>3. Which columns to read</h2>
          <div className="form-grid">
            <label>
              Content name *{colSelect(map.name, (v) => setMap({ ...map, name: v }), true)}
            </label>
            <label>
              Track column{colSelect(map.trackCol, (v) => setMap({ ...map, trackCol: v }))}
            </label>
            {!map.trackCol && (
              <label>
                …or same track for all
                <input value={map.trackFixed} onChange={(e) => setMap({ ...map, trackFixed: e.target.value })} />
              </label>
            )}
            <label>
              Type column{colSelect(map.typeCol, (v) => setMap({ ...map, typeCol: v }))}
            </label>
            {!map.typeCol && (
              <label>
                …or same type for all *
                <select value={map.typeFixed} onChange={(e) => setMap({ ...map, typeFixed: e.target.value })}>
                  <option value="">— choose —</option>
                  {types.map((t) => (
                    <option key={t.name}>{t.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Day / milestone no.{colSelect(map.seq, (v) => setMap({ ...map, seq: v }))}
            </label>
            <label>
              Date{colSelect(map.date, (v) => setMap({ ...map, date: v }))}
            </label>
            <label>
              TOC row numbers (optional){colSelect(map.tocRows, (v) => setMap({ ...map, tocRows: v }))}
            </label>
            <label>
              First row
              <input
                type="number"
                placeholder={String(picked.headerRow + 1)}
                value={startRow}
                onChange={(e) => setStartRow(e.target.value ? Number(e.target.value) : '')}
              />
            </label>
            <label>
              Last row
              <input
                type="number"
                placeholder={String(picked.grid.rows.length)}
                value={endRow}
                onChange={(e) => setEndRow(e.target.value ? Number(e.target.value) : '')}
              />
            </label>
          </div>
          <p className="small muted">
            Rows with an empty content name are skipped. TOC row numbers can be written like <code>6</code>,{' '}
            <code>6, 8</code> or <code>6-13</code>.
          </p>
        </section>
      )}

      {items.length > 0 && (
        <section className="card stack">
          <h2>4. Link to TOC</h2>
          {!client && <p className="muted">Upload a TOC for this client first to link content. You can still save without links.</p>}
          {distinctTracks.map((t) => (
            <div className="form-row" key={t || '(none)'}>
              <span className="track-label">{t || '(no track)'}</span>
              <select
                value={trackFile[t] ?? ''}
                onChange={(e) => setTrackFile({ ...trackFile, [t]: e.target.value ? Number(e.target.value) : '' })}
              >
                <option value="">— no TOC —</option>
                {tocFiles.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.file_name} › {f.sheet_name}
                    {f.track_name ? ` (${f.track_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div className="form-row">
            <label className="check">
              <input type="checkbox" checked={autoDay} onChange={(e) => setAutoDay(e.target.checked)} />
              Auto-link daily assignments to TOC rows with the same day number
            </label>
            <label className="check">
              <input type="checkbox" checked={replaceLinks} onChange={(e) => setReplaceLinks(e.target.checked)} />
              Replace existing links of re-imported items
            </label>
          </div>
        </section>
      )}

      {items.length > 0 && (
        <section className="card stack">
          <h2>5. Preview and save</h2>
          <p>
            <b>{items.length}</b> items · <b>{linkedCount}</b> linked to TOC · <b>{items.length - linkedCount}</b> without
            link{invalid.length > 0 && <span className="error"> · {invalid.length} with unknown type</span>}
          </p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Track</th>
                  <th>Type</th>
                  <th>Day/No.</th>
                  <th>Content name</th>
                  <th>Date</th>
                  <th>Based on TOC</th>
                </tr>
              </thead>
              <tbody>
                {matched.map(({ item, rows, how, missing }) => {
                  const f = tocFileById.get(trackFile[item.track] as number)
                  return (
                    <tr key={item.row}>
                      <td className="ref">{item.row}</td>
                      <td>{item.track}</td>
                      <td>{item.type ?? <span className="error">“{item.typeRaw}”?</span>}</td>
                      <td>{item.seq}</td>
                      <td>{item.name}</td>
                      <td className="nowrap">{item.date}</td>
                      <td>
                        {rows.length ? (
                          <ul className="topic-list">
                            {rows.map((r) => (
                              <li key={r.id}>
                                <span className="ref">
                                  {r.day_label ? `${r.day_label} · ` : ''}
                                  {cellRef({ topic_column: f?.topic_column ?? null, row_number: r.row_number })}
                                </span>{' '}
                                {r.topic}
                              </li>
                            ))}
                            <li className="muted small">matched by {how}</li>
                          </ul>
                        ) : (
                          <span className="badge warn">Not linked</span>
                        )}
                        {missing.length > 0 && <div className="error small">Rows not in TOC: {missing.join(', ')}</div>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="form-row">
            <button className="primary" disabled={busy || !clientName.trim() || invalid.length > 0} onClick={save}>
              {busy ? 'Saving…' : `Save ${items.length} items`}
            </button>
            {invalid.length > 0 && <span className="error">Fix the type of every row first (pick a fixed type or a different column).</span>}
          </div>
          <p className="small muted">Items without a link can be linked by hand later from the Content page.</p>
          {msg && <Message kind={msg.kind}>{msg.text}</Message>}
        </section>
      )}
    </div>
  )
}
