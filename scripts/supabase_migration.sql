-- Supabase Migration for NewFeeds
-- Run this in the Supabase SQL Editor to create all required tables.
-- Safe to re-run (uses IF NOT EXISTS).

-- ============================================================
-- 1. ARTICLES TABLE — stores all feed articles across regions
-- ============================================================
CREATE TABLE IF NOT EXISTS articles (
  id               TEXT PRIMARY KEY,                -- SHA-256 first 16 hex chars of URL
  title_original   TEXT NOT NULL DEFAULT '',
  content_original TEXT,                            -- stripped for irrelevant articles
  url              TEXT NOT NULL DEFAULT '',
  published        TIMESTAMPTZ,
  fetched_at       TIMESTAMPTZ,
  source_name      TEXT NOT NULL DEFAULT '',
  source_category  TEXT NOT NULL DEFAULT 'unknown', -- state | state-aligned | proxy | independent | unknown
  language         TEXT NOT NULL DEFAULT 'en',      -- ISO 639-1
  region           TEXT NOT NULL DEFAULT '',         -- iran, russia, israel, etc.
  skip_translation BOOLEAN NOT NULL DEFAULT FALSE,
  translated       BOOLEAN,                         -- NULL = not yet processed, true = done, false = error
  relevant         BOOLEAN,                         -- NULL = not yet decided, true/false from LLM
  title_en         TEXT,
  summary_en       TEXT,
  -- Computed column for reliable sorting (falls back to fetched_at if published is NULL or in the future)
  effective_time   TIMESTAMPTZ GENERATED ALWAYS AS (
    CASE
      WHEN published IS NOT NULL AND published <= NOW() THEN published
      WHEN fetched_at IS NOT NULL THEN fetched_at
      ELSE '1970-01-01T00:00:00Z'::TIMESTAMPTZ
    END
  ) STORED
);

-- Indexes for the main frontend queries
CREATE INDEX IF NOT EXISTS idx_articles_region_feed
  ON articles (region, effective_time DESC)
  WHERE relevant IS NOT FALSE AND translated = TRUE;

CREATE INDEX IF NOT EXISTS idx_articles_region
  ON articles (region);

CREATE INDEX IF NOT EXISTS idx_articles_fetched
  ON articles (fetched_at DESC);

-- ============================================================
-- 2. ATTACKS TABLE — classified military events (subset of articles)
-- ============================================================
CREATE TABLE IF NOT EXISTS attacks (
  id                  TEXT PRIMARY KEY,             -- same SHA-256 ID as articles
  title_original      TEXT NOT NULL DEFAULT '',
  content_original    TEXT,
  url                 TEXT NOT NULL DEFAULT '',
  published           TIMESTAMPTZ,
  fetched_at          TIMESTAMPTZ,
  source_name         TEXT NOT NULL DEFAULT '',
  source_category     TEXT NOT NULL DEFAULT 'unknown',
  language            TEXT NOT NULL DEFAULT 'en',
  region              TEXT NOT NULL DEFAULT '',
  skip_translation    BOOLEAN NOT NULL DEFAULT FALSE,
  translated          BOOLEAN,
  relevant            BOOLEAN,
  title_en            TEXT,
  summary_en          TEXT,
  -- Attack-specific fields
  keyword_matches     INTEGER DEFAULT 0,
  matched_keywords    TEXT[] DEFAULT '{}',
  classification      JSONB,                        -- {is_attack, category, severity, parties_involved, location, brief}
  merged_source_count INTEGER DEFAULT 1,
  lat                 DOUBLE PRECISION,
  lng                 DOUBLE PRECISION,
  geocode_failed      BOOLEAN DEFAULT FALSE,
  -- Computed sort column
  effective_time      TIMESTAMPTZ GENERATED ALWAYS AS (
    CASE
      WHEN published IS NOT NULL AND published <= NOW() THEN published
      WHEN fetched_at IS NOT NULL THEN fetched_at
      ELSE '1970-01-01T00:00:00Z'::TIMESTAMPTZ
    END
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_attacks_time
  ON attacks (effective_time DESC);

CREATE INDEX IF NOT EXISTS idx_attacks_severity
  ON attacks ((classification->>'severity'));

-- ============================================================
-- 3. THREAT_LEVEL TABLE — singleton row with current threat data
-- ============================================================
CREATE TABLE IF NOT EXISTS threat_level (
  id              TEXT PRIMARY KEY DEFAULT 'current',   -- always 'current'
  current_data    JSONB NOT NULL DEFAULT '{}',          -- {score, level, label, color, incident_count, severity_breakdown, window_hours, computed_at}
  short_term_6h   JSONB NOT NULL DEFAULT '{}',
  medium_term_48h JSONB NOT NULL DEFAULT '{}',
  trend           TEXT NOT NULL DEFAULT 'stable',       -- escalating | de-escalating | stable
  history         JSONB NOT NULL DEFAULT '[]',          -- array of {timestamp, level, label, score, incident_count}
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure the singleton row exists
INSERT INTO threat_level (id) VALUES ('current') ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. EXECUTIVE_SUMMARY TABLE — singleton row with latest summary
-- ============================================================
CREATE TABLE IF NOT EXISTS executive_summary (
  id           TEXT PRIMARY KEY DEFAULT 'current',   -- always 'current'
  data         JSONB NOT NULL DEFAULT '{}',          -- full executive summary JSON blob
  generated_at TIMESTAMPTZ
);

-- Ensure the singleton row exists
INSERT INTO executive_summary (id) VALUES ('current') ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 5. OPERATIONAL_BRIEFING TABLE — 1-hour window operational email briefing
-- ============================================================
CREATE TABLE IF NOT EXISTS operational_briefing (
  id           TEXT PRIMARY KEY DEFAULT 'current',   -- always 'current'
  data         JSONB NOT NULL DEFAULT '{}',          -- full briefing JSON blob
  generated_at TIMESTAMPTZ
);

-- Ensure the singleton row exists
INSERT INTO operational_briefing (id) VALUES ('current') ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE articles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE attacks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_level      ENABLE ROW LEVEL SECURITY;
ALTER TABLE executive_summary ENABLE ROW LEVEL SECURITY;

-- Anon role: read-only access (used by the frontend static build)
CREATE POLICY IF NOT EXISTS "anon_select_articles"
  ON articles FOR SELECT TO anon USING (true);

CREATE POLICY IF NOT EXISTS "anon_select_attacks"
  ON attacks FOR SELECT TO anon USING (true);

CREATE POLICY IF NOT EXISTS "anon_select_threat_level"
  ON threat_level FOR SELECT TO anon USING (true);

CREATE POLICY IF NOT EXISTS "anon_select_executive_summary"
  ON executive_summary FOR SELECT TO anon USING (true);

ALTER TABLE operational_briefing ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "anon_select_operational_briefing"
  ON operational_briefing FOR SELECT TO anon USING (true);

-- Service role bypasses RLS automatically, so no explicit policies needed.
-- The Python pipeline uses the service_role key for all writes.
