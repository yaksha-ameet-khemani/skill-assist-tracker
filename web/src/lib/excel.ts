import * as XLSX from 'xlsx'

/** A sheet as a dense grid of display strings. grid[r][c] is Excel row r+1, column c+1. */
export type Grid = {
  name: string
  rows: string[][]
  /** ISO dates for cells that Excel stores as real dates, keyed "r,c" (0-based). */
  dates: Map<string, string>
  /** Cells (keyed "r,c", 0-based) whose value was copied down from a merged block. */
  filled: Set<string>
  colCount: number
}

export function colLetter(c: number): string {
  return XLSX.utils.encode_col(c)
}

export function colIndex(letter: string): number {
  return XLSX.utils.decode_col(letter.toUpperCase())
}

export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  return XLSX.read(await file.arrayBuffer())
}

/**
 * Convert a sheet into a grid.
 *
 * fillMerged: copy the value of a merged block into every row of that block,
 * but only for merges that stay inside one column (e.g. a "Track" or "Date"
 * cell merged down over several rows). Horizontal merges are usually section
 * banners ("Module 1 – ...") and are left as-is so they don't pollute data columns.
 */
export function sheetToGrid(wb: XLSX.WorkBook, sheetName: string, fillMerged: boolean): Grid {
  const ws = wb.Sheets[sheetName]
  const dates = new Map<string, string>()
  const filled = new Set<string>()
  if (!ws || !ws['!ref']) return { name: sheetName, rows: [], dates, filled, colCount: 0 }

  const range = XLSX.utils.decode_range(ws['!ref'])
  const rowCount = range.e.r + 1
  const colCount = range.e.c + 1
  const rows: string[][] = []

  for (let r = 0; r < rowCount; r++) {
    const row: string[] = new Array(colCount).fill('')
    for (let c = 0; c < colCount; c++) {
      const cell: XLSX.CellObject | undefined = ws[XLSX.utils.encode_cell({ r, c })]
      if (!cell || cell.v == null) continue
      row[c] = String(cell.w ?? cell.v).trim()
      if (cell.t === 'n' && cell.z && XLSX.SSF.is_date(cell.z)) {
        const d = XLSX.SSF.parse_date_code(cell.v as number)
        if (d) dates.set(`${r},${c}`, isoDate(d.y, d.m, d.d))
      }
    }
    rows.push(row)
  }

  if (fillMerged) {
    for (const m of ws['!merges'] ?? []) {
      if (m.s.c !== m.e.c) continue
      const c = m.s.c
      const v = rows[m.s.r]?.[c] ?? ''
      const dv = dates.get(`${m.s.r},${c}`)
      for (let r = m.s.r + 1; r <= m.e.r && r < rowCount; r++) {
        rows[r][c] = v
        if (v) filled.add(`${r},${c}`)
        if (dv) dates.set(`${r},${c}`, dv)
      }
    }
  }

  return { name: sheetName, rows, dates, filled, colCount }
}

/** Guess the header row: first row (1-based) with at least 3 non-empty cells. */
export function guessHeaderRow(grid: Grid): number {
  const i = grid.rows.findIndex((r) => r.filter((v) => v !== '').length >= 3)
  return i >= 0 ? i + 1 : 1
}

/** Columns that have a header in the given row (1-based). */
export function headerColumns(grid: Grid, headerRow: number): { letter: string; header: string }[] {
  const row = grid.rows[headerRow - 1] ?? []
  const out: { letter: string; header: string }[] = []
  for (let c = 0; c < grid.colCount; c++) {
    const h = (row[c] ?? '').replace(/\s+/g, ' ').trim()
    if (h) out.push({ letter: colLetter(c), header: h })
  }
  return out
}

/** Header labels made unique ("Track", "Track (J)") so they can be used as JSON keys. */
export function uniqueHeaders(cols: { letter: string; header: string }[]): { letter: string; header: string }[] {
  const seen = new Map<string, number>()
  for (const c of cols) seen.set(c.header, (seen.get(c.header) ?? 0) + 1)
  return cols.map((c) => ((seen.get(c.header) ?? 0) > 1 ? { ...c, header: `${c.header} (${c.letter})` } : c))
}

export function cell(grid: Grid, row1: number, letter: string): string {
  return grid.rows[row1 - 1]?.[colIndex(letter)] ?? ''
}

/** True when the cell's value only came from filling a merged block (i.e. it repeats the row above). */
export function isMergeCopy(grid: Grid, row1: number, letter: string): boolean {
  return grid.filled.has(`${row1 - 1},${colIndex(letter)}`)
}

function isoDate(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Parse a date cell. Real Excel dates are used directly; text is read as
 * DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY (the format used in our trackers) or YYYY-MM-DD.
 */
export function parseDateCell(grid: Grid, row1: number, letter: string): string | null {
  const real = grid.dates.get(`${row1 - 1},${colIndex(letter)}`)
  if (real) return real
  const s = cell(grid, row1, letter)
  let m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (m) return validDate(+m[3], +m[2], +m[1])
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return validDate(+m[1], +m[2], +m[3])
  return null
}

function validDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return isoDate(y, m, d)
}

export function downloadXlsx(fileName: string, sheets: { name: string; rows: Record<string, unknown>[] }[]) {
  const wb = XLSX.utils.book_new()
  for (const s of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.rows), s.name.slice(0, 31))
  XLSX.writeFile(wb, fileName)
}
