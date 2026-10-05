import { useCallback, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'

const MIN = 40

function load(key: string): Record<string, number> | null {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? 'null')
    return v && typeof v === 'object' ? v : null
  } catch {
    return null
  }
}

function save(key: string, w: Record<string, number> | null) {
  try {
    if (w) localStorage.setItem(key, JSON.stringify(w))
    else localStorage.removeItem(key)
  } catch {
    /* storage blocked: widths just aren't remembered */
  }
}

/**
 * Excel-like column widths: drag the right edge of a header to resize, double-click it to reset that column.
 * Widths are remembered per browser under `key`. Until a column is dragged the table keeps its automatic layout;
 * after that it switches to a fixed layout so every column keeps the width it was given.
 */
export function useColumnWidths(key: string) {
  const storageKey = `colwidths:${key}`
  const [widths, setWidths] = useState<Record<string, number> | null>(() => load(storageKey))
  const headRow = useRef<HTMLTableRowElement>(null)

  const update = useCallback(
    (next: Record<string, number> | null) => {
      setWidths(next)
      save(storageKey, next)
    },
    [storageKey],
  )

  /** Current width of every visible header, so the first drag freezes the automatic layout as it looks now. */
  const measure = () => {
    const out: Record<string, number> = {}
    headRow.current?.querySelectorAll<HTMLElement>('th[data-col]').forEach((th) => {
      out[th.dataset.col!] = Math.ceil(th.getBoundingClientRect().width) + 1 // round up: text that fit exactly must still fit
    })
    return out
  }

  const startDrag = (id: string) => (e: PointerEvent<HTMLSpanElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const base = { ...measure(), ...(widths ?? {}) }
    const startX = e.clientX
    const startW = base[id] ?? MIN
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    let latest = base
    const move = (ev: globalThis.PointerEvent) => {
      latest = { ...base, [id]: Math.max(MIN, Math.round(startW + ev.clientX - startX)) }
      setWidths(latest)
    }
    const up = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', up)
      update(latest)
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', up)
  }

  /** Double-click: give the column back its automatic width (fit to content). */
  const autoFit = (id: string) => () => {
    if (!widths) return
    const rest = { ...widths }
    delete rest[id]
    // Measure the column's natural width with the other columns kept as they are.
    update(Object.keys(rest).length ? { ...rest, [id]: naturalWidth(id) } : null)
  }

  const naturalWidth = (id: string) => {
    const table = headRow.current?.closest('table')
    if (!table) return 120
    const idx = [...headRow.current!.children].findIndex((c) => (c as HTMLElement).dataset.col === id)
    let w = MIN
    table.querySelectorAll('tr').forEach((tr) => {
      const cell = tr.children[idx] as HTMLElement | undefined
      if (!cell) return
      // scrollWidth of a nowrap cell is its full text width; for wrapping cells cap it so text can wrap.
      w = Math.max(w, Math.min(cell.scrollWidth + 4, 400))
    })
    return Math.round(w)
  }

  /** Style for the <table>: fixed layout once widths exist, total width = sum of the visible columns. */
  const tableStyle = (ids: string[]): CSSProperties | undefined =>
    widths ? { tableLayout: 'fixed', width: ids.reduce((s, id) => s + (widths[id] ?? 120), 0) } : undefined

  const th = (id: string, label: ReactNode) => (
    <th key={id} data-col={id} className="resizable" style={widths ? { width: widths[id] ?? 120 } : undefined}>
      {label}
      <span
        className="col-resize"
        title="Drag to resize · double-click to fit"
        onPointerDown={startDrag(id)}
        onDoubleClick={autoFit(id)}
        onClick={(e) => e.stopPropagation()}
      />
    </th>
  )

  return { th, headRow, tableStyle, resized: !!widths, reset: () => update(null) }
}
