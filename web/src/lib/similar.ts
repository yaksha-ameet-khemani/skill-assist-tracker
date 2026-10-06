import type { ContentRow, LinkedTopic } from './supabase'

/**
 * "Find similar" (2026-10-06): match the topics of a new client request against everything in the tracker, so we can
 * decide whether to reuse existing content or create new. Plain word matching, weighted so rare words ("Selenium",
 * "Kafka") count more than common ones ("Java", "basics"); runs in the browser over the loaded content.
 */

// Same columns the home page shows besides the topic: module / phase above it, sub-topics under it.
export const GROUP_KEY = /^module(?! \/ topic)|^phase|assessment area|sub[\s-]*categor|focus of the week/i
export const SUBTOPIC_KEY = /sub[\s-]*topic|key concepts|coverage|core topics/i

// Spellings that mean the same thing, applied before splitting into words.
const PHRASES: [RegExp, string][] = [
  [/c\+\+/g, ' cpp '],
  [/c#/g, ' csharp '],
  [/asp\.net/g, ' aspnet '],
  [/\.net\b/g, ' dotnet '],
  [/node\.?js/g, ' nodejs '],
  [/react\.?js/g, ' react '],
  [/next\.?js/g, ' nextjs '],
  [/vue\.?js/g, ' vue '],
  [/angular\.?js/g, ' angular '],
  [/express\.?js/g, ' express '],
  [/spring\s*boot/g, ' springboot '],
  [/gen\s*ai/g, ' genai '],
  [/py\s*spark/g, ' pyspark '],
  [/power\s*bi/g, ' powerbi '],
  [/ci\s*\/\s*cd/g, ' cicd '],
  [/no\s*sql/g, ' nosql '],
  [/pl\s*\/\s*sql/g, ' plsql '],
  [/object[\s-]*oriented(\s*programming)?/g, ' oop '],
]
const SYNONYMS: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  oops: 'oop',
  k8s: 'kubernetes',
  db: 'database',
  dbs: 'database',
  databases: 'database',
  postgres: 'postgresql',
  mongo: 'mongodb',
  golang: 'go',
  ml: 'machinelearning',
  llms: 'llm',
  apis: 'api',
  restful: 'rest',
  dsa: 'datastructures',
}
// Words that say nothing about the subject (training-plan filler).
const STOP = new Set(
  (
    'a an and are as at be by for from how in into is it of on or the to with without using use used via vs ' +
    'introduction intro overview basic basics fundamental fundamentals concept concepts understanding understand ' +
    'learn learning hands handson hand on session sessions day days week weeks module modules part lab labs ' +
    'exercise exercises practice practical activity activities assignment assignments assessment assessments ' +
    'topic topics advanced intermediate beginner level overview working work create creating build building ' +
    'implement implementing implementation application applications based simple key core essential essentials ' +
    'detailed deep dive review recap case study'
  ).split(' '),
)

/** Light plural trimming: "queries" → "query", "classes" → "class", "loops" → "loop". */
function stem(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y'
  if (w.length > 4 && /(ss|x|ch|sh)es$/.test(w)) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) return w.slice(0, -1)
  return w
}

/** Meaningful words of a text, normalised ("React.js Hooks" → ["react", "hook"]). */
export function words(text: string): string[] {
  let s = ` ${text.toLowerCase()} `
  for (const [re, to] of PHRASES) s = s.replace(re, to)
  const out: string[] = []
  for (const raw of s.split(/[^a-z0-9]+/)) {
    if (!raw || STOP.has(raw) || /^\d+$/.test(raw)) continue
    const w = SYNONYMS[raw] ?? stem(raw)
    if (w.length < 2 && w !== 'c' && w !== 'r') continue
    if (!STOP.has(w)) out.push(w)
  }
  return out
}

/**
 * Topics typed or pasted by the user: one per line; a single line (or Excel cells) is split on commas / semicolons / tabs.
 * Bullets and numbering ("1.", "-", "•") are dropped.
 */
export function splitTopics(text: string): string[] {
  let parts = text.split(/\r?\n|\t/)
  if (parts.filter((p) => p.trim()).length <= 1) parts = text.split(/[,;\t]/)
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    const t = p.replace(/^\s*(?:[-*•▪◦]|\d+[.)])\s*/, '').trim()
    if (t && words(t).length && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase())
      out.push(t)
    }
  }
  return out
}

/**
 * A topic cell cut into small pieces: lines / ";" / "|" parts, and for long comma lists every run of three
 * neighbouring items ("Lists, tuples, sets and dictionaries" stays together).
 */
function pieces(text: string): Set<string>[] {
  const out: Set<string>[] = []
  for (const part of text.split(/[\n;|•·]+/)) {
    const items = part.split(',').map((x) => x.trim()).filter(Boolean)
    if (items.length <= 3) {
      const ws = words(part)
      if (ws.length) out.push(new Set(ws))
      continue
    }
    for (let i = 0; i + 2 < items.length; i++) {
      const ws = words(items.slice(i, i + 3).join(' '))
      if (ws.length) out.push(new Set(ws))
    }
  }
  return out
}

/** The texts of one linked TOC row: group (module / phase), topic and sub-topics. */
function topicTexts(t: LinkedTopic): string[] {
  const extra = Object.entries(t.data ?? {})
    .filter(([k]) => GROUP_KEY.test(k) || SUBTOPIC_KEY.test(k))
    .map(([, v]) => String(v))
  return [t.topic ?? '', ...extra].filter(Boolean)
}

/**
 * Content with the same name in several clients/tracks is one piece of content reused: it is listed once,
 * with every place it was used.
 */
export type Candidate = {
  key: string
  name: string
  rows: ContentRow[]
  /** Words of the content name (count double: the name says what the content tests). */
  nameWords: Set<string>
  /** Words of the linked TOC topics. */
  topicWords: Set<string>
  /** Linked TOC topic lines, for showing which ones matched. */
  topicLines: { text: string; words: Set<string> }[]
  /** Small pieces of those lines (a requested topic must match within one piece, not across the whole TOC). */
  pieces: Set<string>[]
}

export type Index = { candidates: Candidate[]; idf: Map<string, number>; maxIdf: number }

export function buildIndex(rows: ContentRow[]): Index {
  const byKey = new Map<string, Candidate>()
  for (const r of rows) {
    const key = r.name.trim().toLowerCase().replace(/\s+/g, ' ')
    let c = byKey.get(key)
    if (!c) {
      c = { key, name: r.name, rows: [], nameWords: new Set(words(r.name)), topicWords: new Set(), topicLines: [], pieces: [] }
      byKey.set(key, c)
    }
    c.rows.push(r)
    for (const t of r.topics ?? []) {
      for (const text of topicTexts(t)) {
        if (c.topicLines.some((l) => l.text === text)) continue
        const ws = new Set(words(text))
        ws.forEach((w) => c.topicWords.add(w))
        c.topicLines.push({ text, words: ws })
        c.pieces.push(...pieces(text))
      }
    }
  }
  const candidates = [...byKey.values()]
  const df = new Map<string, number>()
  for (const c of candidates) for (const w of new Set([...c.nameWords, ...c.topicWords])) df.set(w, (df.get(w) ?? 0) + 1)
  const n = candidates.length
  const idf = new Map<string, number>()
  for (const [w, d] of df) idf.set(w, Math.log(1 + n / d))
  // Words found nowhere in the tracker weigh the most: a topic made of them is clearly new.
  return { candidates, idf, maxIdf: Math.log(1 + n) }
}

export type Result = {
  candidate: Candidate
  /** 0..1: average of how well each requested topic is covered by this content. */
  score: number
  /** Coverage per requested topic, same order as the topics. */
  perTopic: number[]
  /** Same, counting the content name only (breaks ties: the item named after the topic comes first). */
  perTopicName: number[]
  matched: string[]
}

/** Share of a requested topic's words (weighted by rarity) found in `has`. */
function share(qWords: string[], has: (w: string) => boolean, ix: Index): { score: number; matched: string[] } {
  let total = 0
  let got = 0
  const matched: string[] = []
  for (const w of qWords) {
    const weight = ix.idf.get(w) ?? ix.maxIdf
    total += weight
    if (has(w)) {
      got += weight
      matched.push(w)
    }
  }
  return { score: total ? got / total : 0, matched }
}

/**
 * Content linked to a whole TOC (hundreds of topic words, e.g. a capstone over a full course) mentions nearly
 * everything; its topic matches count less (down to half), its name matches fully. "Broad" is measured against the
 * search: a long pasted TOC cell (dozens of words) naturally matches content with long topics, so the allowance grows
 * with it (3 topic words per searched word, at least 60); a short "Kafka" search still pushes whole-TOC content down.
 */
function breadth(c: Candidate, searchedWords: number): number {
  const allowance = Math.max(60, 3 * searchedWords)
  return Math.min(1, Math.max(0.5, Math.sqrt(allowance / Math.max(1, c.topicWords.size))))
}

/**
 * How well this content covers one requested topic: the best of its name alone, or its name plus one piece of its
 * TOC topics. "SQL joins" needs "sql" and "join" in the same place, not "SQL" on day 3 and "join" on day 9.
 */
function coverage(qWords: string[], c: Candidate, ix: Index, whole: boolean): { score: number; matched: string[] } {
  let best = share(qWords, (w) => c.nameWords.has(w), ix)
  const b = breadth(c, qWords.length)
  if (whole) {
    // One long text (a whole TOC cell): its words may sit anywhere in the content's topics.
    const m = share(qWords, (w) => c.nameWords.has(w) || c.topicWords.has(w), ix)
    return m.score * b > best.score ? { score: m.score * b, matched: m.matched } : best
  }
  for (const p of c.pieces) {
    const m = share(qWords, (w) => c.nameWords.has(w) || p.has(w), ix)
    if (m.score * b > best.score) best = { score: m.score * b, matched: m.matched }
  }
  return best
}

/**
 * `whole` = the text is one topic (e.g. a pasted TOC cell): content is scored on how much of the whole text it covers
 * across all its topics. Otherwise each topic is matched on its own, within one piece of the content's topics.
 */
export function findSimilar(ix: Index, topics: string[], keep: (c: Candidate) => boolean, whole = false) {
  const qs = topics.map((t) => [...new Set(words(t))])
  const pool = ix.candidates.filter(keep)
  const results: Result[] = pool.map((c) => {
    const per = qs.map((q) => coverage(q, c, ix, whole))
    const perName = qs.map((q) => share(q, (w) => c.nameWords.has(w), ix).score)
    const matched = [...new Set(per.flatMap((p) => p.matched))]
    // Small bonus when the content name itself carries the words: "SQL - Joins" beats an item merely linked to a SQL day.
    const nameBonus = perName.reduce((s, x) => s + x, 0) / (perName.length || 1)
    const avg = per.reduce((s, p) => s + p.score, 0) / (per.length || 1)
    // One whole text: its coverage is the score (same number in both tables).
    const score = whole ? avg : Math.min(1, avg * 0.9 + nameBonus * 0.1)
    return { candidate: c, score, perTopic: per.map((p) => p.score), perTopicName: perName, matched }
  })
  // Ties: the more focused content (fewer linked topic words) first.
  const narrower = (a: Result, b: Result) => a.candidate.topicWords.size - b.candidate.topicWords.size
  const ranked = results.filter((r) => r.score > 0).sort((a, b) => b.score - a.score || narrower(a, b))
  // Best content for each requested topic on its own.
  const byTopic = qs.map((_, i) =>
    results
      .filter((r) => r.perTopic[i] > 0)
      .sort((a, b) => b.perTopic[i] - a.perTopic[i] || b.perTopicName[i] - a.perTopicName[i] || narrower(a, b) || b.score - a.score)
      .slice(0, 3)
      .map((r) => ({ result: r, score: r.perTopic[i] })),
  )
  return { ranked, byTopic, topicWords: qs }
}

/** Linked TOC lines of a content item that share words with the request, best first. */
export function matchingLines(c: Candidate, matched: string[], max = 3): string[] {
  const m = new Set(matched)
  return c.topicLines
    .map((l) => ({ text: l.text, n: [...l.words].filter((w) => m.has(w)).length }))
    .filter((l) => l.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((l) => (l.text.length > 160 ? l.text.slice(0, 157).trimEnd() + '…' : l.text))
}
