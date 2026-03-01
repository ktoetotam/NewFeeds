"""
generate_summary.py — Generate an executive briefing from attacks, threat level, and feed data.

Uses MiniMax-Text-01 to synthesize a structured, analytical executive summary
in the style of a corporate crisis-management briefing.

Can be run standalone:
    MINIMAX_API_KEY=... python scripts/generate_summary.py

Or called from run_pipeline.py as Step 7.
"""

import json
import logging
import os
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

MINIMAX_API_URL = "https://api.minimaxi.chat/v1/text/chatcompletion_v2"

MAX_RETRIES = 5
RETRY_DELAY = 5
MAX_ATTACKS_IN_PROMPT = 30
MAX_ARTICLES_PER_REGION = 5

# Project paths (for standalone usage)
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_DIR = PROJECT_DIR / "data"
FEEDS_DIR = DATA_DIR / "feeds"
ARCHIVE_DIR = DATA_DIR / "summary_archive"

MAX_ARCHIVE_FILES = 100  # keep last 100 versions

SYSTEM_PROMPT = """You are a senior intelligence analyst producing an executive briefing on the Iran–United States armed conflict (2026) and all connected fronts (Israel, Houthis, Hezbollah, IRGC proxies, Gulf states).

Your audience is a crisis management team that needs an actionable, factual, concise situational overview. Write in a professional, analytical tone — like a NATO SITREP or corporate security briefing.

CRITICAL RULES:
- Base your analysis STRICTLY on the data provided. Do not invent events or details.
- Distinguish clearly between confirmed events and unverified claims.
- When sources disagree or claims are unverified, say so explicitly.
- MULTI-SOURCE CORROBORATION: When the same event is reported by 2 or more independent sources, explicitly note this (e.g. "Confirmed by multiple sources: ..."). Multi-source events should be elevated in priority regardless of source category.
- Prioritize military/security events by severity (major > high > medium > low).
- Use bullet points for clarity. Keep each bullet to 1-2 sentences.
- Use 24h clock and CET timezone for all times.
- Do NOT include any company-specific or organizational recommendations.

UNVERIFIED/EMERGING SECTION — include ALL of the following if present in the data, even from a single source, flagging the source:
- Deaths or incapacitation of heads of state, military commanders, or senior officials
- New explosions, strikes, or attacks not yet corroborated
- Terror attacks or assassinations
- Major supply chain disruptions (port closures, pipeline shutdowns, shipping route blocks)
- Nuclear/WMD escalation signals
- Any single-source claim that, if true, would materially change the situation

Respond with ONLY valid JSON matching the schema described in the user prompt. No markdown wrapping, no extra text."""

OUTPUT_SCHEMA_DESCRIPTION = """
Respond with ONLY this JSON structure:
{
  "executive_summary": "2-4 sentence top-line overview of the current situation — what is happening, what changed, and the trajectory",
  "whats_new": ["bullet 1", "bullet 2", ...],
  "confirmed_events": ["bullet 1", "bullet 2", ...],
  "unverified_emerging": ["bullet 1", "bullet 2", ...],
  "operational_impacts": {
    "people_travel": ["bullet 1", ...],
    "supply_chain": ["bullet 1", ...],
    "market_macro": ["bullet 1", ...]
  },
  "outlook_24_72h": {
    "base_case": "paragraph describing the most likely trajectory",
    "escalation_risks": ["risk 1", "risk 2", ...],
    "de_escalation_pathways": "paragraph on possible de-escalation routes"
  }
}
"""


def get_api_key() -> str:
    """Get MiniMax API key from environment."""
    key = os.environ.get("MINIMAX_API_KEY", "")
    if not key:
        raise ValueError("MINIMAX_API_KEY environment variable is required")
    return key


def load_attacks(filepath: str | Path | None = None) -> list[dict]:
    """Load attack articles from JSON."""
    fp = Path(filepath) if filepath else DATA_DIR / "attacks.json"
    if fp.exists():
        try:
            with open(fp, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return []


def load_threat_level(filepath: str | Path | None = None) -> dict:
    """Load threat level data."""
    fp = Path(filepath) if filepath else DATA_DIR / "threat_level.json"
    if fp.exists():
        try:
            with open(fp, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {}


def load_feed_articles(feeds_dir: str | Path | None = None) -> list[dict]:
    """Load relevant articles from all feed files, most recent first."""
    fd = Path(feeds_dir) if feeds_dir else FEEDS_DIR
    all_articles = []
    if not fd.exists():
        return all_articles
    for fp in fd.glob("*.json"):
        try:
            with open(fp, "r", encoding="utf-8") as f:
                articles = json.load(f)
            # Only relevant, translated articles
            relevant = [
                a for a in articles
                if a.get("relevant") is True and a.get("translated") is True
            ]
            all_articles.extend(relevant)
        except (json.JSONDecodeError, IOError):
            continue
    # Sort by published date, newest first
    all_articles.sort(key=lambda a: a.get("published", ""), reverse=True)
    return all_articles


def build_attacks_block(attacks: list[dict]) -> str:
    """Format attack data for the LLM prompt."""
    if not attacks:
        return "No attack events recorded."

    # Sort by severity priority, then by recency
    severity_order = {"major": 0, "high": 1, "medium": 2, "low": 3}
    sorted_attacks = sorted(
        attacks,
        key=lambda a: (
            severity_order.get(
                a.get("classification", {}).get("severity", "low"), 3
            ),
            # Negate timestamp for descending time order within severity
            a.get("published", ""),
        ),
    )
    # For recency within same severity, reverse the time sort
    sorted_attacks = sorted(
        sorted_attacks,
        key=lambda a: severity_order.get(
            a.get("classification", {}).get("severity", "low"), 3
        ),
    )

    # Cap at MAX_ATTACKS_IN_PROMPT
    selected = sorted_attacks[:MAX_ATTACKS_IN_PROMPT]

    lines = []
    for i, a in enumerate(selected, 1):
        c = a.get("classification", {})
        pub = a.get("published", "unknown time")
        lines.append(
            f"{i}. [{c.get('severity', 'unknown').upper()}] "
            f"({pub}) {a.get('title_en', 'No title')} — "
            f"Category: {c.get('category', 'unknown')}; "
            f"Location: {c.get('location', 'unknown')}; "
            f"Parties: {', '.join(c.get('parties_involved', []))}; "
            f"Brief: {c.get('brief', 'N/A')}"
        )

    return "\n".join(lines)


def build_threat_block(threat: dict) -> str:
    """Format threat level data for the LLM prompt."""
    if not threat:
        return "Threat level data unavailable."

    current = threat.get("current", {})
    short = threat.get("short_term_6h", {})
    medium = threat.get("medium_term_48h", {})
    trend = threat.get("trend", "unknown")
    breakdown = current.get("severity_breakdown", {})

    return (
        f"Current threat level: {current.get('label', 'UNKNOWN')} "
        f"(Level {current.get('level', '?')}/5, Score {current.get('score', 0)})\n"
        f"24h window: {current.get('incident_count', 0)} incidents "
        f"(Major: {breakdown.get('major', 0)}, High: {breakdown.get('high', 0)}, "
        f"Medium: {breakdown.get('medium', 0)}, Low: {breakdown.get('low', 0)})\n"
        f"6h window: {short.get('incident_count', 0)} incidents, "
        f"Level {short.get('label', '?')}\n"
        f"48h window: {medium.get('incident_count', 0)} incidents, "
        f"Level {medium.get('label', '?')}\n"
        f"Trend: {trend}\n"
        f"Last updated: {threat.get('updated_at', 'unknown')}"
    )


def build_articles_block(articles: list[dict]) -> str:
    """Format recent feed articles for the LLM prompt (non-attack context)."""
    if not articles:
        return "No recent feed articles available."

    # Group by region, take top N per region
    by_region: dict[str, list[dict]] = {}
    for a in articles:
        region = a.get("region", "unknown")
        by_region.setdefault(region, []).append(a)

    lines = []
    for region, region_articles in by_region.items():
        top = region_articles[:MAX_ARTICLES_PER_REGION]
        lines.append(f"\n--- {region.upper()} ---")
        for a in top:
            lines.append(
                f"• [{a.get('source_name', '?')}] {a.get('title_en', 'No title')}: "
                f"{a.get('summary_en', 'No summary')}"
            )

    return "\n".join(lines)


def build_user_prompt(attacks: list[dict], threat: dict, articles: list[dict]) -> str:
    """Construct the full user prompt with all data."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    attacks_block = build_attacks_block(attacks)
    threat_block = build_threat_block(threat)
    articles_block = build_articles_block(articles)

    return f"""Generate an executive briefing for the Iran–US conflict situation as of {now}.

=== THREAT LEVEL ===
{threat_block}

=== CLASSIFIED ATTACK EVENTS (ordered by severity, then recency) ===
{attacks_block}

=== RECENT INTELLIGENCE FEED ARTICLES (by region) ===
{articles_block}

=== INSTRUCTIONS ===
Based STRICTLY on the data above, produce a structured executive summary.
- "whats_new": Focus on the most recent developments (last 1-2 hours if timestamps allow, otherwise last 6h).
- "confirmed_events": Events reported by multiple sources or with clear evidence of occurrence.
- "unverified_emerging": Claims from single sources, state propaganda figures, or unconfirmed reports. Always flag the source.
- "operational_impacts": Assess near-term impacts on civilian travel/aviation, maritime/supply chains, and energy markets.
- "outlook_24_72h": Analytical forecast based on the pattern of events, trend, and severity trajectory.

{OUTPUT_SCHEMA_DESCRIPTION}"""


def call_minimax(api_key: str, user_prompt: str) -> dict | None:
    """Call MiniMax API to generate the executive summary."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "MiniMax-M2.5",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 2000,
    }

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.post(
                MINIMAX_API_URL, headers=headers, json=payload, timeout=120
            )

            if resp.status_code == 429:
                wait = RETRY_DELAY * attempt
                logger.warning(f"Rate limited, waiting {wait}s (attempt {attempt})")
                time.sleep(wait)
                continue

            resp.raise_for_status()
            data = resp.json()

            choices = data.get("choices", [])
            if not choices:
                logger.warning("Empty choices in MiniMax response")
                return None

            text = choices[0].get("message", {}).get("content", "").strip()

            # Handle markdown wrapping
            if text.startswith("```"):
                text = text.split("\n", 1)[-1]
                text = text.rsplit("```", 1)[0].strip()

            result = json.loads(text)
            logger.info("Executive summary generated successfully via MiniMax")
            return result

        except json.JSONDecodeError as e:
            logger.warning(f"JSON parse error on attempt {attempt}: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY)
        except requests.RequestException as e:
            logger.warning(f"API request error on attempt {attempt}: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY)

    logger.error("All MiniMax attempts failed for executive summary")
    return None


def build_fallback_summary(attacks: list[dict], threat: dict) -> dict:
    """Build a deterministic fallback summary when LLM is unavailable."""
    current = threat.get("current", {})
    breakdown = current.get("severity_breakdown", {})
    trend = threat.get("trend", "stable")

    # Count attacks by category
    categories: dict[str, int] = {}
    locations: set[str] = set()
    parties: set[str] = set()
    for a in attacks[:MAX_ATTACKS_IN_PROMPT]:
        c = a.get("classification", {})
        cat = c.get("category", "unknown")
        categories[cat] = categories.get(cat, 0) + 1
        loc = c.get("location", "")
        if loc:
            locations.add(loc)
        for p in c.get("parties_involved", []):
            parties.add(p)

    top_categories = sorted(categories.items(), key=lambda x: x[1], reverse=True)[:5]
    cat_summary = "; ".join(f"{cat} ({n})" for cat, n in top_categories)

    major_count = breakdown.get("major", 0)
    high_count = breakdown.get("high", 0)
    total = current.get("incident_count", 0)

    return {
        "executive_summary": (
            f"Threat level is {current.get('label', 'UNKNOWN')} "
            f"(Level {current.get('level', '?')}) with {total} incidents in the last 24 hours "
            f"({major_count} major, {high_count} high). "
            f"Trend: {trend}. "
            f"Top event categories: {cat_summary}."
        ),
        "whats_new": [
            f"{total} classified incidents in the last 24 hours",
            f"Threat trend: {trend}",
        ],
        "confirmed_events": [
            f"{a.get('title_en', 'Unknown event')} — {a.get('classification', {}).get('brief', '')}"
            for a in attacks[:8]
            if a.get("classification", {}).get("severity") in ("major", "high")
        ],
        "unverified_emerging": [
            "Automated fallback — LLM summary unavailable. "
            "Review individual attack cards for source-level detail."
        ],
        "operational_impacts": {
            "people_travel": [
                "Check regional advisories for Gulf states and Israel."
            ],
            "supply_chain": [
                "Monitor Gulf maritime and Red Sea corridor disruptions."
            ],
            "market_macro": [
                "Expect heightened oil and shipping volatility."
            ],
        },
        "outlook_24_72h": {
            "base_case": (
                f"With {total} incidents and a {trend} trend, "
                "continued exchange of strikes and interceptions is the base expectation."
            ),
            "escalation_risks": [
                "Proxy expansion targeting shipping and allied interests.",
                "Civilian harm incidents intensifying diplomatic backlash.",
            ],
            "de_escalation_pathways": (
                "Emergency diplomatic efforts via back-channels remain possible "
                "but no concrete signals observed in current data."
            ),
        },
    }


def archive_current_summary(output_path: Path, archive_dir: Path | None = None) -> Path | None:
    """Archive the current executive_summary.json before overwriting.

    Files are stored as summary_archive/YYYY-MM-DDTHH-MM-SS.json.
    Old archives beyond MAX_ARCHIVE_FILES are pruned.
    """
    if not output_path.exists():
        return None

    ad = archive_dir or ARCHIVE_DIR
    ad.mkdir(parents=True, exist_ok=True)

    try:
        with open(output_path, "r", encoding="utf-8") as f:
            existing = json.load(f)
        ts = existing.get("generated_at", "")
    except (json.JSONDecodeError, IOError):
        ts = ""

    if ts:
        # Sanitize ISO timestamp for filename: replace colons, strip microseconds
        safe_ts = ts.replace(":", "-").replace("+", "_plus_")
        archive_name = f"{safe_ts}.json"
    else:
        archive_name = f"{datetime.now(timezone.utc).strftime('%Y-%m-%dT%H-%M-%S')}.json"

    dest = ad / archive_name
    if dest.exists():
        logger.debug(f"Archive already exists: {dest}")
        return dest

    shutil.copy2(output_path, dest)
    logger.info(f"Archived previous summary to {dest}")

    # Prune old archives
    archives = sorted(ad.glob("*.json"))
    while len(archives) > MAX_ARCHIVE_FILES:
        old = archives.pop(0)
        old.unlink()
        logger.info(f"Pruned old archive: {old.name}")

    return dest


def build_archive_index(archive_dir: Path | None = None, output_path: Path | None = None) -> list[dict]:
    """Build an index of all archived summaries for the frontend.

    Saves a summary_archive/index.json with lightweight metadata per version.
    Returns the index list.
    """
    ad = archive_dir or ARCHIVE_DIR
    if not ad.exists():
        return []

    index = []
    for fp in sorted(ad.glob("*.json"), reverse=True):
        if fp.name == "index.json":
            continue
        try:
            with open(fp, "r", encoding="utf-8") as f:
                data = json.load(f)
            index.append({
                "filename": fp.name,
                "generated_at": data.get("generated_at", ""),
                "threat_label": data.get("threat_snapshot", {}).get("label", ""),
                "threat_level": data.get("threat_snapshot", {}).get("level", 0),
                "trend": data.get("threat_snapshot", {}).get("trend", ""),
                "incident_count_24h": data.get("threat_snapshot", {}).get("incident_count_24h", 0),
                "summary_preview": (data.get("executive_summary", "") or "")[:200],
            })
        except (json.JSONDecodeError, IOError):
            continue

    idx_path = output_path or ad / "index.json"
    with open(idx_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    logger.info(f"Archive index ({len(index)} entries) saved to {idx_path}")
    return index


def generate_and_save(
    attacks: list[dict] | None = None,
    threat: dict | None = None,
    articles: list[dict] | None = None,
    api_key: str | None = None,
    output_path: str | Path | None = None,
) -> dict:
    """
    Main entry point: generate executive summary and save to JSON.

    Can be called from pipeline (with pre-loaded data) or standalone (loads from files).
    """
    # Load data if not provided
    if attacks is None:
        attacks = load_attacks()
    if threat is None:
        threat = load_threat_level()
    if articles is None:
        articles = load_feed_articles()
    if api_key is None:
        api_key = get_api_key()
    if output_path is None:
        output_path = DATA_DIR / "executive_summary.json"

    output_path = Path(output_path)

    # Archive existing summary before overwriting
    archive_current_summary(output_path)

    logger.info(
        f"Generating executive summary from {len(attacks)} attacks, "
        f"{len(articles)} feed articles"
    )

    # Build prompt and call LLM
    user_prompt = build_user_prompt(attacks, threat, articles)
    result = call_minimax(api_key, user_prompt)

    if result is None:
        logger.warning("Using fallback deterministic summary")
        result = build_fallback_summary(attacks, threat)

    # Enrich with metadata
    current = threat.get("current", {})
    summary_data = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "threat_snapshot": {
            "level": current.get("level", 5),
            "label": current.get("label", "UNKNOWN"),
            "color": current.get("color", "#16a34a"),
            "trend": threat.get("trend", "stable"),
            "incident_count_24h": current.get("incident_count", 0),
            "incident_count_6h": threat.get("short_term_6h", {}).get(
                "incident_count", 0
            ),
            "severity_breakdown": current.get("severity_breakdown", {}),
        },
        "source_count": {
            "attacks_analyzed": len(attacks),
            "articles_analyzed": len(articles),
            "regions_covered": sorted(
                set(a.get("region", "unknown") for a in attacks + articles)
            ),
        },
        **result,
    }

    # Save
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(summary_data, f, ensure_ascii=False, indent=2)
    logger.info(f"Executive summary saved to {output_path}")

    # Rebuild archive index
    build_archive_index()

    return summary_data


# ── Standalone execution ──

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    summary = generate_and_save()
    print(json.dumps(summary, indent=2, ensure_ascii=False)[:2000])
