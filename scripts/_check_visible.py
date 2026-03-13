from supabase import create_client
from datetime import datetime, timedelta, timezone
import os

sb = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])
since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

total = sb.table('articles').select('id', count='exact').gte('effective_time', since).execute()
visible = sb.table('articles').select('id', count='exact').eq('translated', True).neq('relevant', False).gte('effective_time', since).execute()
hidden = sb.table('articles').select('id', count='exact').eq('relevant', False).gte('effective_time', since).execute()

print(f"Articles in last 24h:           {total.count}")
print(f"Visible (translated+relevant):  {visible.count}")
print(f"Hidden (relevant=False):        {hidden.count}")

# Show the visible ones
rows = sb.table('articles').select('id,title_en,region,relevant,translated,effective_time').eq('translated', True).neq('relevant', False).gte('effective_time', since).order('effective_time', desc=True).limit(20).execute()
for r in rows.data:
    print(f"  [{r['region']}] {r.get('title_en','')[:70]}")
