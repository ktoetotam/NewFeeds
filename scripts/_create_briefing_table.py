#!/usr/bin/env python3
"""
One-shot script to create (or verify) the operational_briefing table in Supabase.

The table DDL and RLS cannot be applied via the PostgREST API — they must be run
directly in the Supabase dashboard SQL Editor.  This script checks the current
state and prints the idempotent SQL that should be executed there.
"""
import os
from supabase import create_client

SQL = """
-- Idempotent — safe to re-run at any time.
CREATE TABLE IF NOT EXISTS operational_briefing (
  id           TEXT PRIMARY KEY DEFAULT 'current',
  data         JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ
);
INSERT INTO operational_briefing (id) VALUES ('current') ON CONFLICT (id) DO NOTHING;
ALTER TABLE operational_briefing ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "anon_select_operational_briefing"
  ON operational_briefing FOR SELECT TO anon USING (true);
"""

url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_SERVICE_KEY"]
client = create_client(url, key)

try:
    result = client.table("operational_briefing").select("id").execute()
    print(f"Table exists — {len(result.data)} row(s) found.")
    print("\nRun the following SQL in the Supabase dashboard SQL Editor to ensure")
    print("RLS is enabled (command is idempotent; safe to re-run):\n")
except Exception as e:
    print(f"Table not found ({e}).")
    print("\nRun the following SQL in the Supabase dashboard SQL Editor:\n")

print(SQL)
