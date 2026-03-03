#!/usr/bin/env python3
"""One-shot script to create the operational_briefing table in Supabase."""
import os
from supabase import create_client

url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_SERVICE_KEY"]
client = create_client(url, key)

# Test if table exists
try:
    result = client.table("operational_briefing").select("id").execute()
    print(f"Table already exists! Rows: {len(result.data)}")
except Exception as e:
    print(f"Table not found: {e}")
    print("\nPlease run this SQL in the Supabase dashboard SQL Editor:\n")
    print("""
CREATE TABLE IF NOT EXISTS operational_briefing (
  id           TEXT PRIMARY KEY DEFAULT 'current',
  data         JSONB NOT NULL DEFAULT '{}',
  generated_at TIMESTAMPTZ
);
INSERT INTO operational_briefing (id) VALUES ('current') ON CONFLICT (id) DO NOTHING;
ALTER TABLE operational_briefing ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "anon_select_operational_briefing"
  ON operational_briefing FOR SELECT TO anon USING (true);
""")
