#!/usr/bin/env python3
from db import get_client
from datetime import datetime, timezone, timedelta

client = get_client()
now = datetime.now(timezone.utc)
cutoff = (now - timedelta(hours=1)).isoformat()

art = client.table('articles').select('id', count='exact').gte('fetched_at', cutoff).execute()
rel = client.table('articles').select('id', count='exact').gte('fetched_at', cutoff).eq('relevant', True).execute()
atk = client.table('attacks').select('id', count='exact').gte('fetched_at', cutoff).execute()

print(f'Articles fetched last 1h:  {art.count}')
print(f'Relevant articles last 1h: {rel.count}')
print(f'Attacks classified last 1h: {atk.count}')
print()

resp = client.table('articles').select('fetched_at, source_name, relevant, translated').order('fetched_at', desc=True).limit(8).execute()
print('Most recently fetched articles:')
for r in resp.data:
    print(f'  {r["fetched_at"]}  rel={r["relevant"]}  trans={r["translated"]}  {r["source_name"]}')

print()
resp2 = client.table('attacks').select('fetched_at, title_en').order('fetched_at', desc=True).limit(5).execute()
print('Most recently fetched attacks:')
for r in resp2.data:
    print(f'  {r["fetched_at"]}  {(r["title_en"] or "")[:70]}')
