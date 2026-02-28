"""One-off: geocode attacks that have classification.location but no lat/lng."""
import json, time, requests, pathlib

NOMINATIM = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "NewFeedsApp/1.0"}
SKIP = {"unknown", "multiple locations", "middle east", "region", "", "various locations"}

attacks_path = pathlib.Path(__file__).parent.parent / "data" / "attacks.json"
attacks = json.loads(attacks_path.read_text())

geocoded = 0
for attack in attacks:
    if attack.get("lat") and attack.get("lng"):
        continue
    location = (attack.get("classification") or {}).get("location", "").strip()
    if not location or location.lower() in SKIP:
        continue
    try:
        r = requests.get(NOMINATIM, params={"q": location, "format": "json", "limit": 1},
                         headers=HEADERS, timeout=10)
        results = r.json()
        if results:
            attack["lat"] = float(results[0]["lat"])
            attack["lng"] = float(results[0]["lon"])
            print(f"OK: '{location}' -> {attack['lat']:.4f}, {attack['lng']:.4f}")
            geocoded += 1
        else:
            print(f"MISS: '{location}'")
        time.sleep(1.1)
    except Exception as e:
        print(f"ERR: '{location}': {e}")

attacks_path.write_text(json.dumps(attacks, ensure_ascii=False, indent=2))
print(f"\nDone. Geocoded {geocoded} new attacks.")
