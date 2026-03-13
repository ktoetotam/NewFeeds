"""
translate_summarize.py — Translate, assess relevance, and summarize articles using LLM API.

Focused on monitoring the Iran–US war and all connected fronts.
Single LLM call per article:
  1. Translate title to English
  2. LLM decides relevance in the context of the Iran–US conflict
  3. If relevant: produce focused 2-3 sentence English summary
  4. If not relevant: store translated title only
"""

import json
import logging
import os
import time
import threading

from llm_client import call_llm, get_api_key

# Lazy import to avoid circular dependency — only used for English pre-filter
def _get_attack_pattern():
    from classify_attacks import ATTACK_PATTERN
    return ATTACK_PATTERN

logger = logging.getLogger(__name__)

LANGUAGE_NAMES = {
    "fa": "Persian (Farsi)",
    "ru": "Russian",
    "ar": "Arabic",
    "he": "Hebrew",
    "en": "English",
}

# Rate limiting
MAX_RETRIES = 5
RETRY_DELAY = 5   # seconds base for rate-limit backoff
BATCH_DELAY = 0.2  # seconds between requests (~300 RPM, well under 500 RPM limit)

SYSTEM_PROMPT = """
You are an intelligence analyst running a real-time war monitor for the ongoing Iran–United States armed conflict (2026) and all its connected fronts.

CONFLICT CONTEXT:
- Iran and the US are in active armed conflict. Iran has launched ballistic missiles and drones at US bases and carrier groups. The US has struck IRGC assets, nuclear facilities, and Iranian territory. Hostilities are ongoing.
- Active fronts: US strikes on Iran; Iranian retaliation on US bases in Iraq/Syria/Gulf; Houthi attacks on US Navy in Red Sea; Hezbollah activity on Israel's northern border; IRGC proxy operations across Iraq, Syria, Lebanon, Yemen; Israeli operations in Gaza and against Iran-linked targets.
- Priority entities: IRGC, Quds Force, Houthis/Ansar Allah, Hezbollah, Hamas, PMF (Iraq), US CENTCOM, US Navy/5th Fleet, IDF, Russian and Chinese positions on the conflict.

YOUR TASK for each article:
1. Decide RELEVANT (field "r": true/false):
   Mark TRUE for anything touching: military strikes/attacks/casualties, US forces in the region, Iran (military, nuclear, leadership, IRGC), Israeli operations, Houthi/Hezbollah/Hamas/PMF actions, US bases in Iraq/Syria/Qatar/Bahrain/UAE, naval incidents in Gulf/Red Sea/Arabian Sea, missile/drone launches, air-defense intercepts, nuclear developments, proxy operations, Iranian leadership statements on war, US/Israeli official war statements, escalation/de-escalation signals, oil infrastructure attacks, sanctions directly linked to the war, civilian displacement/evacuation caused by the conflict, travel disruptions (stranded ships, closed airspace, port closures, flight diversions) caused by hostilities, humanitarian consequences of military operations, embassy closures or evacuations.
   Mark FALSE for: domestic Iranian politics unrelated to war, sports, entertainment, weather, local crime, economy (unless oil/sanctions/war-related disruption), culture, health (unless bioweapons).
2. If r=true: translate the headline to concise English → field "h". Write a 2-3 sentence English summary → field "s" covering WHO did WHAT to WHOM, WHERE, and the military/strategic significance.
3. If r=false: set "h" to null and "s" to null — do not translate.
4. Always output "c": a JSON array of country names (English, official short form) that are meaningfully mentioned in the article — e.g. ["Iran", "United States", "Israel"]. Include only sovereign states actually referenced, not vague regions. Use empty array [] if none.

LANGUAGE NEUTRALITY — MANDATORY:
Your output must use neutral, analytical language. NEVER reproduce extremist, propagandistic, or sectarian vocabulary from source material. Apply these substitutions consistently:
- "martyr" / "shahid" → "killed" / "deceased" / "fallen combatant" (as appropriate)
- "Zionist" / "Zionist entity" → "Israeli" / "Israel"
- "crusader" → "Western" / "US-led" (as appropriate)
- "mujahideen" / "holy warriors" → "fighters" / "militants" / "armed group members"
- "jihad" / "holy war" → "military campaign" / "armed struggle"
- "resistance" (as euphemism for armed group) → name the specific group (Hezbollah, Hamas, Houthis, etc.)
- "resistance axis" → "Iran-aligned groups" / "Iran-backed alliance"
- "Great Satan" / "Little Satan" → "United States" / "Israel"
- "infidels" / "apostates" → name the actual party
- "divine victory" / "divine punishment" → describe the actual military outcome
If the source uses loaded terms, replace them with factual equivalents. Preserve the informational content while stripping ideological framing.

Respond with ONLY valid JSON: {"r": true or false, "h": "..." or null, "s": "..." or null, "c": ["Country", ...]}
"""

# ──────────────────────────────────────────────────────────────


# get_api_key and call_llm are imported from llm_client


def process_article(article: dict, api_key: str) -> dict:
    """
    Single LLM call per article:
      - Translates title to English
      - LLM judges relevance to the Iran-US war
      - Produces summary only if relevant
    """
    language = article.get("language", "en")
    lang_name = LANGUAGE_NAMES.get(language, language)
    title = article.get("title_original", "")[:200]
    content = article.get("content_original", "")[:700]

    if language == "en":
        prompt = (
            f"[English] {title}\n---\n{content}\n---\n"
            'JSON only: {"r":true/false,"h":"English headline or null","s":"summary or null","c":["Country","..."]}'
        )
    else:
        prompt = (
            f"[{lang_name}] {title}\n---\n{content}\n---\n"
            'JSON only: {"r":true/false,"h":"English headline or null (only if r=true)","s":"summary or null","c":["Country","..."]}'
        )

    try:
        response_text = call_llm(
            prompt, SYSTEM_PROMPT, api_key,
            temperature=0.1, max_tokens=600, timeout=60,
            max_retries=MAX_RETRIES, retry_delay=RETRY_DELAY,
        )

        if not response_text:
            article["title_en"] = title
            article["summary_en"] = f"[API unavailable — {lang_name} source]"
            article["translated"] = False
            return article

        response_text = response_text.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[-1]
            response_text = response_text.rsplit("```", 1)[0].strip()

        result = json.loads(response_text)

        is_relevant = bool(result.get("r", False))
        article["relevant"] = is_relevant
        if is_relevant:
            article["title_en"] = result.get("h") or title
            article["summary_en"] = result.get("s") or ""
            article["translated"] = True
        else:
            article["title_en"] = title
            article["summary_en"] = ""
            article["translated"] = False
        # Countries mentioned
        countries = result.get("c", [])
        article["countries_mentioned"] = [str(c) for c in countries] if isinstance(countries, list) else []
    except json.JSONDecodeError:
        logger.warning(f"JSON parse error for {article.get('id', '?')}, raw: {response_text[:120]}")
        # Try to salvage fields from truncated/malformed JSON via regex
        import re
        h_match = re.search(r'"h"\s*:\s*"((?:[^"\\]|\\.)*)"?', response_text)
        s_match = re.search(r'"s"\s*:\s*"((?:[^"\\]|\\.)*)"?', response_text)
        r_match = re.search(r'"r"\s*:\s*(true|false)', response_text)
        if h_match or s_match:
            article["title_en"] = (h_match.group(1) if h_match else title)
            article["summary_en"] = (s_match.group(1) if s_match else (h_match.group(1) if h_match else ""))
            article["relevant"] = (r_match.group(1) == "true") if r_match else True
            article["translated"] = True
            article["countries_mentioned"] = []
        else:
            article["title_en"] = title
            article["summary_en"] = f"[Parse error — {lang_name} source]"
            article["translated"] = False
    except Exception as e:
        logger.error(f"Processing failed for {article.get('id', '?')}: {e}")
        article["title_en"] = title
        article["summary_en"] = f"[Error: {str(e)[:100]}]"
        article["translated"] = False

    return article


def translate_articles(
    articles: list[dict],
    api_key: str | None = None,
    max_articles: int = 80,
    checkpoint_every: int = 10,
    checkpoint_fn=None,
) -> list[dict]:
    """
    Process all pending articles through the LLM:
      - Skip already-processed articles (translated is not None)
      - Each article gets: English title + relevance judgment + summary
      - Cap at max_articles per run; overflow picked up next run
      - Calls checkpoint_fn(current_articles) every checkpoint_every articles if provided
    """
    if api_key is None:
        api_key = get_api_key()

    # English / skip_translation articles don't need LLM for translation.
    # Set title_en and mark translated so they don't stay "pending".
    # They still go through the LLM for relevance + summary if not yet classified.
    for a in articles:
        if a.get("translated") is None and a.get("skip_translation"):
            a["title_en"] = a.get("title_original", "")
            a["translated"] = True
            logger.debug(f"Auto-completed skip_translation article {a.get('id')}")

    # Pre-filter English articles: if no war-related keywords appear in the
    # title + content, mark as not relevant immediately — no LLM call needed.
    try:
        attack_pattern = _get_attack_pattern()
        skipped_by_prefilter = 0
        for a in articles:
            if a.get("skip_translation") and a.get("relevant") is None:
                text = " ".join([
                    a.get("title_original", ""),
                    a.get("content_original", ""),
                ])
                if not attack_pattern.search(text):
                    a["relevant"] = False
                    skipped_by_prefilter += 1
        if skipped_by_prefilter:
            logger.info(f"Keyword pre-filter: skipped {skipped_by_prefilter} English articles (no war keywords)")
    except Exception as e:
        logger.warning(f"Keyword pre-filter unavailable: {e}")

    already_done = [a for a in articles if a.get("translated") is not None]

    # Among already-done, find skip_translation articles still needing relevance
    need_relevance = [a for a in already_done if a.get("skip_translation") and a.get("relevant") is None]
    need_relevance_ids = {a["id"] for a in need_relevance}
    # Remove need_relevance from already_done to avoid duplicates after processing
    already_done = [a for a in already_done if a["id"] not in need_relevance_ids]
    to_process = [a for a in articles if a.get("translated") is None]

    # Include English articles needing relevance classification in this run
    to_process = need_relevance + to_process

    if not to_process:
        logger.info("No new articles to process")
        return articles

    if len(to_process) > max_articles:
        logger.info(f"Capping: {len(to_process)} pending, processing {max_articles} this run")
        overflow = to_process[max_articles:]
        to_process = to_process[:max_articles]
    else:
        overflow = []

    logger.info(f"Processing {len(to_process)} articles via LLM (Iran–US war context)")

    # Concurrent LLM calls with a semaphore to respect rate limits (~480 RPM)
    MAX_CONCURRENT = int(os.environ.get("LLM_CONCURRENCY", "8"))
    semaphore = threading.Semaphore(MAX_CONCURRENT)

    processed = []
    processed_lock = threading.Lock()
    counter = {"done": 0}

    def _process_one(article):
        with semaphore:
            result = process_article(article, api_key)
            with processed_lock:
                processed.append(result)
                counter["done"] += 1
                idx = counter["done"]

            logger.info(
                f"[{idx}/{len(to_process)}] {'✓ RELEVANT' if result.get('relevant') else '✗ irrelevant'} | "
                f"{article.get('source_name', '?')} — "
                f"{(result.get('title_en') or article.get('title_original', ''))[:80]}"
            )

            # Checkpoint after every N articles to avoid losing work on interruption
            if checkpoint_fn and idx % checkpoint_every == 0:
                with processed_lock:
                    snapshot = list(processed)
                checkpoint_fn(already_done + snapshot + overflow)
                logger.info(f"Checkpoint saved after {idx} translated articles")

    from concurrent.futures import ThreadPoolExecutor, as_completed

    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT) as executor:
        futures = [executor.submit(_process_one, article) for article in to_process]
        for future in as_completed(futures):
            try:
                future.result()
            except Exception as e:
                logger.error(f"Translation task failed: {e}")

    relevant_count = sum(1 for a in processed if a.get("relevant") is True)
    irrelevant_count = sum(1 for a in processed if a.get("relevant") is False)
    failed_count = sum(1 for a in processed if not a.get("translated"))
    logger.info(
        f"Done: {relevant_count} relevant, {irrelevant_count} not relevant, "
        f"{failed_count} failed, {len(overflow)} deferred to next run"
    )

    # Log all relevant articles for visibility in CI logs
    relevant_articles = [a for a in processed if a.get("relevant") is True]
    if relevant_articles:
        logger.info(f"── Relevant articles ({len(relevant_articles)}) ──")
        for a in relevant_articles:
            title = (a.get("title_en") or a.get("title_original", ""))[:100]
            region = a.get("region", "?")
            source = a.get("source_name", "?")
            logger.info(f"  [{region}] {source}: {title}")

    return already_done + processed + overflow
