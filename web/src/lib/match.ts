/** Day number from a label: "Day 1" → 1, "9 A" → 9. A "Day N" mention wins over other numbers ("Week 2 | Day 7" → 7). */
export function dayNumber(label: string | null | undefined): number | null {
  if (!label) return null
  const s = String(label)
  const day = s.match(/day\s*[-:]?\s*(\d+)/i)
  if (day) return Number(day[1])
  const any = s.match(/\d+/)
  return any ? Number(any[0]) : null
}

/** Parse "6", "6, 8", "6-13", "R6-R13; 15" into Excel row numbers. */
export function parseRowList(s: string): number[] {
  const out = new Set<number>()
  for (const part of s.split(/[,;\s]+/).filter(Boolean)) {
    const m = part.match(/^[A-Z]*(\d+)(?:-[A-Z]*(\d+))?$/i)
    if (!m) continue
    const a = Number(m[1])
    const b = m[2] ? Number(m[2]) : a
    for (let r = Math.min(a, b); r <= Math.max(a, b) && r - Math.min(a, b) < 500; r++) out.add(r)
  }
  return [...out].sort((x, y) => x - y)
}

/** Map free-text type values from client trackers onto our content types. */
export function guessContentType(value: string, types: string[]): string | null {
  const v = value.trim().toLowerCase()
  if (!v) return null
  const exact = types.find((t) => t.toLowerCase() === v)
  if (exact) return exact
  const rules: [RegExp, string][] = [
    [/pre[\s-]?assess/, 'Pre-Assessment'],
    [/capstone/, 'Capstone'],
    [/milestone/, 'Milestone Assessment'],
    [/practice/, 'Practice'],
    [/direct/, 'Direct Assessment'],
    [/day|daily|assignment/, 'Daily Assignment'],
  ]
  for (const [re, t] of rules) if (re.test(v) && types.includes(t)) return t
  return null
}
