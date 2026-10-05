import { useCallback, useEffect, useId, useState, type ReactNode } from 'react'
import { must, supabase, type Client, type ContentType, type LinkedTopic, type Track } from '../lib/supabase'

/** Loads clients, tracks and content types. `reload` refreshes after imports create new ones. */
export function useLookups() {
  const [clients, setClients] = useState<Client[]>([])
  const [tracks, setTracks] = useState<Track[]>([])
  const [types, setTypes] = useState<ContentType[]>([])
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      const [c, t, ty] = await Promise.all([
        supabase.from('clients').select('id,name').order('name'),
        supabase.from('tracks').select('id,client_id,name').order('name'),
        supabase.from('content_types').select('name,sort_order').order('sort_order'),
      ])
      setClients(must(c))
      setTracks(must(t))
      setTypes(must(ty))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { clients, tracks, types, error, reload }
}

/** Text input with suggestions; typing a new value is allowed (it will be created on save). */
export function ComboInput(props: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  className?: string
}) {
  const id = useId()
  return (
    <>
      <input
        list={id}
        value={props.value}
        placeholder={props.placeholder}
        className={props.className}
        onChange={(e) => props.onChange(e.target.value)}
      />
      <datalist id={id}>
        {props.options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  )
}

/** Cell reference like "F6" for a TOC row, falling back to "Row 6". */
export function cellRef(t: { topic_column: string | null; row_number: number }): string {
  return t.topic_column ? `${t.topic_column}${t.row_number}` : `Row ${t.row_number}`
}

/** Compact list of the TOC topics a content item is based on. */
export function TopicList({ topics, max }: { topics: LinkedTopic[]; max?: number }) {
  if (!topics.length) return <span className="badge warn">Not linked</span>
  const shown = max ? topics.slice(0, max) : topics
  return (
    <ul className="topic-list">
      {shown.map((t) => (
        <li key={t.toc_row_id} title={`${t.file_name} › ${t.sheet_name} › ${cellRef(t)}`}>
          <span className="ref">
            {t.day_label ? `${t.day_label} · ` : ''}
            {cellRef(t)}
          </span>{' '}
          {t.topic}
        </li>
      ))}
      {max && topics.length > max && <li className="muted">+{topics.length - max} more</li>}
    </ul>
  )
}

export function Message({ kind, children }: { kind: 'error' | 'ok' | 'info'; children: ReactNode }) {
  if (!children) return null
  return <div className={`msg msg-${kind}`}>{children}</div>
}
