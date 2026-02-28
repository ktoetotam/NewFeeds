"""One-off script to geocode existing attack locations."""
import json
import time
import requests
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
attacks = json.loads((DATA_DIR / "attacks.json").read_text())

headers = {"User-Agent": "iran-region-monitor/1.0 (github.com/ktoetotam/NewFeeds)"}
skip = {"unknown", "multiple locations", "middle east", "region", ""}

for a in attacks:
    if a.get("lat") is not None:
        continue
    loc = (a.get("classification") or {}).get("location", "").strip()
    if not loc or loc.lower() in skip:
        continue
    try:
        r = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": loc, "format": "json", "limit": 1},
            headers=headers,
            timeout=10,
        )
        res = r.json()
        if res:
            a["lat"] = float(res[0]["lat"])
            a["lng"] = float(res[0]["lon"])
            print(f"OK: {loc} -> {a['lat']:.3f},{a['lng']:.3f}")
        else:
            print(f"MISS: {loc}")
        time.sleep(1.1)
    except Exception as e:
        print(f"ERR: {loc}: {e}")

(DATA_DIR / "attacks.json").write_text(
    json.dumps(attacks, ensure_ascii=False, indent=2)
)
print(f"Done. Saved {len(attacks)} attacks.")
