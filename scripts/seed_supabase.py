"""Seed the new Supabase project from local JSON data files."""
import json
import os
from supabase import create_client

url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_SERVICE_KEY"]
sb = create_client(url, key)

# 1. Upload attacks
with open("../data/attacks.json") as f:
    attacks = json.load(f)
print(f"Loaded {len(attacks)} attacks from local file")

BATCH = 100
for i in range(0, len(attacks), BATCH):
    batch = attacks[i:i+BATCH]
    for a in batch:
        a.pop("effective_time", None)
    sb.table("attacks").upsert(batch, on_conflict="id").execute()
    print(f"  attacks upserted {i+len(batch)}/{len(attacks)}")

# 2. Upload threat_level
with open("../data/threat_level.json") as f:
    tl = json.load(f)
sb.table("threat_level").upsert({
    "id": "current",
    "current_data": tl.get("current", {}),
    "short_term_6h": tl.get("short_term_6h", {}),
    "medium_term_48h": tl.get("medium_term_48h", {}),
    "trend": tl.get("trend", "stable"),
    "history": tl.get("history", []),
    "updated_at": tl.get("updated_at"),
}, on_conflict="id").execute()
print("Uploaded threat_level")

# 3. Upload executive_summary
with open("../data/executive_summary.json") as f:
    es = json.load(f)
sb.table("executive_summary").upsert({
    "id": "current",
    "data": es,
    "generated_at": es.get("generated_at"),
}, on_conflict="id").execute()
print("Uploaded executive_summary")

print("Done!")
