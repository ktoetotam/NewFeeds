"""
generate_briefing.py — Operational briefing (1-hour window).

Produces a concise, fact-based operational email briefing based
strictly on events from the last 60 minutes. Runs after the executive
summary in the generate-summary workflow.

Output JSON schema:
{
  "generated_at": "ISO-8601",
  "window_minutes": 60,
  "window_start": "ISO-8601",
  "window_end": "ISO-8601",
  "caveat": "...",
  "executive_summary": "...",
  "trends": ["trend 1", "trend 2", "trend 3"],
  "country_summaries": [
    { "country": "Iran", "bullets": ["...", "..."] },
    ...
  ],
  "source_count": { "attacks_analyzed": N, "articles_analyzed": N }
}
"""

import json
import logging
import os
import re
import time
from datetime import datetime, timedelta, timezone

from llm_client import call_llm_json, get_api_key as _get_api_key

logger = logging.getLogger(__name__)

MAX_RETRIES = 5
RETRY_DELAY = 5
WINDOW_MINUTES = 60

SYSTEM_PROMPT = """You are a senior intelligence analyst producing a concise operational briefing for a crisis management team monitoring the Iran–United States armed conflict (2026) and all connected fronts (Israel, Houthis, Hezbollah, IRGC proxies, Gulf states).

Your output must be suitable for an internal operational email. Every statement must be traceable to the provided data — do not invent, speculate, or add strategic interpretation.

LANGUAGE NEUTRALITY — MANDATORY:
Use neutral, analytical language throughout. Never reproduce extremist, propagandistic, or sectarian vocabulary from source material, even when quoting. Apply these substitutions:
- "martyr" / "shahid" → "killed" / "deceased" / "fallen combatant"
- "Zionist" / "Zionist entity" → "Israeli" / "Israel"
- "crusader" → "Western" / "US-led"
- "mujahideen" / "holy warriors" → "fighters" / "militants" / "armed group members"
- "jihad" / "holy war" → "military campaign" / "armed struggle"
- "resistance" (euphemism for armed group) → name the specific group (Hezbollah, Hamas, Houthis, etc.)
- "resistance axis" → "Iran-aligned groups" / "Iran-backed alliance"
- "Great Satan" / "Little Satan" → "United States" / "Israel"
- "infidels" / "apostates" → name the actual party
- "divine victory" / "divine punishment" → describe the actual military outcome
Preserve informational content while stripping all ideological framing.

Respond with ONLY valid JSON matching the schema in the user prompt. No markdown wrapping, no extra text."""

USER_PROMPT_TEMPLATE = """Produce an operational briefing for the Iran–US conflict situation.

REPORTING WINDOW: {window_start} to {window_end} (last {window_minutes} minutes)

=== NUMBERED SOURCE LIST (use [N] to cite inline) ===
{sources_block}

=== CLASSIFIED ATTACK EVENTS IN THIS WINDOW (ordered by severity) ===
{attacks_block}

=== INTELLIGENCE FEED ARTICLES IN THIS WINDOW (by region) ===
{articles_block}

=== INSTRUCTIONS ===

After the caveat, provide a concise and granular executive summary that strictly describes what occurred during the reporting window without adding strategic interpretation or wider analytical framing. Then present exactly three short trends that directly arise from the events in the document and reflect observable patterns across the reporting hour. Finally, summarise all incidents by country using simplified, operational bullet points that capture every relevant event mentioned in the source material without any speculation or additional commentary. All content should be succinct, fact‑based, and suitable for an internal operational email, relying solely on the information contained in the provided document.

IMPORTANT: Use inline citations [N] from the numbered source list above whenever attributing a specific fact or event. Place citations at the END of the sentence or bullet point they support, e.g. "Hezbollah launched UAVs toward northern Israel [3]." Use the most specific source number available; cite multiple numbers if needed, e.g. [2][5].

Respond with ONLY this JSON structure:
{{
  "caveat": "A one-sentence caveat noting the reporting window and data limitations",
  "executive_summary": "A concise, granular description with inline [N] citations",
  "trends": ["trend 1 with [N] citation if applicable", "trend 2", "trend 3"],
  "country_summaries": [
    {{
      "country": "Country Name",
      "bullets": ["event bullet with [N] citation", "event bullet 2"]
    }}
  ]
}}

Rules:
- If nothing happened in the window, say so explicitly in the executive_summary and return empty trends and country_summaries.
- Use 24h clock and UTC timezone for all times.
- Do NOT add strategic interpretation, forecasts, or wider analytical framing.
- Do NOT speculate beyond the provided data.
- Each country entry should only appear if it had events in the window.
- Only cite source numbers that appear in the NUMBERED SOURCE LIST above.
"""


def _filter_window(items: list[dict], minutes: int) -> tuple[list[dict], datetime, datetime]:
    """Return items within the last *minutes*, plus the window boundaries."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=minutes)

    result = []
    for item in items:
        for field in ("published", "fetched_at"):
            raw = item.get(field, "")
            if not raw:
                continue
            try:
                ts = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                if ts >= cutoff:
                    result.append(item)
                    break
            except (ValueError, TypeError):
                continue

    return result, cutoff, now


def _build_source_list(attacks: list[dict], articles: list[dict]) -> list[dict]:
    """Build a unified numbered source list (URL-deduplicated) for citation."""
    sources: list[dict] = []
    seen_urls: set[str] = set()

    severity_order = {"major": 0, "high": 1, "medium": 2, "low": 3}
    attacks_sorted = sorted(
        attacks,
        key=lambda a: (
            severity_order.get(a.get("classification", {}).get("severity", "low"), 3),
            a.get("published", ""),
        ),
    )

    for a in attacks_sorted[:25]:
        url = a.get("url", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            sources.append({
                "index": len(sources) + 1,
                "title": (a.get("title_en") or a.get("title_original") or "Unknown")[:120],
                "url": url,
                "source_name": a.get("source_name", "Unknown"),
            })

    for a in articles[:30]:
        url = a.get("url", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            sources.append({
                "index": len(sources) + 1,
                "title": (a.get("title_en") or a.get("title_original") or "Unknown")[:120],
                "url": url,
                "source_name": a.get("source_name", "Unknown"),
            })

    return sources


def _build_sources_block(sources: list[dict]) -> str:
    if not sources:
        return "No sources available."
    lines = []
    for s in sources:
        lines.append(f"[{s['index']}] {s['source_name']}: {s['title']}")
    return "\n".join(lines)


def _build_attacks_block(attacks: list[dict], source_map: dict[str, int]) -> str:
    if not attacks:
        return "No attack events in this window."

    severity_order = {"major": 0, "high": 1, "medium": 2, "low": 3}
    attacks_sorted = sorted(
        attacks,
        key=lambda a: (
            severity_order.get(a.get("classification", {}).get("severity", "low"), 3),
            a.get("published", ""),
        ),
    )

    lines = []
    for i, a in enumerate(attacks_sorted[:30], 1):
        c = a.get("classification", {})
        pub = a.get("published", "unknown time")
        src_idx = source_map.get(a.get("url", ""), None)
        ref = f" [source {src_idx}]" if src_idx else ""
        lines.append(
            f"{i}. [{c.get('severity', 'unknown').upper()}] "
            f"({pub}) {a.get('title_en', 'No title')}{ref} — "
            f"Category: {c.get('category', 'unknown')}; "
            f"Location: {c.get('location', 'unknown')}; "
            f"Parties: {', '.join(c.get('parties_involved', []))}; "
            f"Brief: {c.get('brief', 'N/A')}"
        )
    return "\n".join(lines)


def _build_articles_block(articles: list[dict], source_map: dict[str, int]) -> str:
    if not articles:
        return "No feed articles in this window."

    by_region: dict[str, list[dict]] = {}
    for a in articles:
        region = a.get("region", "unknown")
        by_region.setdefault(region, []).append(a)

    lines = []
    for region, region_articles in by_region.items():
        lines.append(f"\n--- {region.upper()} ---")
        for a in region_articles[:8]:
            src_idx = source_map.get(a.get("url", ""), None)
            ref = f" [{src_idx}]" if src_idx else ""
            lines.append(
                f"• [{a.get('source_name', '?')}]{ref} {a.get('title_en', 'No title')}: "
                f"{(a.get('summary_en', '') or '')[:200]}"
            )
    return "\n".join(lines)


def _call_llm(api_key: str, user_prompt: str) -> dict | None:
    """Call LLM to generate the operational briefing."""
    result = call_llm_json(
        user_prompt, SYSTEM_PROMPT, api_key,
        temperature=0.15, max_tokens=8192, timeout=300,
        max_retries=MAX_RETRIES, retry_delay=RETRY_DELAY,
        reasoning=True, thinking_budget=2048,
    )
    if result is not None:
        logger.info("Operational briefing generated successfully")
    else:
        logger.error("All LLM attempts failed for operational briefing")
    return result


def generate_briefing(
    attacks: list[dict],
    articles: list[dict],
    api_key: str | None = None,
) -> dict:
    """
    Generate a 1-hour-window operational briefing.

    Returns the enriched briefing dict ready for Supabase.
    """
    if api_key is None:
        api_key = _get_api_key()

    # Filter to 1-hour window
    attacks_window, window_start, window_end = _filter_window(attacks, WINDOW_MINUTES)
    articles_window, _, _ = _filter_window(articles, WINDOW_MINUTES)

    logger.info(
        f"Operational briefing: {len(attacks_window)} attacks, "
        f"{len(articles_window)} articles in last {WINDOW_MINUTES}min"
    )

    # Format times for display
    fmt = "%d %B %Y, %H:%M UTC"
    window_start_str = window_start.strftime(fmt)
    window_end_str = window_end.strftime(fmt)

    # Build source list and map (URL → index)
    sources = _build_source_list(attacks_window, articles_window)
    source_map: dict[str, int] = {s["url"]: s["index"] for s in sources}

    # Build prompt
    user_prompt = USER_PROMPT_TEMPLATE.format(
        window_start=window_start_str,
        window_end=window_end_str,
        window_minutes=WINDOW_MINUTES,
        sources_block=_build_sources_block(sources),
        attacks_block=_build_attacks_block(attacks_window, source_map),
        articles_block=_build_articles_block(articles_window, source_map),
    )

    result = _call_llm(api_key, user_prompt)

    if result is None:
        # Deterministic fallback
        result = {
            "caveat": f"This briefing covers the {WINDOW_MINUTES}-minute window ending {window_end_str}. LLM generation failed — data shown is raw.",
            "executive_summary": (
                f"{len(attacks_window)} attack events and {len(articles_window)} articles "
                f"were recorded in the reporting window. Review individual events for detail."
                if (attacks_window or articles_window)
                else "No events were recorded in the reporting window."
            ),
            "trends": [],
            "country_summaries": [],
        }

    # Enrich with metadata
    briefing = {
        "generated_at": window_end.isoformat(),
        "window_minutes": WINDOW_MINUTES,
        "window_start": window_start.isoformat(),
        "window_end": window_end.isoformat(),
        "window_start_display": window_start_str,
        "window_end_display": window_end_str,
        "source_count": {
            "attacks_analyzed": len(attacks_window),
            "articles_analyzed": len(articles_window),
        },
        "sources": sources,
        **result,
    }

    return briefing
