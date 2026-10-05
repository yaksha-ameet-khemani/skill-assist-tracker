import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ComboInput, Message, useLookups } from '../components/common'
import { SheetPicker, type PickedSheet } from '../components/SheetPicker'
import { cell, headerColumns, isMergeCopy, uniqueHeaders } from '../lib/excel'
import { chunk, fetchAll, findOrCreateClient, findOrCreateTrack, must, supabase } from '../lib/supabase'

type ParsedRow = { row_number: number; day_label: string | null; topic: string | null; data: Record<string, string> }

const DAY_HINT = /^day$|day\b/i
const TOPIC_HINT = /^topic|topic$/i

export function TocUpload() {
  const { clients, tracks, reload } = useLookups()
  const [clientName, setClientName] = useState('')
  const [trackName, setTrackName] = useState('')
  const [sourceLink, setSourceLink] = useState('')
  const [picked, setPicked] = useState<PickedSheet | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dayCol, setDayCol] = useState('')
  const [topicCol, setTopicCol] = useState('')
  const [lastRow, setLastRow] = useState<number | ''>('')
  const [skipNoTopic, setSkipNoTopic] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: ReactNode } | null>(null)

  const columns = useMemo(
    () => (picked ? uniqueHeaders(headerColumns(picked.grid, picked.headerRow)) : []),
    [picked],
  )

  // When the header row changes, select all columns and guess Day / Topic.
  useEffect(() => {
    setSelected(new Set(columns.map((c) => c.letter)))
    setDayCol(columns.find((c) => DAY_HINT.test(c.header))?.letter ?? '')
    setTopicCol(columns.find((c) => TOPIC_HINT.test(c.header))?.letter ?? '')
  }, [columns])

  const rows: ParsedRow[] = useMemo(() => {
    if (!picked) return []
    const end = lastRow || picked.grid.rows.length
    const keep = columns.filter((c) => selected.has(c.letter))
    const out: ParsedRow[] = []
    for (let r = picked.headerRow + 1; r <= end; r++) {
      const topic = topicCol ? cell(picked.grid, r, topicCol) : ''
      if (skipNoTopic && topicCol && !topic) continue
      if (topicCol && topic && isMergeCopy(picked.grid, r, topicCol)) continue
      const data: Record<string, string> = {}
      for (const c of keep) {
        const v = cell(picked.grid, r, c.letter)
        if (v) data[c.header] = v
      }
      if (!Object.keys(data).length) continue
      out.push({
        row_number: r,
        day_label: dayCol ? cell(picked.grid, r, dayCol) || null : null,
        topic: topic || null,
        data,
      })
    }
    return out
  }, [picked, columns, selected, dayCol, topicCol, lastRow, skipNoTopic])

  const rowSet = useMemo(() => new Set(rows.map((r) => r.row_number)), [rows])
  const clientTracks = tracks.filter(
    (t) => t.client_id === clients.find((c) => c.name.toLowerCase() === clientName.trim().toLowerCase())?.id,
  )

  async function save() {
    if (!picked || !clientName.trim() || !rows.length) return
    setBusy(true)
    setMsg(null)
    try {
      const client = await findOrCreateClient(clientName)
      const track = trackName.trim() ? await findOrCreateTrack(client.id, trackName) : null
      const keep = columns.filter((c) => selected.has(c.letter))

      const file = must<{ id: number }>(
        await supabase
          .from('toc_files')
          .upsert(
            {
              client_id: client.id,
              track_id: track?.id ?? null,
              file_name: picked.fileName,
              sheet_name: picked.sheetName,
              header_row: picked.headerRow,
              columns: keep,
              day_column: dayCol || null,
              topic_column: topicCol || null,
              source_link: sourceLink.trim() || null,
            },
            { onConflict: 'client_id,file_name,sheet_name' },
          )
          .select('id')
          .single(),
      )

      // Re-uploading the same file keeps existing rows (and their content links) by Excel row number.
      const existing = await fetchAll<{ id: number; row_number: number }>(() =>
        supabase.from('toc_rows').select('id,row_number').eq('toc_file_id', file.id).order('id'),
      )
      const gone = existing.filter((e) => !rowSet.has(e.row_number))
      if (gone.length) {
        const ok = window.confirm(
          `${gone.length} row(s) from the previous upload of this sheet are not in this upload ` +
            `(rows ${gone.map((g) => g.row_number).slice(0, 15).join(', ')}${gone.length > 15 ? '…' : ''}). ` +
            `They and any content links to them will be removed. Continue?`,
        )
        if (!ok) {
          setBusy(false)
          return
        }
        for (const ids of chunk(gone.map((g) => g.id), 200)) must(await supabase.from('toc_rows').delete().in('id', ids))
      }

      for (const part of chunk(rows, 500)) {
        must(
          await supabase
            .from('toc_rows')
            .upsert(part.map((r) => ({ ...r, toc_file_id: file.id })), { onConflict: 'toc_file_id,row_number' }),
        )
      }
      await reload()
      setMsg({
        kind: 'ok',
        text: (
          <>
            Saved {rows.length} TOC rows from <b>{picked.fileName}</b> › {picked.sheetName}.{' '}
            <Link to={`/topics?file=${file.id}`}>View them</Link>
          </>
        ),
      })
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page stack">
      <header>
        <h1>Upload TOC</h1>
        <p className="muted">
          Pick the TOC Excel, choose the sheet and header row, then tick the columns to keep. Each remaining row is saved
          with its Excel row number so content can point to it (e.g. row 6 → F6/G6).
        </p>
      </header>

      <section className="card stack">
        <h2>1. Client and track</h2>
        <div className="form-row">
          <label>
            Client *
            <ComboInput value={clientName} onChange={setClientName} options={clients.map((c) => c.name)} placeholder="e.g. Sony" />
          </label>
          <label>
            Track
            <ComboInput
              value={trackName}
              onChange={setTrackName}
              options={clientTracks.map((t) => t.name)}
              placeholder="e.g. FSE Java & Angular"
            />
          </label>
          <label className="grow">
            Where the original file lives (optional)
            <input value={sourceLink} onChange={(e) => setSourceLink(e.target.value)} placeholder="Shared drive path or link" />
          </label>
        </div>
      </section>

      <section className="card stack">
        <h2>2. File, sheet and header row</h2>
        <SheetPicker onChange={setPicked} highlight={(r) => rowSet.has(r)} />
      </section>

      {picked && columns.length > 0 && (
        <section className="card stack">
          <h2>3. Columns to keep</h2>
          <div className="col-picker">
            {columns.map((c) => (
              <label key={c.letter} className="check">
                <input
                  type="checkbox"
                  checked={selected.has(c.letter)}
                  onChange={(e) => {
                    const next = new Set(selected)
                    if (e.target.checked) next.add(c.letter)
                    else next.delete(c.letter)
                    setSelected(next)
                  }}
                />
                <span className="ref">{c.letter}</span> {c.header}
              </label>
            ))}
          </div>
          <div className="form-row">
            <label>
              Day column
              <select value={dayCol} onChange={(e) => setDayCol(e.target.value)}>
                <option value="">— none —</option>
                {columns.map((c) => (
                  <option key={c.letter} value={c.letter}>
                    {c.letter} · {c.header}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Main topic column
              <select value={topicCol} onChange={(e) => setTopicCol(e.target.value)}>
                <option value="">— none —</option>
                {columns.map((c) => (
                  <option key={c.letter} value={c.letter}>
                    {c.letter} · {c.header}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Last row (optional)
              <input
                type="number"
                className="narrow"
                value={lastRow}
                onChange={(e) => setLastRow(e.target.value ? Number(e.target.value) : '')}
              />
            </label>
            <label className="check">
              <input type="checkbox" checked={skipNoTopic} onChange={(e) => setSkipNoTopic(e.target.checked)} />
              Skip rows with an empty topic (section headings, totals)
            </label>
          </div>
        </section>
      )}

      {picked && (
        <section className="card stack">
          <h2>4. Preview and save</h2>
          <p>
            <b>{rows.length}</b> rows will be saved (highlighted in the preview above).
          </p>
          <div className="table-wrap short">
            <table className="data">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Day</th>
                  <th>Topic</th>
                  <th>Other columns kept</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((r) => (
                  <tr key={r.row_number}>
                    <td className="ref">{r.row_number}</td>
                    <td>{r.day_label}</td>
                    <td>{r.topic}</td>
                    <td className="small muted">{Object.keys(r.data).length} columns</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-row">
            <button className="primary" disabled={busy || !clientName.trim() || !rows.length} onClick={save}>
              {busy ? 'Saving…' : `Save ${rows.length} TOC rows`}
            </button>
            {!clientName.trim() && <span className="muted">Enter a client first.</span>}
          </div>
          {msg && <Message kind={msg.kind}>{msg.text}</Message>}
        </section>
      )}
    </div>
  )
}
