// Content analysis with Gemini (2026-10-06): the two Content Analyzer prompts (../../../../Content Analyzer/docs/prompts:
// extract_metadata.md + quality_assess.md) merged into one call per item, so the free daily limit goes twice as far.
// Input: the text scripts/analyze/fetch_content.py put in content_text, plus what the tracker already knows (client,
// track, type, linked TOC topics). Output: one content_analysis row. Called by POST /api/analyze in worker.js.

export const PROMPT_VERSION = 'v1'
export const geminiModel = (env) => env.GEMINI_MODEL || 'gemini-flash-latest'

const BAND = { type: 'STRING', enum: ['Poor', 'Fair', 'Good', 'Excellent'] }
const SUB = { type: 'OBJECT', properties: { band: BAND, note: { type: 'STRING' } }, required: ['band', 'note'] }
const LIST = { type: 'ARRAY', items: { type: 'STRING' } }
// Gemini's structured output: the answer always comes back as JSON of this shape (no prose around it).
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    primary_technology: { type: 'STRING' },
    secondary_technologies: LIST,
    topic: { type: 'STRING' },
    subtopics: LIST,
    proficiency: { type: 'STRING', enum: ['Basic', 'Intermediate', 'Advanced'] },
    learning_objectives: LIST,
    skills_tested: LIST,
    submission_mode: { type: 'STRING', enum: ['code', 'fill-in-template', 'written-plan', 'mcq', 'other'] },
    case_study_coupling: { type: 'STRING', enum: ['Loose', 'Moderate', 'Tight'] },
    rubric_present: { type: 'BOOLEAN' },
    has_template: { type: 'BOOLEAN' },
    has_solution: { type: 'BOOLEAN' },
    max_points: { type: 'INTEGER', nullable: true },
    estimated_minutes: { type: 'INTEGER', nullable: true },
    low_confidence: { type: 'BOOLEAN' },
    quality: {
      type: 'OBJECT',
      properties: {
        overall_band: BAND,
        confidence: { type: 'STRING', enum: ['Low', 'Medium', 'High'] },
        sub_scores: {
          type: 'OBJECT',
          properties: { rubric_coherence: SUB, solution_correctness: SUB, difficulty_alignment: SUB, completeness: SUB, clarity: SUB },
          required: ['rubric_coherence', 'solution_correctness', 'difficulty_alignment', 'completeness', 'clarity'],
        },
        flags: LIST,
        summary: { type: 'STRING' },
      },
      required: ['overall_band', 'confidence', 'sub_scores', 'flags', 'summary'],
    },
  },
  required: ['title', 'primary_technology', 'secondary_technologies', 'topic', 'subtopics', 'proficiency', 'learning_objectives',
             'skills_tested', 'submission_mode', 'case_study_coupling', 'rubric_present', 'has_template', 'has_solution',
             'low_confidence', 'quality'],
}

const INSTRUCTIONS = `You review one training/assessment content item made for Skill Assist, a platform where an AI evaluator
grades participants' work against a detailed problem statement and rubric, without running their code.
Do two separate jobs and return one JSON object.

JOB 1 - TAGS (neutral; do not judge quality here)
- Ground primary_technology and secondary_technologies in evidence, not topic keywords. Only name a technology the
  learner must actually use (write code in it, call its API, configure it, produce an artifact in it), or one shown by a
  file name/extension. A purely written deliverable (backlog, user stories, plan, analysis) gets a process-oriented tag,
  not a programming language, and low_confidence = true. Use short lowercase names: python, java, sql, react,
  spring-boot, selenium, aws-core, power-bi, jira-agile ...
- submission_mode: "code" = the deliverable is source code/queries; "fill-in-template" = a scaffold file is completed;
  "written-plan" = prose/planning; "mcq" = multiple-choice questions; "other" otherwise.
- has_template / has_solution: true only if a template / reference solution is actually present in the files below.
- subtopics, learning_objectives and skills_tested: several short atomic items, not one long one.
- low_confidence = true whenever technology, submission mode or proficiency came from indirect signals (topic label,
  subject area) rather than direct evidence. Be honest: this flag sends the item to a person.

JOB 2 - QUALITY (absolute, skeptical)
- This content was made internally; that is not evidence it is correct. Do not assume the reference solution is right
  because it is labelled as one; judge it like a stranger's work. You cannot run code: judge by reading, and where you
  cannot verify something, lower the confidence and add a flag instead of asserting certainty.
- Score each dimension Poor | Fair | Good | Excellent with a one-sentence note:
  rubric_coherence (criteria/points sum sensibly, cover what is asked, no contradictions or double counting),
  solution_correctness (the reference solution really meets the requirements and expected result; if there is no
  solution, band Poor and say so), difficulty_alignment (the level the task claims or implies matches its real demand),
  completeness (template where one is implied, expected results stated, edge cases and common mistakes covered),
  clarity (unambiguous and self-contained).
- overall_band is your honest read of the whole item, not an average: one badly wrong dimension pulls it down.
- confidence is Low whenever you could not verify correctness with real certainty by reading.
- flags: every material concern, short, even ones already implied by a low band. summary: one skeptical paragraph.`

function prompt(item, text) {
  const topics = (item.topics ?? []).map((t) => {
    const extra = Object.entries(t.data ?? {}).filter(([, v]) => v && String(v) !== t.topic).map(([k, v]) => `${k}: ${v}`)
    return `- ${[t.day_label, t.topic].filter(Boolean).join(' | ')}${extra.length ? ` (${extra.join('; ').slice(0, 400)})` : ''}`
  })
  return `## What the tracker already knows
- Client: ${item.client_name}
- Track: ${item.track_name ?? '(none)'}
- Type: ${item.content_type}${item.sequence_label ? ` ${item.sequence_label}` : ''}
- Name: ${item.name}
- Linked TOC topics (what it was built for):
${topics.join('\n') || '- (none linked)'}

## The item's files (problem statement first, solution last)
${text}`
}

const empty = (r) => !r?.quality?.overall_band || !r.quality.sub_scores || !Object.keys(r.quality.sub_scores).length

// Error with a reason code + details for the Analyze page's error pop-up (web/src/pages/Analyze.tsx).
const fail = (status, code, message, detail = {}) => Object.assign(new Error(message), { status, code, detail })

async function callGemini(env, body, only) {
  let res
  const tried = [] // [{model, status}] - shown in the error pop-up
  // 503 = "model is experiencing high demand" on the free tier: wait and try again, then fall back to the
  // next model (2026-10-06: gemini-flash-latest was overloaded for a while while gemini-3.6-flash answered).
  const models = only ? [only] : [geminiModel(env), ...(env.GEMINI_FALLBACK || 'gemini-3.6-flash').split(',')]
  tries: for (const model of models) {
    for (const wait of [5, 15, 0]) {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.trim()}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify(body),
      })
      tried.push({ model: model.trim(), status: res.status })
      // Free daily limits are per model (2026-10-07: flash-latest used up while 3.6-flash still had quota): next model.
      if (res.status === 429 && /PerDay/i.test(await res.clone().text())) continue tries
      if (res.status !== 503) break tries
      if (wait) await new Promise((r) => setTimeout(r, wait * 1000))
    }
  }
  const data = await res.json().catch(() => ({}))
  const detail = { http_status: res.status, google_message: data?.error?.message ?? null, tried }
  if (res.status === 503) throw fail(503, 'overloaded', 'Gemini is overloaded right now (free tier) - try again in a few minutes.', detail)
  if (res.status === 429) {
    // Google says which quota ran out (…PerMinute… / …PerDay…) and how long to wait.
    const violations = (data?.error?.details ?? []).flatMap((d) => d.violations ?? [])
    const quota = violations.map((v) => v.quotaId ?? v.quotaMetric ?? '').join(', ')
    const retry = (data?.error?.details ?? []).find((d) => d.retryDelay)?.retryDelay ?? null
    const code = /PerDay/i.test(quota) ? 'limit_day' : /PerMinute/i.test(quota) ? 'limit_minute' : 'limit'
    throw fail(429, code, "Gemini's free limit is used up for now - try again later (the per-minute limit clears in a minute, the daily one tomorrow).", { ...detail, quota: quota || null, retry_after: retry })
  }
  if (!res.ok) throw fail(502, 'gemini_error', `Gemini error ${res.status}: ${data?.error?.message ?? 'unknown'}`, detail)
  return data
}

/** opts.model: use just this model; opts.save = false: return the answer without storing it (to compare models). */
export async function analyze(env, contentId, opts = {}) {
  if (!Number.isInteger(contentId)) throw fail(400, 'bad_request', 'content_id missing')
  const item = await env.DB.prepare(
    'select id, client_name, track_name, content_type, sequence_label, name, topics from v_contents where id = ?',
  ).bind(contentId).first()
  if (!item) throw fail(404, 'no_item', `No content item ${contentId}`)
  item.topics = typeof item.topics === 'string' ? JSON.parse(item.topics) : item.topics
  const ct = await env.DB.prepare('select text, text_hash, error from content_text where content_id = ?').bind(contentId).first()
  if (!ct?.text) {
    throw ct?.error
      ? fail(409, 'fetch_failed', `Content could not be fetched: ${ct.error}`, { fetch_error: ct.error })
      : fail(409, 'not_fetched', 'Content not fetched yet: run scripts/analyze/fetch_content.py for this client first.')
  }

  const body = {
    systemInstruction: { parts: [{ text: INSTRUCTIONS }] },
    contents: [{ role: 'user', parts: [{ text: prompt(item, ct.text) }] }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: SCHEMA },
  }
  // Same rule as Content Analyzer: up to 3 tries, and an answer with no quality score counts as a failure.
  let result, model, lastError
  for (let attempt = 1; attempt <= 3 && !result; attempt++) {
    const data = await callGemini(env, body, opts.model)
    model = data.modelVersion ?? geminiModel(env)
    const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    try {
      const parsed = JSON.parse(raw)
      if (empty(parsed)) lastError = 'answer had no quality score'
      else result = parsed
    } catch {
      lastError = `answer was not JSON (${data.candidates?.[0]?.finishReason ?? 'no answer'})`
    }
  }
  if (!result) throw fail(502, 'bad_answer', `Gemini gave no usable answer after 3 tries: ${lastError}`, { last_problem: lastError, model })

  const row = {
    content_id: contentId,
    quality_band: result.quality.overall_band,
    confidence: result.quality.confidence,
    low_confidence: result.low_confidence ? 1 : 0,
    result: JSON.stringify(result),
    model,
    prompt_version: PROMPT_VERSION,
    text_hash: ct.text_hash,
    analyzed_at: new Date().toISOString(),
  }
  if (opts.save === false) return { ...row, result }
  const cols = Object.keys(row)
  await env.DB.prepare(
    `insert into content_analysis (${cols.join(', ')}) values (${cols.map(() => '?').join(', ')})
     on conflict (content_id) do update set ${cols.filter((c) => c !== 'content_id').map((c) => `${c} = excluded.${c}`).join(', ')}`,
  ).bind(...cols.map((c) => row[c])).run()
  return { ...row, result }
}
