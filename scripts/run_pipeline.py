"""
run_pipeline.py — Main orchestrator for the news fetch → translate → classify → deploy pipeline.

Usage:
    MINIMAX_API_KEY=... python scripts/run_pipeline.py
"""

import json
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import yaml

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("pipeline")

# Project paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DATA_DIR = PROJECT_DIR / "data"
FEEDS_DIR = DATA_DIR / "feeds"
SOURCES_FILE = SCRIPT_DIR / "sources.yaml"

# Ensure data directories exist
FEEDS_DIR.mkdir(parents=True, exist_ok=True)

# Max age for articles (days)
MAX_ARTICLE_AGE_DAYS = 7

# Max age for *new* articles to ingest (minutes)
MAX_NEW_ARTICLE_AGE_MINUTES = 30


def load_sources() -> dict:
    """Load sources configuration from YAML."""
    with open(SOURCES_FILE, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_existing_articles(region: str) -> list[dict]:
    """Load existing articles for a region from JSON."""
    filepath = FEEDS_DIR / f"{region}.json"
    if filepath.exists():
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            logger.warning(f"Could not load {filepath}, starting fresh")
    return []


def load_existing_attacks() -> list[dict]:
    """Load existing attack articles."""
    filepath = DATA_DIR / "attacks.json"
    if filepath.exists():
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return []


def save_articles(region: str, articles: list[dict]):
    """Save articles for a region to JSON, deduplicating by ID."""
    seen: set[str] = set()
    unique: list[dict] = []
    for a in articles:
        aid = a.get("id", "")
        if aid and aid not in seen:
            seen.add(aid)
            unique.append(a)
    if len(unique) < len(articles):
        logger.warning(f"Removed {len(articles) - len(unique)} duplicate IDs before saving {region}")
    filepath = FEEDS_DIR / f"{region}.json"
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(unique, f, ensure_ascii=False, indent=2)
    logger.info(f"Saved {len(unique)} articles to {filepath}")


def save_attacks(articles: list[dict]):
    """Save classified attack articles, sorted most-recent first."""
    articles.sort(key=lambda a: a.get("published", ""), reverse=True)
    filepath = DATA_DIR / "attacks.json"
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)
    logger.info(f"Saved {len(articles)} attack articles to {filepath}")


# geocode_attacks is now imported from geocode_improved at call-site (Step 5b)


def deduplicate(existing: list[dict], new: list[dict]) -> list[dict]:
    """Merge new articles into existing, deduplicating by ID."""
    existing_ids = {a["id"] for a in existing}
    unique_new = [a for a in new if a["id"] not in existing_ids]
    logger.info(f"Dedup: {len(new)} fetched, {len(unique_new)} new, {len(existing)} existing")
    return unique_new


def filter_since_last_fetch(existing: list[dict], fetched: list[dict]) -> list[dict]:
    """Drop fetched articles published before the newest existing article."""
    if not existing:
        return fetched
    # Find the newest published timestamp in existing data
    newest_ts = None
    for a in existing:
        try:
            dt = datetime.fromisoformat(a.get("published", ""))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if newest_ts is None or dt > newest_ts:
                newest_ts = dt
        except (ValueError, TypeError):
            pass
    if newest_ts is None:
        return fetched
    filtered = []
    for a in fetched:
        try:
            dt = datetime.fromisoformat(a.get("published", ""))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if dt > newest_ts:
                filtered.append(a)
        except (ValueError, TypeError):
            filtered.append(a)  # keep if date is unparseable
    skipped = len(fetched) - len(filtered)
    if skipped:
        logger.info(f"Skipped {skipped} articles older than newest existing ({newest_ts.isoformat()})")
    return filtered


def prune_old_articles(articles: list[dict], max_days: int = MAX_ARTICLE_AGE_DAYS) -> list[dict]:
    """Remove articles older than max_days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_days)
    pruned = []
    for article in articles:
        try:
            pub_dt = datetime.fromisoformat(article.get("published", ""))
            if pub_dt.tzinfo is None:
                pub_dt = pub_dt.replace(tzinfo=timezone.utc)
            if pub_dt >= cutoff:
                pruned.append(article)
        except (ValueError, TypeError):
            # Keep articles with unparseable dates (they might be recent)
            pruned.append(article)

    removed = len(articles) - len(pruned)
    if removed > 0:
        logger.info(f"Pruned {removed} articles older than {max_days} days")
    return pruned


def filter_fresh_articles(
    articles: list[dict], max_age_minutes: int = MAX_NEW_ARTICLE_AGE_MINUTES
) -> list[dict]:
    """Keep only articles published within the last `max_age_minutes` minutes."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=max_age_minutes)
    fresh = []
    for article in articles:
        try:
            pub_dt = datetime.fromisoformat(article.get("published", ""))
            if pub_dt.tzinfo is None:
                pub_dt = pub_dt.replace(tzinfo=timezone.utc)
            if pub_dt >= cutoff:
                fresh.append(article)
        except (ValueError, TypeError):
            # Keep articles with unparseable dates (might be recent)
            fresh.append(article)

    dropped = len(articles) - len(fresh)
    if dropped:
        logger.info(
            f"Freshness filter: dropped {dropped}/{len(articles)} articles older than {max_age_minutes} min"
        )
    return fresh


def run():
    """Main pipeline execution."""
    logger.info("=" * 60)
    logger.info("Starting news pipeline")
    logger.info("=" * 60)

    # Check API key
    api_key = os.environ.get("MINIMAX_API_KEY", "")
    if not api_key:
        logger.error("MINIMAX_API_KEY not set. Set it as an environment variable.")
        sys.exit(1)

    # Test mode: limit to one region, 3 articles
    test_mode = os.environ.get("TEST_MODE", "").lower() in ("1", "true", "yes")
    if test_mode:
        logger.info("*** TEST MODE: 1 region, 3 articles ***")

    # Load sources
    sources = load_sources()
    if test_mode:
        # Keep only the first region
        regions = sources.get("regions", {})
        first_key = next(iter(regions))
        first_region = regions[first_key]
        # Keep only the first source in that region
        if first_region.get("sources"):
            first_region["sources"] = first_region["sources"][:1]
        sources["regions"] = {first_key: first_region}
    logger.info(f"Loaded {sum(len(r.get('sources', [])) for r in sources.get('regions', {}).values())} sources")

    # ── Step 1: Fetch articles ──
    logger.info("── Step 1: Fetching articles ──")

    from fetch_rss import fetch_all_rss
    from fetch_scrape import fetch_all_scrape
    from fetch_telegram import fetch_all_telegram

    rss_articles = fetch_all_rss(sources)
    scrape_articles = fetch_all_scrape(sources)
    telegram_articles = fetch_all_telegram(sources)

    # Merge RSS, scrape, and Telegram results by region
    all_fetched = {}
    for region in sources.get("regions", {}).keys():
        all_fetched[region] = (
            rss_articles.get(region, [])
            + scrape_articles.get(region, [])
            + telegram_articles.get(region, [])
        )

    total_fetched = sum(len(v) for v in all_fetched.values())
    logger.info(f"Total fetched: {total_fetched} articles across {len(all_fetched)} regions")

    # ── Step 1b: Drop articles older than 30 minutes ──
    logger.info(f"── Step 1b: Freshness filter ({MAX_NEW_ARTICLE_AGE_MINUTES} min) ──")
    for region in list(all_fetched.keys()):
        all_fetched[region] = filter_fresh_articles(all_fetched[region])

    total_after_fresh = sum(len(v) for v in all_fetched.values())
    logger.info(f"After freshness filter: {total_after_fresh} articles remain")

    # ── Step 2: Deduplicate against existing ──
    logger.info("── Step 2: Deduplicating ──")

    new_by_region = {}
    for region, articles in all_fetched.items():
        existing = load_existing_articles(region)
        recent_articles = filter_since_last_fetch(existing, articles)
        new_articles = deduplicate(existing, recent_articles)
        new_by_region[region] = (existing, new_articles)

    total_new = sum(len(new) for _, new in new_by_region.values())
    total_existing_untranslated = sum(
        sum(1 for a in existing if a.get("translated") is None)
        for existing, _ in new_by_region.values()
    )
    logger.info(f"Total new articles: {total_new}, existing untranslated: {total_existing_untranslated}")

    if total_new == 0 and total_existing_untranslated == 0:
        logger.info("No new or untranslated articles found. Updating threat level and exiting.")
        # Still update threat level with existing data
        all_existing = []
        for region in sources.get("regions", {}).keys():
            all_existing.extend(load_existing_articles(region))

        existing_attacks = load_existing_attacks()

        from threat_level import compute_and_save_threat_level
        compute_and_save_threat_level(
            existing_attacks, str(DATA_DIR / "threat_level.json")
        )
        logger.info("Pipeline complete (no new or untranslated articles)")
        return

    # ── Step 3: Translate new articles ──
    logger.info("── Step 3: Translating ──")

    from translate_summarize import translate_articles

    max_per_region = int(os.environ.get("MAX_PER_REGION", "3" if test_mode else "80"))

    all_translated = {}
    for region, (existing, new_articles) in new_by_region.items():
        # Also pick up existing articles that were saved without being translated
        # (e.g. from a previous run where the API key was missing or pipeline was interrupted)
        existing_untranslated = [a for a in existing if a.get("translated") is None]
        existing_done = [a for a in existing if a.get("translated") is not None]
        to_translate = existing_untranslated + new_articles

        # skip_translation articles are already in English — they don't need
        # translation but DO need LLM relevance filtering + summarization.
        # We only set title_en here; translate_articles() will detect them
        # as needing relevance classification and send them through the LLM.
        for a in to_translate:
            if a.get("skip_translation") and a.get("translated") is None:
                a["title_en"] = a.get("title_original", "")
                # Don't set relevant or translated — let the LLM decide
                # translate_articles() handles the rest

        if to_translate:
            def make_checkpoint(reg, done):
                def checkpoint(current_batch):
                    merged = done + current_batch
                    merged = prune_old_articles(merged)
                    merged.sort(key=lambda a: a.get("published", ""), reverse=True)
                    save_articles(reg, merged)
                    logger.info(f"Checkpoint: saved {len(merged)} articles for '{reg}'")
                return checkpoint

            translated = translate_articles(
                to_translate,
                api_key,
                max_articles=max_per_region,
                checkpoint_fn=make_checkpoint(region, existing_done),
            )
            all_translated[region] = (existing_done, translated)
        else:
            all_translated[region] = (existing_done, to_translate)

    # ── Step 4: Merge and save ──
    logger.info("── Step 4: Merging and saving ──")

    all_articles_flat = []
    for region, (existing, translated) in all_translated.items():
        merged = existing + translated
        merged = prune_old_articles(merged)
        # Sort by published date (newest first)
        merged.sort(key=lambda a: a.get("published", ""), reverse=True)
        save_articles(region, merged)
        all_articles_flat.extend(merged)

    # ── Step 5: Classify attacks ──
    logger.info("── Step 5: Classifying attacks ──")

    from classify_attacks import classify_articles

    existing_attacks = load_existing_attacks()

    # Only classify newly translated *relevant* articles + merge with existing attack data
    newly_translated_flat = []
    for region, (existing, translated) in all_translated.items():
        newly_translated_flat.extend(
            a for a in translated if a.get("relevant", True) and a.get("translated")
        )

    new_attack_articles = classify_articles(newly_translated_flat, api_key)

    # Merge with existing attacks, deduplicate
    existing_attack_ids = {a["id"] for a in existing_attacks}
    for article in new_attack_articles:
        if article["id"] not in existing_attack_ids:
            existing_attacks.append(article)

    # Prune old attacks
    existing_attacks = prune_old_articles(existing_attacks)
    existing_attacks.sort(key=lambda a: a.get("published", ""), reverse=True)

    # ── Step 5b: Geocode attack locations ──
    logger.info("── Step 5b: Geocoding attack locations ──")
    from geocode_improved import geocode_attacks
    existing_attacks = geocode_attacks(existing_attacks, logger=logger)

    save_attacks(existing_attacks)

    # ── Step 6: Compute threat level ──
    logger.info("── Step 6: Computing threat level ──")

    from threat_level import compute_and_save_threat_level

    threat = compute_and_save_threat_level(
        existing_attacks, str(DATA_DIR / "threat_level.json")
    )

    # ── Step 7: Generate executive summary ──
    logger.info("── Step 7: Generating executive summary ──")

    try:
        from generate_summary import generate_and_save

        summary = generate_and_save(
            attacks=existing_attacks,
            threat=threat,
        )
        logger.info(
            f"  Executive summary generated at {summary.get('generated_at', '?')}"
        )
    except Exception as e:
        logger.warning(f"Executive summary generation failed: {e}")

    # ── Summary ──
    logger.info("=" * 60)
    logger.info("Pipeline complete!")
    logger.info(f"  Total articles: {len(all_articles_flat)}")
    logger.info(f"  New articles: {total_new}, previously untranslated: {total_existing_untranslated}")
    logger.info(f"  Attack articles: {len(existing_attacks)}")
    logger.info(f"  Threat level: {threat['current']['label']} (Level {threat['current']['level']})")
    logger.info("=" * 60)


if __name__ == "__main__":
    run()
