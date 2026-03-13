"""Test Supabase access with the anon key (same as frontend uses)."""
from supabase import create_client
from datetime import datetime, timedelta, timezone
import os

url = os.environ['SUPABASE_URL']
anon_key = os.environ.get('NEXT_PUBLIC_SUPABASE_ANON_KEY') or os.environ.get('SUPABASE_ANON_KEY')
print(f"URL: {url}")
print(f"Anon key: {anon_key[:20]}...")

sb = create_client(url, anon_key)
since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

try:
    resp = (
        sb.table('articles')
        .select('id,title_en,region')
        .eq('translated', True)
        .neq('relevant', False)
        .gte('effective_time', since)
        .order('effective_time', desc=True)
        .limit(5)
        .execute()
    )
    print(f"\nAnon key articles query: {len(resp.data)} rows")
    for r in resp.data:
        print(f"  [{r['region']}] {r.get('title_en','')[:60]}")
except Exception as e:
    print(f"\nAnon key articles query FAILED: {e}")

try:
    resp2 = (
        sb.table('attacks')
        .select('id,title_en')
        .order('effective_time', desc=True)
        .limit(3)
        .execute()
    )
    print(f"\nAnon key attacks query: {len(resp2.data)} rows")
except Exception as e:
    print(f"\nAnon key attacks query FAILED: {e}")

try:
    resp3 = (
        sb.table('threat_level')
        .select('*')
        .eq('id', 'current')
        .single()
        .execute()
    )
    print(f"\nAnon key threat_level query: OK (trend={resp3.data.get('trend')})")
except Exception as e:
    print(f"\nAnon key threat_level query FAILED: {e}")

try:
    resp4 = (
        sb.table('executive_summary')
        .select('*')
        .eq('id', 'current')
        .single()
        .execute()
    )
    print(f"\nAnon key executive_summary query: OK")
except Exception as e:
    print(f"\nAnon key executive_summary query FAILED: {e}")
