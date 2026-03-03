#!/usr/bin/env python3
"""One-time fix: parse double-encoded classification strings in Supabase attacks table."""
import json
from db import get_client

client = get_client()

# Fetch ALL attacks (paginated to handle >1000 rows)
all_rows = []
offset = 0
batch = 1000
while True:
    resp = client.table("attacks").select("id, classification").range(offset, offset + batch - 1).execute()
    all_rows.extend(resp.data)
    if len(resp.data) < batch:
        break
    offset += batch

print(f"Total attacks in Supabase: {len(all_rows)}")

broken = [r for r in all_rows if isinstance(r["classification"], str)]
print(f"Broken (string-encoded): {len(broken)}")

fixed = 0
batch_size = 100
for i in range(0, len(broken), batch_size):
    chunk = broken[i:i + batch_size]
    rows = []
    for r in chunk:
        try:
            parsed = json.loads(r["classification"])
            rows.append({"id": r["id"], "classification": parsed})
        except json.JSONDecodeError:
            print(f"  WARN: could not parse classification for {r['id']}")
    if rows:
        client.table("attacks").upsert(rows, on_conflict="id").execute()
        fixed += len(rows)
        print(f"  Fixed batch {i // batch_size + 1}: {len(rows)} rows")

print(f"\nTotal fixed: {fixed}")

# Verify
resp = client.table("attacks").select("id, classification").limit(5).execute()
for row in resp.data[:3]:
    c = row["classification"]
    if isinstance(c, dict):
        print(f"  OK  {row['id']}: severity={c.get('severity')}")
    else:
        print(f"  BAD {row['id']}: still type={type(c).__name__}")
