import { db } from './db'

// The site now runs on Cloudflare (Worker + D1, see cloudflare/). `supabase` keeps its old name so the pages are
// unchanged; it is the small client in ./db that talks to the Worker.
export const supabase = db

export type Client = { id: number; name: string }
export type Track = { id: number; client_id: number; name: string }
export type ContentType = { name: string; sort_order: number }

export type TocColumn = { letter: string; header: string }

export type TocFile = {
  id: number
  client_id: number
  client_name: string
  track_id: number | null
  track_name: string | null
  file_name: string
  sheet_name: string
  header_row: number
  columns: TocColumn[]
  day_column: string | null
  topic_column: string | null
  source_link: string | null
  row_count: number
  created_at: string
}

export type TocRow = {
  id: number
  toc_file_id: number
  file_name: string
  sheet_name: string
  topic_column: string | null
  client_id: number
  client_name: string
  track_id: number | null
  track_name: string | null
  row_number: number
  day_label: string | null
  topic: string | null
  data: Record<string, string>
  content_count: number
  contents: { id: number; name: string; content_type: string; sequence_label: string | null; client_name: string }[]
}

export type LinkedTopic = {
  toc_row_id: number
  file_name: string
  sheet_name: string
  row_number: number
  topic_column: string | null
  day_label: string | null
  topic: string | null
  data: Record<string, string>
  /** Column order of the TOC sheet, used to show `data` in the original order. */
  columns?: TocColumn[]
}

export type ContentRow = {
  id: number
  client_id: number
  client_name: string
  track_id: number | null
  track_name: string | null
  /** Client success manager owning the track. */
  csm: string | null
  /** Date stored on the track itself (tracks.extra.date), used to order tracks; null for most tracks. */
  track_date: string | null
  content_type: string
  type_order: number
  sequence_label: string | null
  name: string
  delivery_date: string | null
  notes: string | null
  extra: Record<string, unknown>
  created_at: string
  link_count: number
  topics: LinkedTopic[]
}

/** Throws the Supabase error so callers can show it. */
export function must<T>(res: { data: T | null; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message)
  return res.data as NonNullable<T>
}

/**
 * Fetch every row of a query, paging past the API's 1000-row cap.
 * `build` must return a fresh query each call.
 */
export async function fetchAll<T>(
  build: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> },
): Promise<T[]> {
  const page = 1000
  const out: T[] = []
  for (let from = 0; ; from += page) {
    const rows = must(await build().range(from, from + page - 1))
    out.push(...rows)
    if (rows.length < page) return out
  }
}

/** Escape LIKE wildcards so names such as "LTM_2" match exactly (case-insensitively). */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, '\\$&')
}

export async function findOrCreateClient(name: string): Promise<Client> {
  const clean = name.trim()
  const found = must(await supabase.from('clients').select('id,name').ilike('name', escapeLike(clean)).limit(1))
  if (found.length) return found[0]
  return must(await supabase.from('clients').insert({ name: clean }).select('id,name').single())
}

export async function findOrCreateTrack(clientId: number, name: string): Promise<Track> {
  const clean = name.trim()
  const found = must(
    await supabase.from('tracks').select('id,client_id,name').eq('client_id', clientId).ilike('name', escapeLike(clean)).limit(1),
  )
  if (found.length) return found[0]
  return must(
    await supabase.from('tracks').insert({ client_id: clientId, name: clean }).select('id,client_id,name').single(),
  )
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}
