#!/usr/bin/env python3
"""
Improved geocoder for attacks.json.
Handles vague/multi-part location strings that Nominatim can't resolve directly.
Uses a fallback dictionary for common country & city names and cleans up
verbose location descriptions before querying.
"""
import json, time, re, requests, pathlib

NOMINATIM = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "NewFeedsApp/1.0 (geocoder)"}

# ── Manual fallback coordinates (lat, lng) ──────────────────────────────
FALLBACK = {
    # Countries
    "iran": (32.65, 54.56),
    "israel": (31.50, 34.80),
    "iraq": (33.10, 44.17),
    "syria": (34.80, 38.99),
    "lebanon": (33.85, 35.86),
    "qatar": (25.33, 51.23),
    "bahrain": (26.07, 50.55),
    "kuwait": (29.38, 47.99),
    "jordan": (31.17, 36.94),
    "uae": (24.00, 54.00),
    "united arab emirates": (24.00, 54.00),
    "saudi arabia": (24.71, 46.68),
    # Cities
    "tehran": (35.69, 51.39),
    "tehran, iran": (35.69, 51.39),
    "tel aviv": (32.08, 34.78),
    "tel aviv, israel": (32.08, 34.78),
    "haifa": (32.79, 34.99),
    "haifa, israel": (32.79, 34.99),
    "shiraz": (29.59, 52.58),
    "shiraz, iran": (29.59, 52.58),
    "isfahan": (32.65, 51.68),
    "isfahan, iran": (32.65, 51.68),
    "baghdad": (33.31, 44.39),
    "baghdad, iraq": (33.31, 44.39),
    "erbil": (36.19, 44.01),
    "erbil, iraq": (36.19, 44.01),
    "damascus": (33.51, 36.29),
    "damascus, syria": (33.51, 36.29),
    "doha": (25.29, 51.53),
    "doha, qatar": (25.29, 51.53),
    "riyadh": (24.71, 46.68),
    "dubai": (25.20, 55.27),
    "dubai, uae": (25.20, 55.27),
    "abu dhabi": (24.45, 54.38),
    "abu dhabi, uae": (24.45, 54.38),
    "chabahar": (25.29, 60.64),
    "chabahar, iran": (25.29, 60.64),
    "dezful": (32.38, 48.40),
    "dezful, iran": (32.38, 48.40),
    "minab": (27.10, 57.08),
    "minab, iran": (27.10, 57.08),
    "abiyek": (36.04, 50.52),
    "abiyek, iran": (36.04, 50.52),
    "tabriz": (38.08, 46.29),
    "tabriz, iran": (38.08, 46.29),
    "ahvaz": (31.32, 48.69),
    "ahvaz, iran": (31.32, 48.69),
    "khomein": (33.64, 50.08),
    "khomein, iran": (33.64, 50.08),
    # Regions
    "central israel": (31.90, 34.80),
    "northern israel": (33.06, 35.24),
    "southern israel": (31.25, 34.79),
    "southern iran": (29.00, 54.00),
    "southern lebanon": (33.54, 35.37),
    "northern qatar": (25.98, 51.38),
    "eastern saudi arabia": (26.42, 50.10),
    "gaza": (31.50, 34.47),
    "gaza strip": (31.50, 34.47),
    "galilee": (32.88, 35.30),
    "golan heights": (33.00, 35.75),
    "west bank": (31.95, 35.30),
    "persian gulf": (26.00, 52.00),
    "gulf region": (26.00, 52.00),
    "arabian sea": (15.00, 65.00),
    "red sea": (20.00, 38.00),
    "strait of hormuz": (26.56, 56.25),
    "middle east": (29.00, 47.00),
    "middle east region": (29.00, 47.00),
    # US bases in Middle East
    "us military base in kuwait": (29.39, 47.54),
    "us military bases": (29.00, 47.00),
    "us military base in qatar": (25.12, 51.32),
    "american bases in the region": (29.00, 47.00),
    # Maritime & composite
    "gulf or red sea": (23.00, 43.00),
    "gulf or arabian sea region": (24.00, 58.00),
    "unspecified maritime location": (26.00, 56.00),
    # Border regions
    "israel-lebanon border region": (33.10, 35.30),
    "israel-lebanon border": (33.10, 35.30),
}

# Phrases to strip from location strings before lookup
STRIP_PATTERNS = [
    r"\b(over|around|near|approximately|at least|more than)\s+\d+\s+\w+",
    r"\(.*?\)",                          # parenthetical notes
    r"\b(occupied|central|eastern|western|northern|southern)\b",
    r"\b(airspace|borders|region|area|coast|provinces?|military bases?)\b",
    r"\b(and surrounding|and the Gulf)\b",
    r"US (military )?bases? in\s+",
    r"American bases? in\s+",
    r"IRGC\s+",
]

SKIP = {
    "unknown", "multiple locations", "various locations", 
    "unspecified", "region", "",
}


def clean_location(loc: str) -> str:
    """Strip verbose qualifiers from a location string."""
    cleaned = loc
    for pat in STRIP_PATTERNS:
        cleaned = re.sub(pat, " ", cleaned, flags=re.IGNORECASE)
    # collapse whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,;-")
    return cleaned


def extract_place_candidates(loc: str) -> list[str]:
    """Generate a list of lookup candidates from a location string, ordered best to worst."""
    candidates = []
    
    # 1. Exact original
    candidates.append(loc.strip())
    
    # 2. Cleaned version
    cleaned = clean_location(loc)
    if cleaned and cleaned != loc.strip():
        candidates.append(cleaned)
    
    # 3. Split on separators (, ; and /) and try each part
    parts = re.split(r"[,;/]|\band\b", loc)
    for part in parts:
        p = part.strip()
        if p and len(p) > 2:
            candidates.append(p)
            cp = clean_location(p)
            if cp and cp != p:
                candidates.append(cp)
    
    # Deduplicate preserving order
    seen = set()
    deduped = []
    for c in candidates:
        key = c.lower()
        if key not in seen and key not in SKIP:
            seen.add(key)
            deduped.append(c)
    
    return deduped


def lookup_nominatim(query: str) -> tuple[float, float] | None:
    """Query Nominatim. Returns (lat, lng) or None."""
    try:
        r = requests.get(
            NOMINATIM,
            params={"q": query, "format": "json", "limit": 1},
            headers=HEADERS,
            timeout=10,
        )
        results = r.json()
        if results:
            return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception as e:
        print(f"  ERR querying '{query}': {e}")
    return None


def geocode_location(loc: str) -> tuple[float, float] | None:
    """Try to geocode a location string. Uses fallback table first, then Nominatim."""
    key = loc.lower().strip()
    
    # Check fallback table (exact and cleaned)
    if key in FALLBACK:
        return FALLBACK[key]
    cleaned_key = clean_location(loc).lower()
    if cleaned_key in FALLBACK:
        return FALLBACK[cleaned_key]
    
    # Check each part against fallback
    candidates = extract_place_candidates(loc)
    for c in candidates:
        ck = c.lower()
        if ck in FALLBACK:
            return FALLBACK[ck]
    
    # Try Nominatim with candidates
    for c in candidates:
        result = lookup_nominatim(c)
        if result:
            return result
        time.sleep(1.1)  # respect rate limit
    
    return None


def geocode_attacks(attacks: list[dict], logger=None) -> list[dict]:
    """Add lat/lng to attacks that have a location but no coordinates yet.

    This is the main entry-point used by run_pipeline.py.
    Returns the same list with coordinates filled in where possible.
    """
    import logging as _logging
    log = logger or _logging.getLogger("geocode")

    total = len(attacks)
    already = sum(1 for a in attacks if a.get("lat") is not None)
    log.info(f"Geocoder: {total} attacks, {already} already have coords")

    geocoded = 0
    failed = []

    for attack in attacks:
        if attack.get("lat") is not None and attack.get("lng") is not None:
            continue

        location = (attack.get("classification") or {}).get("location", "").strip()
        if not location or location.lower() in SKIP:
            failed.append(("(no location)", attack))
            continue

        coords = geocode_location(location)
        if coords:
            attack["lat"] = coords[0]
            attack["lng"] = coords[1]
            log.info(f"Geocoded '{location}' -> {coords[0]:.4f}, {coords[1]:.4f}")
            geocoded += 1
        else:
            log.warning(f"Geocode MISS: '{location}'")
            failed.append((location, attack))

    log.info(f"Geocoded {geocoded} new attacks. Total with coords: {already + geocoded}/{total}")

    if failed:
        log.info(f"Still missing coords ({len(failed)}):")
        for loc, a in failed:
            title = (a.get("title_en") or a.get("title_original", ""))[:70]
            log.info(f"  '{loc}' -- {title}")

    return attacks


def main():
    """Standalone CLI entry-point."""
    import logging as _logging
    _logging.basicConfig(level=_logging.INFO, format="%(message)s")

    attacks_path = pathlib.Path(__file__).parent.parent / "data" / "attacks.json"
    attacks = json.loads(attacks_path.read_text())

    attacks = geocode_attacks(attacks)

    attacks_path.write_text(json.dumps(attacks, ensure_ascii=False, indent=2))
    print("Done.")


if __name__ == "__main__":
    main()
