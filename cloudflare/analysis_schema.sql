-- Content analysis (2026-10-06): the Content Analyzer prompts applied to Tracker items.
--   content_text      text pulled from an item's Doc link by scripts/analyze/fetch_content.py (local copy only;
--                     created empty on the live database so the Analyze page can read it there too)
--   content_analysis  Gemini's tags + skeptical quality score per item (POST /api/analyze in worker.js), pushed to
--                     the live database client by client with scripts/analyze/push_results.py
-- No foreign keys on purpose: scripts/restore_data.py empties and re-fills `contents`, which must not wipe these.
-- Safe to re-run: (cd cloudflare && npx wrangler d1 execute skill-assist-tracker --local --file=analysis_schema.sql)

create table if not exists content_text (
  content_id  integer primary key,
  files       text not null default '[]',  -- [{"name":"solution.js","role":"solution","chars":1234}, ...]
  text        text not null default '',    -- every readable file, one "=== name (role) ===" section each
  text_hash   text,
  error       text,                         -- why nothing could be read (not shared publicly, no readable file...)
  fetched_at  text not null
);

create table if not exists content_analysis (
  content_id      integer primary key,
  quality_band    text,     -- Poor | Fair | Good | Excellent
  confidence      text,     -- Low | Medium | High
  low_confidence  integer,  -- 1 = the tags were guessed, a person should check them
  result          text not null,  -- the full JSON answer (tags, sub-scores, flags, summary)
  model           text,
  prompt_version  text,
  text_hash       text,     -- content_text.text_hash it was made from: differs = content changed since
  analyzed_at     text not null
);
