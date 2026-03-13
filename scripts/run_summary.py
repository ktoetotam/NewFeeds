#!/usr/bin/env python3
"""
run_summary.py — Standalone executive-summary generation.

Reads attacks, threat level, and articles from Supabase (source of truth),
generates a new executive summary via LLM, and writes it back to Supabase.

Intended to run on a separate cron schedule (e.g. every 30 minutes) from
the main fetch-and-translate pipeline.

Usage:
    LLM_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
        python run_summary.py

    # Legacy (still supported):
    MINIMAX_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
        python run_summary.py

    # Or with Poetry:
    poetry run python run_summary.py
"""

import json
import logging
import os
import sys
from pathlib import Path

import yaml

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("run_summary")

# Project paths
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / "data"
SOURCES_FILE = SCRIPT_DIR / "sources.yaml"

import db as supabase_db
from generate_briefing import generate_briefing
from generate_summary import generate_and_save
from threat_level import compute_and_save_threat_level


def load_attacks_from_supabase() -> list[dict]:
    """Load all attack articles from Supabase."""
    rows = supabase_db.load_all_attacks()
    logger.info(f"Loaded {len(rows)} attacks from Supabase")
    return rows


def load_articles_from_supabase() -> list[dict]:
    """Load relevant, translated articles from all regions in Supabase."""
    with open(SOURCES_FILE, "r", encoding="utf-8") as f:
        sources = yaml.safe_load(f)

    all_articles: list[dict] = []

    for region in sources.get("regions", {}).keys():
        rows = supabase_db.load_articles_by_region(region)
        # Only relevant, translated articles (same filter as generate_summary.load_feed_articles)
        relevant = [
            a for a in rows
            if a.get("relevant") is True and a.get("translated") is True
        ]
        all_articles.extend(relevant)
        logger.info(f"  {region}: {len(relevant)}/{len(rows)} relevant articles")

    all_articles.sort(key=lambda a: a.get("published", ""), reverse=True)
    logger.info(f"Total relevant articles loaded: {len(all_articles)}")
    return all_articles


def load_threat_from_supabase() -> dict:
    """Load threat level from Supabase, or recompute it from attacks."""
    threat = supabase_db.load_threat_level()
    if threat:
        logger.info(f"Loaded threat level from Supabase: {threat.get('current', {}).get('label', '?')}")
        return threat

    # Recompute from attacks if not in Supabase
    logger.warning("No threat level in Supabase — recomputing from attacks")
    attacks = load_attacks_from_supabase()
    threat = compute_and_save_threat_level(attacks, str(DATA_DIR / "threat_level.json"))

    try:
        supabase_db.upsert_threat_level(threat)
    except Exception as e:
        logger.warning(f"Failed to push recomputed threat level to Supabase: {e}")

    return threat


def main():
    # Validate environment
    api_key = os.environ.get("LLM_API_KEY", "")
    if not api_key:
        logger.error("LLM_API_KEY not set")
        sys.exit(1)

    if not supabase_db.is_enabled():
        logger.error("SUPABASE_URL / SUPABASE_SERVICE_KEY not set — cannot run standalone summary")
        sys.exit(1)

    logger.info("=" * 60)
    logger.info("Starting standalone executive summary generation")
    logger.info("=" * 60)

    # Load all data from Supabase
    attacks = load_attacks_from_supabase()
    threat = load_threat_from_supabase()
    articles = load_articles_from_supabase()

    if not attacks and not articles:
        logger.warning("No attacks or articles in Supabase — nothing to summarize")
        return

    # Recompute threat level from current attacks (may have changed since last pipeline run)
    logger.info("Recomputing threat level from current attacks...")
    threat = compute_and_save_threat_level(attacks, str(DATA_DIR / "threat_level.json"))
    try:
        supabase_db.upsert_threat_level(threat)
    except Exception as e:
        logger.warning(f"Supabase upsert_threat_level failed: {e}")

    # Generate executive summary
    summary = generate_and_save(
        attacks=attacks,
        threat=threat,
        articles=articles,
        api_key=api_key,
    )

    # Push to Supabase
    try:
        supabase_db.upsert_executive_summary(summary)
        logger.info("Executive summary pushed to Supabase")
    except Exception as e:
        logger.warning(f"Supabase upsert_executive_summary failed: {e}")

    # ── Operational briefing (1-hour window) ──
    logger.info("Generating operational briefing (1h window)...")
    briefing = generate_briefing(
        attacks=attacks,
        articles=articles,
        api_key=api_key,
    )
    try:
        supabase_db.upsert_operational_briefing(briefing)
        logger.info("Operational briefing pushed to Supabase")
    except Exception as e:
        logger.warning(f"Supabase upsert_operational_briefing failed: {e}")

    logger.info("=" * 60)
    logger.info("Standalone summary generation complete!")
    logger.info(f"  Generated at: {summary.get('generated_at', '?')}")
    logger.info(f"  Threat level: {threat.get('current', {}).get('label', '?')}")
    logger.info(f"  Attacks analyzed: {summary.get('source_count', {}).get('attacks_analyzed', 0)}")
    logger.info(f"  Articles analyzed: {summary.get('source_count', {}).get('articles_analyzed', 0)}")
    logger.info(f"  Briefing window: {briefing.get('window_start_display', '?')} → {briefing.get('window_end_display', '?')}")
    logger.info(f"  Briefing events: {briefing.get('source_count', {}).get('attacks_analyzed', 0)} attacks, {briefing.get('source_count', {}).get('articles_analyzed', 0)} articles")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
