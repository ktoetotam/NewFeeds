"""
classify_attacks.py — Identify and classify military events in the Iran–US war and connected fronts.
Two-stage approach: keyword pre-filter → LLM classification.
"""

import json
import logging
import os
import re
import time

from llm_client import call_llm_json

logger = logging.getLogger(__name__)

# Stage 1: Keyword pre-filter
ATTACK_KEYWORDS = [
    # Direct military actions
    r"\battack\b", r"\bstrike\b", r"\bmissile\b", r"\bdrone\b", r"\bbomb\b",
    r"\bshell(?:ing)?\b", r"\braid\b", r"\bairstrike\b", r"\brocket\b",
    r"\bintercept\b", r"\bshoot(?:ing)?\s*down\b", r"\bexplosion\b",
    r"\boffensive\b", r"\bretaliat\b", r"\bcasualt\b", r"\bkilled\b",
    r"\bwounded\b", r"\bdead\b", r"\bdeaths?\b",
    # Military operations
    r"\bmilitary\s*operation\b", r"\binvasion\b", r"\bescalat\b",
    r"\bceasefire\b", r"\bwar\b", r"\bconflict\b", r"\bclash\b",
    r"\bconfrontat\b", r"\bskirmish\b", r"\bsiege\b", r"\bblockade\b",
    # Nuclear/WMD
    r"\bnuclear\b", r"\benrich\b", r"\buranium\b", r"\bcentrifuge\b",
    r"\bwarhead\b", r"\bballistic\b",
    # Specific actors
    r"\bIRGC\b", r"\bIDF\b", r"\bHezbollah\b", r"\bHouthi\b",
    r"\bAnsar\s*Allah\b", r"\bHamas\b", r"\bPMF\b",
    r"\bIslamic\s*Jihad\b", r"\bQuds\s*Force\b",
    # Infrastructure/targets
    r"\bdeploym\b", r"\bmobiliz\b", r"\bthreat\b",
    r"\bsanction\b", r"\bembargo\b",
    r"\bair\s*defen[cs]e\b", r"\bIron\s*Dome\b",
    # Proxy/asymmetric
    r"\bproxy\b", r"\bmilitia\b", r"\binsurgent\b",
    r"\btunnel\b", r"\bIED\b", r"\bsuicide\b",
    r"\bassassinat\b", r"\btarget(?:ed)?\s*killing\b",
]

ATTACK_PATTERN = re.compile("|".join(ATTACK_KEYWORDS), re.IGNORECASE)


def keyword_prefilter(articles: list[dict]) -> list[dict]:
    """
    Stage 1: Filter articles by military/attack keywords.
    Checks both English title and summary.

    Returns articles that match at least one keyword.
    """
    matched = []
    for article in articles:
        text = " ".join([
            article.get("title_en", ""),
            article.get("summary_en", ""),
        ])
        if ATTACK_PATTERN.search(text):
            # Count keyword matches as a rough priority signal
            matches = ATTACK_PATTERN.findall(text)
            article["keyword_matches"] = len(matches)
            article["matched_keywords"] = list(set(m.lower().strip() for m in matches))
            matched.append(article)

    logger.info(
        f"Keyword pre-filter: {len(matched)}/{len(articles)} articles matched"
    )
    return matched


def classify_with_llm(article: dict, api_key: str) -> dict:
    """
    Stage 2: Use LLM to classify a war-related article.
    Returns classification dict with severity, category, parties, location.
    """
    system_prompt = (
        "Military analyst for Iran–US war 2026 (incl. Israel, Houthis, Hezbollah, IRGC proxies, nuclear). "
        "Respond ONLY with valid JSON, no markdown. "
        "Use neutral, analytical language only. Never reproduce extremist or propagandistic vocabulary from sources. "
        "Replace terms like 'martyr'/'shahid' with 'killed'/'deceased', 'Zionist' with 'Israeli', "
        "'crusader' with 'Western'/'US-led', 'mujahideen' with 'fighters'/'militants', "
        "'jihad' with 'military campaign', 'resistance axis' with 'Iran-aligned groups', "
        "and any other loaded/sectarian terms with factual equivalents."
    )

    # Truncate summary to keep token usage low
    summary = article.get('summary_en', '')[:300]
    title = article.get('title_en', '')[:150]

    prompt = f"""Classify article re Iran–US conflict. JSON only.

TITLE: {title}
SUMMARY: {summary}
REGION: {article.get('region', '')}

{{"is_attack":bool,"category":"us_strike_on_iran|iran_strike_on_us|ballistic_missile|drone_strike|airstrike|naval_incident|houthi_attack|hezbollah_action|proxy_operation|nuclear_development|irgc_action|cyber_attack|threat_statement|escalation|military_deployment|sanctions|ceasefire_violation|other","severity":"major|high|medium|low","parties_involved":["..."],"location":"...","brief":"one sentence"}}

is_attack MUST be false for: political commentary, opinion pieces, domestic political reactions, partisan criticism of military policy, protest coverage, diplomatic statements without concrete military action, election/campaign rhetoric, media/pundit analysis. Only set is_attack=true when the article reports an ACTUAL military event, concrete threat, or direct operational activity.

Severity: major=direct US-Iran engagement/ballistic/nuclear/mass casualties, high=strikes with casualties/major ops, medium=proxy clashes/drones/threats/mobilization, low=sanctions/minor/routine/unconfirmed

location: extract the specific place where the event occurred. If no explicit location in text, infer the country from context (e.g. "Iran", "Israel", "Qatar"). Only use "unspecified" if there is truly zero geographic information."""

    try:
        classification = call_llm_json(
            prompt, system_prompt, api_key,
            temperature=0.1, max_tokens=1000, timeout=60,
            max_retries=3, retry_delay=5,
        )

        if classification is None:
            return default_classification(article)

        # Normalize: LLM sometimes returns "critical" instead of "major"
        if classification.get("severity") == "critical":
            classification["severity"] = "major"

        return classification

    except Exception as e:
        logger.warning(f"LLM classification failed for {article['id']}: {e}")
        return default_classification(article)


def default_classification(article: dict) -> dict:
    """Fallback classification based on keyword analysis."""
    keywords = article.get("matched_keywords", [])
    severity = "low"

    high_severity = {"missile", "airstrike", "killed", "casualties", "nuclear", "invasion"}
    medium_severity = {"attack", "strike", "drone", "rocket", "escalat", "clash"}

    if any(k in high_severity for k in keywords):
        severity = "high"
    elif any(k in medium_severity for k in keywords):
        severity = "medium"

    return {
        "is_attack": True,
        "category": "other",
        "severity": severity,
        "parties_involved": [],
        "location": "Unknown",
        "brief": "Classified by keyword matching (LLM unavailable)",
    }


def _normalize_location(loc: str) -> str:
    """Normalize a location string for dedup comparison."""
    loc = loc.lower().strip()
    # Remove common filler words
    for word in ["international", "airport", "military", "base", "region", "province", "area"]:
        loc = loc.replace(word, "")
    return re.sub(r"\s+", " ", loc).strip()


def _event_key(article: dict) -> str:
    """
    Build a rough event fingerprint from location + time window.
    Articles about the same real-world event should produce the same key.
    """
    cls = article.get("classification", {})
    loc_raw = cls.get("location", "unknown")
    # LLM sometimes returns a list instead of a string
    if isinstance(loc_raw, list):
        loc_raw = loc_raw[0] if loc_raw else "unknown"
    # Take the first / primary location token
    loc = _normalize_location(loc_raw.split(",")[0])

    # Bucket the published timestamp to a 12-hour window (AM/PM)
    pub = article.get("published", "")
    try:
        from datetime import datetime, timezone
        dt = datetime.fromisoformat(pub)
        utc = dt.astimezone(timezone.utc)
        bucket = utc.strftime("%Y-%m-%d-") + ("AM" if utc.hour < 12 else "PM")
    except Exception:
        bucket = "unknown"

    return f"{loc}|{bucket}"


def deduplicate_attacks(attacks: list[dict]) -> list[dict]:
    """
    Group articles that describe the same real-world event and keep the
    best representative (highest severity, then most keyword matches,
    then most recent).
    """
    from collections import defaultdict

    SEVERITY_RANK = {"major": 4, "high": 3, "medium": 2, "low": 1}

    groups: dict[str, list[dict]] = defaultdict(list)
    for a in attacks:
        key = _event_key(a)
        groups[key].append(a)

    deduped = []
    for key, group in groups.items():
        if len(group) == 1:
            deduped.append(group[0])
            continue

        # Pick the best article: highest severity → most keywords → most recent
        group.sort(
            key=lambda a: (
                SEVERITY_RANK.get(a.get("classification", {}).get("severity", "low"), 0),
                a.get("keyword_matches", 0),
                a.get("published", ""),
            ),
            reverse=True,
        )
        best = group[0]
        # Annotate with count of merged sources
        best["merged_source_count"] = len(group)
        deduped.append(best)

        if len(group) > 1:
            logger.info(
                f"Dedup: merged {len(group)} articles for event '{key}' → "
                f"kept '{best.get('title_en', '')[:60]}'"
            )

    logger.info(f"Dedup: {len(attacks)} articles → {len(deduped)} unique events")
    return deduped


def classify_articles(
    articles: list[dict],
    api_key: str | None = None,
    max_classify: int = 70,
) -> list[dict]:
    """
    Full classification pipeline: keyword filter → LLM classification.

    Args:
        articles: All translated articles (flat list)
        api_key: MiniMax API key
        max_classify: Max articles to send to LLM per run

    Returns:
        List of attack-classified articles with classification metadata
    """
    if api_key is None:
        from llm_client import get_api_key
        api_key = get_api_key()

    # Stage 1: Keyword pre-filter
    candidates = keyword_prefilter(articles)

    if not candidates:
        logger.info("No attack-related articles found")
        return []

    # Skip already-classified articles
    to_classify = [a for a in candidates if "classification" not in a]
    already_classified = [a for a in candidates if "classification" in a]

    # Cap LLM calls
    if len(to_classify) > max_classify:
        # Prioritize by keyword match count
        to_classify.sort(key=lambda a: a.get("keyword_matches", 0), reverse=True)
        to_classify = to_classify[:max_classify]

    # Stage 2: LLM classification (concurrent)
    import threading
    from concurrent.futures import ThreadPoolExecutor, as_completed

    MAX_CONCURRENT = int(os.environ.get("LLM_CLASSIFY_CONCURRENCY", "5"))
    semaphore = threading.Semaphore(MAX_CONCURRENT)
    classified = []
    classified_lock = threading.Lock()
    counter = {"done": 0}

    def _classify_one(article):
        with semaphore:
            classification = classify_with_llm(article, api_key)
            article["classification"] = classification
            with classified_lock:
                classified.append(article)
                counter["done"] += 1
                idx = counter["done"]
            logger.info(
                f"Classifying [{idx}/{len(to_classify)}]: {article.get('title_en', '')[:60]}..."
            )

    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT) as executor:
        futures = [executor.submit(_classify_one, article) for article in to_classify]
        for future in as_completed(futures):
            try:
                future.result()
            except Exception as e:
                logger.error(f"Classification task failed: {e}")

    all_classified = already_classified + classified

    # Filter to only actual attacks/security events
    attack_articles = [
        a for a in all_classified
        if a.get("classification", {}).get("is_attack", False)
    ]

    # Deduplicate: merge articles about the same real-world event
    attack_articles = deduplicate_attacks(attack_articles)

    logger.info(
        f"Classification complete: {len(attack_articles)} attack-related articles "
        f"out of {len(candidates)} candidates"
    )

    return attack_articles
