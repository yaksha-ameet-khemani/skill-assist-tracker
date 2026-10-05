/**
 * Database client for the Cloudflare version (2026-10-05). It offers the small part of the supabase-js query API the
 * pages use (from / select / eq / neq / in / ilike / is / order / limit / range / single / maybeSingle / insert /
 * update / upsert / delete), so the pages did not need rewriting. Each query is one POST to the Worker's /api/db
 * (cloudflare/src/worker.js), which runs it on D1. Saving needs the team passcode, kept in this browser.
 */

type Filter = { col: string; op: 'eq' | 'neq' | 'in' | 'ilike' | 'is'; value: unknown }
type Result = { data: any; error: { message: string } | null } // eslint-disable-line @typescript-eslint/no-explicit-any

const KEY = 'skill-assist-team-key'
export function getTeamKey(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}
export function setTeamKey(v: string) {
  try {
    if (v) localStorage.setItem(KEY, v)
    else localStorage.removeItem(KEY)
  } catch {
    /* storage blocked: the passcode is asked again next time */
  }
  window.dispatchEvent(new Event('team-key'))
}
/** Asks the Worker whether a passcode is right. */
export async function checkTeamKey(v: string): Promise<boolean> {
  const res = await fetch('/api/check-key', { headers: { 'x-team-key': v } })
  return res.ok
}

class Query implements PromiseLike<Result> {
  private q: Record<string, unknown>
  private filters: Filter[] = []
  private orders: { col: string; asc: boolean }[] = []

  constructor(table: string) {
    this.q = { table, op: 'select', columns: '*' }
  }

  select(columns = '*') {
    // After insert / update / upsert / delete, select() names the columns to return (like supabase-js).
    if (this.q.op === 'select') this.q.columns = columns
    else this.q.returning = columns
    return this
  }
  insert(values: object | object[]) {
    Object.assign(this.q, { op: 'insert', values })
    return this
  }
  upsert(values: object | object[], opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}) {
    Object.assign(this.q, { op: 'upsert', values, onConflict: opts.onConflict, ignoreDuplicates: opts.ignoreDuplicates })
    return this
  }
  update(values: object) {
    Object.assign(this.q, { op: 'update', values })
    return this
  }
  delete() {
    this.q.op = 'delete'
    return this
  }
  eq(col: string, value: unknown) {
    this.filters.push({ col, op: 'eq', value })
    return this
  }
  neq(col: string, value: unknown) {
    this.filters.push({ col, op: 'neq', value })
    return this
  }
  in(col: string, value: unknown[]) {
    this.filters.push({ col, op: 'in', value })
    return this
  }
  ilike(col: string, value: string) {
    this.filters.push({ col, op: 'ilike', value })
    return this
  }
  is(col: string, value: null) {
    this.filters.push({ col, op: 'is', value })
    return this
  }
  order(col: string, opts: { ascending?: boolean } = {}) {
    this.orders.push({ col, asc: opts.ascending !== false })
    return this
  }
  limit(n: number) {
    this.q.limit = n
    return this
  }
  range(from: number, to: number) {
    Object.assign(this.q, { offset: from, limit: to - from + 1 })
    return this
  }
  single() {
    this.q.single = 'single'
    return this
  }
  maybeSingle() {
    this.q.single = 'maybe'
    return this
  }

  private async exec(): Promise<Result> {
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-team-key': getTeamKey() },
        body: JSON.stringify({ ...this.q, filters: this.filters, order: this.orders }),
      })
      const body = (await res.json().catch(() => null)) as Result | null
      return body ?? { data: null, error: { message: `Server error (${res.status})` } }
    } catch (e) {
      return { data: null, error: { message: `Cannot reach the server: ${(e as Error).message}` } }
    }
  }

  then<A = Result, B = never>(onOk?: ((v: Result) => A | PromiseLike<A>) | null, onErr?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return this.exec().then(onOk, onErr)
  }
}

export const db = { from: (table: string) => new Query(table) }
