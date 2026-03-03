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

import requests

logger = logging.getLogger(__name__)

MINIMAX_API_URL = "https://api.minimaxi.chat/v1/text/chatcompletion_v2"
MAX_RETRIES = 5
RETRY_DELAY = 5
WINDOW_MINUTES = 60

SYSTEM_PROMPT = """You are a senior intelligence analyst producing a concise operational briefing for a crisis management team monitoring the Iran–United States armed conflict (2026) and all connected fronts (Israel, Houthis, Hezbollah, IRGC proxies, Gulf states).

Your output must be suitable for an internal operational email. Every statement must be traceable to the provided data — do not invent, speculate, or add strategic interpretation.

Respond with ONLY valid JSON matching the schema in the user prompt. No markdown wrapping, no extra text."""

USER_PROMPT_TEMPLATE = """Produce an operational briefing for the Iran–US conflict situation.

REPORTING WINDOW: {window_start} to {window_end} (last {window_minutes} minutes)

=== CLASSIFIED ATTACK EVENTS IN THIS WINDOW (ordered by severity) ===
{attacks_block}

=== INTELLIGENCE FEED ARTICLES IN THIS WINDOW (by region) ===
{articles_block}

=== INSTRUCTIONS ===

After the caveat, provide a concise and granular executive summary that strictly describes what occurred during the reporting window without adding strategic interpretation or wider analytical framing. Then present exactly three short trends that directly arise from the events in the document and reflect observable patterns across the reporting hour. Finally, summarise all incidents by country using simplified, operational bullet points that capture every relevant event mentioned in the source material without any speculation or additional commentary. All content should be succinct, fact‑based, and suitable for an internal operational email, relying solely on the information contained in the provided document.

Respond with ONLY this JSON structure:
{{
  "caveat": "A one-sentence caveat noting the reporting window and data limitations",
  "executive_summary": "A concise, granular description of what occurred during this reporting window — no strategic framing",
  "trends": ["trend 1 (short, observable pattern)", "trend 2", "trend 3"],
  "country_summaries": [
    {{
      "country": "Country Name",
      "bullets": ["event bullet 1", "event bullet 2"]
    }}
  ]
}}

Rules:
- If nothing happened in the window, say so explicitly in the executive_summary and return empty trends and country_summaries.
- Use 24h clock and UTC timezone for all times.
- Do NOT add strategic interpretation, forecasts, or wider analytical framing.
- Do NOT speculate beyond the provided data.
- Each country entry should only appear if it had events in the window.
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


def _build_attacks_block(attacks: list[dict]) -> str:
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
        lines.append(
            f"{i}. [{c.get('severity', 'unknown').upper()}] "
            f"({pub}) {a.get('title_en', 'No title')} — "
            f"Category: {c.get('category', 'unknown')}; "
            f"Location: {c.get('location', 'unknown')}; "
            f"Parties: {', '.join(c.get('parties_involved', []))}; "
            f"Brief: {c.get('brief', 'N/A')}"
        )
    return "\n".join(lines)


def _build_articles_block(articles: list[dict]) -> str:
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
            lines.append(
                f"• [{a.get('source_name', '?')}] {a.get('title_en', 'No title')}: "
                f"{(a.get('summary_en', '') or '')[:200]}"
            )
    return "\n".join(lines)


def _call_minimax(api_key: str, user_prompt: str) -> dict | None:
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
        "temperature": 0.15,
        "max_tokens": 3000,
    }

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = requests.post(MINIMAX_API_URL, headers=headers, json=payload, timeout=120)

            if resp.status_code == 429:
                wait = RETRY_DELAY * attempt
                logger.warning(f"Rate limited, waiting {wait}s (attempt {attempt})")
                time.sleep(wait)
                continue

            resp.raise_for_status()
            data = resp.json()

            choices = data.get("choices", [])
            if not choices:
                logger.warning("Empty choices from MiniMax")
                return None

            text = choices[0].get("message", {}).get("content", "").strip()

            # Strip markdown fences
            if text.startswith("```"):
                text = text.split("\n", 1)[-1]
                text = text.rsplit("```", 1)[0].strip()

            result = json.loads(text)
            logger.info("Operational briefing generated successfully")
            return result

        except json.JSONDecodeError as e:
            logger.warning(f"JSON parse error on attempt {attempt}: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY)
        except requests.RequestException as e:
            logger.warning(f"API error on attempt {attempt}: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY)

    logger.error("All MiniMax attempts failed for operational briefing")
    return None


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
        api_key = os.environ.get("MINIMAX_API_KEY", "")

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

    # Build prompt
    user_prompt = USER_PROMPT_TEMPLATE.format(
        window_start=window_start_str,
        window_end=window_end_str,
        window_minutes=WINDOW_MINUTES,
        attacks_block=_build_attacks_block(attacks_window),
        articles_block=_build_articles_block(articles_window),
    )

    result = _call_minimax(api_key, user_prompt)

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
        **result,
    }

    return briefing
