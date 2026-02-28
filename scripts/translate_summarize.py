"""
translate_summarize.py — Translate, assess relevance, and summarize articles using MiniMax API.

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

import requests

logger = logging.getLogger(__name__)

MINIMAX_API_URL = "https://api.minimaxi.chat/v1/text/chatcompletion_v2"

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
BATCH_DELAY = 2.5  # seconds between requests (~24 RPM, under 30 RPM limit)

SYSTEM_PROMPT = """
You are an intelligence analyst running a real-time war monitor for the ongoing Iran–United States armed conflict (2026) and all its connected fronts.

CONFLICT CONTEXT:
- Iran and the US are in active armed conflict. Iran has launched ballistic missiles and drones at US bases and carrier groups. The US has struck IRGC assets, nuclear facilities, and Iranian territory. Hostilities are ongoing.
- Active fronts: US strikes on Iran; Iranian retaliation on US bases in Iraq/Syria/Gulf; Houthi attacks on US Navy in Red Sea; Hezbollah activity on Israel's northern border; IRGC proxy operations across Iraq, Syria, Lebanon, Yemen; Israeli operations in Gaza and against Iran-linked targets.
- Priority entities: IRGC, Quds Force, Houthis/Ansar Allah, Hezbollah, Hamas, PMF (Iraq), US CENTCOM, US Navy/5th Fleet, IDF, Russian and Chinese positions on the conflict.

YOUR TASK for each article:
1. Translate the headline to concise English → field "h".
2. Decide RELEVANT (field "r": true/false):
   Mark TRUE for anything touching: military strikes/attacks/casualties, US forces in the region, Iran (military, nuclear, leadership, IRGC), Israeli operations, Houthi/Hezbollah/Hamas/PMF actions, US bases in Iraq/Syria/Qatar/Bahrain/UAE, naval incidents in Gulf/Red Sea/Arabian Sea, missile/drone launches, air-defense intercepts, nuclear developments, proxy operations, Iranian leadership statements on war, US/Israeli official war statements, escalation/de-escalation signals, oil infrastructure attacks, sanctions directly linked to the war.
   Mark FALSE for: domestic Iranian politics unrelated to war, sports, entertainment, weather, local crime, economy (unless oil/sanctions), culture, health (unless bioweapons).
3. If r=true: write a 2-3 sentence English summary → field "s" covering WHO did WHAT to WHOM, WHERE, and the military/strategic significance.
4. If r=false: set "s" to null.

Respond with ONLY valid JSON: {"h": "...", "r": true or false, "s": "..." or null}
"""

# ──────────────────────────────────────────────────────────────


def get_api_key() -> str:
    """Get MiniMax API key from environment."""
    key = os.environ.get("MINIMAX_API_KEY", "")
    if not key:
        raise ValueError("MINIMAX_API_KEY environment variable not set")
    return key


def call_minimax(prompt: str, system_prompt: str, api_key: str) -> str:
    """
    Call MiniMax chat completion API with retry logic.

    Returns the assistant's response text.
    """
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "MiniMax-Text-01",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.1,
        "max_tokens": 350,
    }

    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.post(
                MINIMAX_API_URL,
                headers=headers,
                json=payload,
                timeout=60,
            )

            if resp.status_code == 429:
                wait = RETRY_DELAY * (2 ** attempt)
                logger.warning(f"Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue

            resp.raise_for_status()
            data = resp.json()

            # Handle MiniMax's own rate-limit response (HTTP 200 but status_code 1002)
            base_resp = data.get("base_resp", {})
            if base_resp.get("status_code") == 1002:
                wait = RETRY_DELAY * (2 ** attempt)
                logger.warning(f"MiniMax RPM rate limit (1002), waiting {wait}s...")
                time.sleep(wait)
                continue

            # Extract response text from MiniMax format
            choices = data.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "")

            logger.warning(f"Unexpected API response format: {data}")
            return ""

        except requests.exceptions.Timeout:
            logger.warning(f"Timeout on attempt {attempt + 1}")
            time.sleep(RETRY_DELAY)
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed (attempt {attempt + 1}): {e}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY * (2 ** attempt))

    return ""


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
            'JSON only: {"h":"headline","r":true/false,"s":"summary or null"}'
        )
    else:
        prompt = (
            f"[{lang_name}] {title}\n---\n{content}\n---\n"
            'JSON only: {"h":"English headline","r":true/false,"s":"summary or null"}'
        )

    try:
        response_text = call_minimax(prompt, SYSTEM_PROMPT, api_key)

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

        article["title_en"] = result.get("h") or title
        is_relevant = bool(result.get("r", False))
        article["relevant"] = is_relevant
        summary = result.get("s")
        article["summary_en"] = summary if (is_relevant and summary) else "[Not relevant to Iran–US war monitor]"
        article["translated"] = True

    except json.JSONDecodeError:
        logger.warning(f"JSON parse error for {article.get('id', '?')}, raw: {response_text[:120]}")
        if response_text and len(response_text) > 10:
            article["title_en"] = title
            article["summary_en"] = response_text[:400]
            article["relevant"] = True
            article["translated"] = True
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

    processed = []
    for i, article in enumerate(to_process):
        logger.info(
            f"[{i+1}/{len(to_process)}] {article.get('source_name', '?')} — "
            f"{article.get('title_original', '')[:60]}..."
        )
        result = process_article(article, api_key)
        processed.append(result)

        # Checkpoint after every N articles to avoid losing work on interruption
        if checkpoint_fn and (i + 1) % checkpoint_every == 0:
            checkpoint_fn(already_done + processed + overflow)
            logger.info(f"Checkpoint saved after {i + 1} translated articles")

        if i < len(to_process) - 1:
            time.sleep(BATCH_DELAY)

    relevant_count = sum(1 for a in processed if a.get("relevant") is True)
    irrelevant_count = sum(1 for a in processed if a.get("relevant") is False)
    failed_count = sum(1 for a in processed if not a.get("translated"))
    logger.info(
        f"Done: {relevant_count} relevant, {irrelevant_count} not relevant, "
        f"{failed_count} failed, {len(overflow)} deferred to next run"
    )

    return already_done + processed + overflow
