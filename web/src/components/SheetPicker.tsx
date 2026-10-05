import { useEffect, useMemo, useState } from 'react'
import type { WorkBook } from 'xlsx'
import { colLetter, guessHeaderRow, readWorkbook, sheetToGrid, type Grid } from '../lib/excel'

export type PickedSheet = {
  fileName: string
  sheetName: string
  headerRow: number
  grid: Grid
}

type Props = {
  onChange: (picked: PickedSheet | null) => void
  /** Rows (1-based) to highlight in the preview, e.g. the rows that will be imported. */
  highlight?: (row1: number) => boolean
  previewRows?: number
}

/** File → sheet → header row, with a scrollable preview showing Excel row numbers and column letters. */
export function SheetPicker({ onChange, highlight, previewRows = 40 }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [wb, setWb] = useState<WorkBook | null>(null)
  const [sheetName, setSheetName] = useState('')
  const [headerRow, setHeaderRow] = useState(1)
  const [fillMerged, setFillMerged] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!file) return
    setError('')
    readWorkbook(file)
      .then((book) => {
        setWb(book)
        const preferred = book.SheetNames.find((n) => /training plan|toc/i.test(n)) ?? book.SheetNames[0]
        setSheetName(preferred)
      })
      .catch((e) => setError(`Could not read file: ${e.message}`))
  }, [file])

  const grid = useMemo(() => (wb && sheetName ? sheetToGrid(wb, sheetName, fillMerged) : null), [wb, sheetName, fillMerged])

  // Re-guess the header row whenever the sheet changes.
  useEffect(() => {
    if (wb && sheetName) setHeaderRow(guessHeaderRow(sheetToGrid(wb, sheetName, false)))
  }, [wb, sheetName])

  useEffect(() => {
    onChange(file && grid ? { fileName: file.name, sheetName, headerRow, grid } : null)
  }, [onChange, file, grid, sheetName, headerRow])

  const shownRows = grid ? grid.rows.slice(0, Math.max(previewRows, headerRow + 5)) : []

  return (
    <div className="stack">
      <div className="form-row">
        <label>
          Excel file
          <input type="file" accept=".xlsx,.xls,.xlsm,.csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        {wb && (
          <label>
            Sheet
            <select value={sheetName} onChange={(e) => setSheetName(e.target.value)}>
              {wb.SheetNames.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
        {grid && (
          <label>
            Header row
            <input
              type="number"
              min={1}
              max={grid.rows.length}
              value={headerRow}
              onChange={(e) => setHeaderRow(Math.max(1, Number(e.target.value) || 1))}
              className="narrow"
            />
          </label>
        )}
        {grid && (
          <label className="check">
            <input type="checkbox" checked={fillMerged} onChange={(e) => setFillMerged(e.target.checked)} />
            Fill merged cells downwards
          </label>
        )}
      </div>
      {error && <p className="error">{error}</p>}

      {grid && (
        <div className="grid-preview">
          <table>
            <thead>
              <tr>
                <th></th>
                {Array.from({ length: grid.colCount }, (_, c) => (
                  <th key={c}>{colLetter(c)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shownRows.map((row, r) => (
                <tr
                  key={r}
                  className={r + 1 === headerRow ? 'is-header' : highlight?.(r + 1) ? 'is-picked' : undefined}
                  onClick={() => setHeaderRow(r + 1)}
                  title="Click to use this row as the header row"
                >
                  <th>{r + 1}</th>
                  {row.map((v, c) => (
                    <td key={c} title={v}>
                      {v.length > 60 ? v.slice(0, 60) + '…' : v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {grid.rows.length > shownRows.length && (
            <p className="muted small">
              Showing first {shownRows.length} of {grid.rows.length} rows.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
