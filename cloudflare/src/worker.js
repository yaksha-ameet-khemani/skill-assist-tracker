// Skill Assist Tracker on Cloudflare (2026-10-05): serves the website (web/dist) and a small database API over D1.
// The website's lib/db.ts sends one JSON request per query to POST /api/db: {table, op, columns, filters, order,
// limit, offset, values, onConflict, ignoreDuplicates, returning, single}. Reading is open to anyone with the link;
// insert / update / upsert / delete need the team passcode (secret TEAM_KEY) in the "x-team-key" header.
// Only the tables and columns listed below are accepted, so the SQL is always built from known names.
// POST /api/analyze {content_id}: Gemini tags + quality score for one item (analyze.js; local copy only).

import { analyze, geminiModel } from './analyze.js'

const TABLES = {
  clients: ['id', 'name', 'notes', 'extra', 'created_at'],
  tracks: ['id', 'client_id', 'name', 'notes', 'extra', 'created_at', 'csm'],
  toc_files: ['id', 'client_id', 'track_id', 'file_name', 'sheet_name', 'header_row', 'columns', 'day_column', 'topic_column',
              'source_link', 'notes', 'extra', 'uploaded_by', 'created_at'],
  toc_rows: ['id', 'toc_file_id', 'row_number', 'day_label', 'topic', 'data'],
  content_types: ['name', 'sort_order'],
  contents: ['id', 'client_id', 'track_id', 'content_type', 'sequence_label', 'name', 'delivery_date', 'notes', 'extra',
             'created_by', 'created_at', 'updated_at'],
  content_toc_links: ['content_id', 'toc_row_id', 'created_at'],
}
const VIEWS = {
  v_contents: ['id', 'client_id', 'client_name', 'track_id', 'track_name', 'content_type', 'type_order', 'sequence_label', 'name',
               'delivery_date', 'notes', 'extra', 'created_at', 'link_count', 'topics', 'topics_text', 'csm', 'track_date'],
  v_toc_rows: ['id', 'toc_file_id', 'file_name', 'sheet_name', 'topic_column', 'client_id', 'client_name', 'track_id', 'track_name',
               'row_number', 'day_label', 'topic', 'data', 'data_text', 'content_count', 'contents'],
  v_toc_files: ['id', 'client_id', 'track_id', 'file_name', 'sheet_name', 'header_row', 'columns', 'day_column', 'topic_column',
                'source_link', 'notes', 'extra', 'uploaded_by', 'created_at', 'client_name', 'track_name', 'row_count'],
  // Content analysis (analysis_schema.sql): read-only here, written by /api/analyze and the scripts. The text itself
  // is not listed: the page only needs to know what was fetched.
  content_text: ['content_id', 'files', 'text_hash', 'error', 'fetched_at'],
  content_analysis: ['content_id', 'quality_band', 'confidence', 'low_confidence', 'result', 'model', 'prompt_version',
                     'text_hash', 'analyzed_at'],
}
// Columns holding JSON text in D1, returned to the website as objects.
const JSON_COLS = new Set(['extra', 'data', 'columns', 'topics', 'contents', 'files', 'result'])
// Upsert targets as the website names them -> the matching unique index in schema.sql.
const CONFLICT = {
  'contents:client_id,track_id,content_type,sequence_label,name':
    "client_id, ifnull(track_id, 0), content_type, ifnull(sequence_label, ''), name",
}

class ApiError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

function columnsOf(table, write) {
  const cols = TABLES[table] ?? (!write && VIEWS[table])
  if (!cols) throw new ApiError(`Unknown table: ${table}`)
  return cols
}
function col(cols, name) {
  if (!cols.includes(name)) throw new ApiError(`Unknown column: ${name}`)
  return name
}
function pickColumns(cols, spec) {
  if (!spec || spec.trim() === '*') return cols
  return spec.split(',').map((c) => col(cols, c.trim()))
}
// Plain values only; objects/arrays go into JSON columns as text.
function value(v) {
  if (v === undefined) return null
  if (v !== null && typeof v === 'object') return JSON.stringify(v)
  if (typeof v === 'boolean') return v ? 1 : 0
  return v
}
function parseRow(row) {
  for (const k of Object.keys(row)) {
    if (JSON_COLS.has(k) && typeof row[k] === 'string') {
      try { row[k] = JSON.parse(row[k]) } catch { /* leave as text */ }
    }
  }
  return row
}

/** WHERE clause; numbers in IN lists are written inline (D1 allows only 100 bound values per statement). */
function where(cols, filters, params) {
  const parts = []
  for (const f of filters ?? []) {
    const c = col(cols, f.col)
    if (f.op === 'eq') {
      if (f.value === null) parts.push(`${c} is null`)
      else { parts.push(`${c} = ?`); params.push(value(f.value)) }
    } else if (f.op === 'neq') {
      parts.push(`${c} is not ?`); params.push(value(f.value))
    } else if (f.op === 'is') {
      parts.push(`${c} is null`)
    } else if (f.op === 'ilike') {
      parts.push(`${c} like ? escape '\\'`); params.push(String(f.value))
    } else if (f.op === 'in') {
      const vals = Array.isArray(f.value) ? f.value : []
      if (!vals.length) { parts.push('0'); continue }
      if (vals.every((v) => Number.isInteger(v))) parts.push(`${c} in (${vals.join(',')})`)
      else { parts.push(`${c} in (${vals.map(() => '?').join(',')})`); params.push(...vals.map(value)) }
    } else throw new ApiError(`Unknown filter: ${f.op}`)
  }
  return parts.length ? ` where ${parts.join(' and ')}` : ''
}

async function run(env, q) {
  const write = q.op !== 'select'
  const cols = columnsOf(q.table, write)
  const ret = q.returning === undefined || q.returning === null ? null : pickColumns(cols, q.returning)
  const returning = ret ? ` returning ${ret.join(', ')}` : ''

  if (q.op === 'select') {
    const params = []
    let sql = `select ${pickColumns(cols, q.columns).join(', ')} from ${q.table}${where(cols, q.filters, params)}`
    if (q.order?.length) sql += ' order by ' + q.order.map((o) => `${col(cols, o.col)} ${o.asc === false ? 'desc' : 'asc'}`).join(', ')
    if (q.limit != null) { sql += ' limit ?'; params.push(Number(q.limit)) }
    if (q.offset != null) { sql += (q.limit == null ? ' limit -1' : '') + ' offset ?'; params.push(Number(q.offset)) }
    const { results } = await env.DB.prepare(sql).bind(...params).all()
    return results.map(parseRow)
  }

  if (q.op === 'insert' || q.op === 'upsert') {
    const rows = Array.isArray(q.values) ? q.values : [q.values]
    if (!rows.length) return []
    // Upsert: "ignoreDuplicates" (or no target) = skip rows that already exist; otherwise update the given columns.
    const conflictCols = q.op === 'upsert' && q.onConflict ? q.onConflict.split(',').map((c) => col(cols, c.trim())) : []
    const target = conflictCols.length && (CONFLICT[`${q.table}:${conflictCols.join(',')}`] ?? conflictCols.join(', '))
    // One statement per row (bound-value limit), all in one transaction via batch().
    const stmts = rows.map((r) => {
      const keys = Object.keys(r).map((k) => col(cols, k))
      let sql = `insert into ${q.table} (${keys.join(', ')}) values (${keys.map(() => '?').join(', ')})`
      if (q.op === 'upsert') {
        const set = keys.filter((k) => !conflictCols.includes(k)).map((k) => `${k} = excluded.${k}`)
        if (q.ignoreDuplicates || !target) sql += ' on conflict do nothing'
        else sql += set.length ? ` on conflict (${target}) do update set ${set.join(', ')}` : ` on conflict (${target}) do nothing`
      }
      return env.DB.prepare(sql + returning).bind(...keys.map((k) => value(r[k])))
    })
    const out = []
    for (let i = 0; i < stmts.length; i += 50) {
      const res = await env.DB.batch(stmts.slice(i, i + 50))
      for (const r of res) out.push(...(r.results ?? []).map(parseRow))
    }
    return out
  }

  if (q.op === 'update' || q.op === 'delete') {
    if (!q.filters?.length) throw new ApiError(`${q.op} needs a filter`)
    const params = []
    let sql
    if (q.op === 'update') {
      const keys = Object.keys(q.values ?? {}).map((k) => col(cols, k))
      if (!keys.length) throw new ApiError('Nothing to update')
      sql = `update ${q.table} set ${keys.map((k) => `${k} = ?`).join(', ')}`
      params.push(...keys.map((k) => value(q.values[k])))
    } else sql = `delete from ${q.table}`
    sql += where(cols, q.filters, params) + returning
    const { results } = await env.DB.prepare(sql).bind(...params).all()
    return (results ?? []).map(parseRow)
  }
  throw new ApiError(`Unknown operation: ${q.op}`)
}

async function api(request, env) {
  const url = new URL(request.url)
  const key = request.headers.get('x-team-key') ?? ''
  const keyOk = !!env.TEAM_KEY && key === env.TEAM_KEY

  if (url.pathname === '/api/check-key') return json({ ok: keyOk }, keyOk ? 200 : 401)
  if (url.pathname === '/api/analyze') {
    // Only where a Gemini key is set (the local copy: cloudflare/.dev.vars); the live site just shows pushed results.
    if (request.method === 'GET') return json({ available: !!env.GEMINI_API_KEY, model: geminiModel(env) })
    if (!env.GEMINI_API_KEY) return json({ error: 'Analysis runs on the local copy only (no Gemini key here).', code: 'no_key' }, 404)
    if (!keyOk) return json({ error: 'Enter the team passcode (🔒 at the top right) to save changes.', code: 'passcode' }, 401)
    try {
      const { content_id, model, save } = await request.json()
      return json(await analyze(env, Number(content_id), { model, save }))
    } catch (e) {
      return json({ error: String(e?.message ?? e), code: e?.code ?? 'server_error', detail: e?.detail ?? null }, e?.status ?? 500)
    }
  }
  if (url.pathname !== '/api/db' || request.method !== 'POST') return json({ data: null, error: { message: 'Not found' } }, 404)

  const q = await request.json()
  if (q.op !== 'select' && !keyOk)
    return json({ data: null, error: { message: 'Enter the team passcode (🔒 at the top right) to save changes.' } }, 401)
  try {
    const rows = await run(env, q)
    if (q.single === 'single') {
      if (rows.length !== 1) return json({ data: null, error: { message: `Expected one row, got ${rows.length}` } }, 406)
      return json({ data: rows[0], error: null })
    }
    if (q.single === 'maybe') return json({ data: rows[0] ?? null, error: null })
    return json({ data: rows, error: null })
  } catch (e) {
    const msg = String(e?.message ?? e)
    // Keep the website's existing duplicate check working ("contents_identity" was the Postgres index name).
    const friendly = msg.includes('UNIQUE constraint failed: contents') || msg.includes('contents_identity')
      ? `duplicate key value violates unique constraint "contents_identity"` : msg
    return json({ data: null, error: { message: friendly } }, e instanceof ApiError ? e.status : 400)
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) return api(request, env)
    return env.ASSETS.fetch(request)
  },
}
