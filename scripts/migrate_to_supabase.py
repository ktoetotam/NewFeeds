#!/usr/bin/env python3
"""
migrate_to_supabase.py — One-time migration of all JSON data files into Supabase.

Reads every JSON data file (feeds, attacks, threat_level, executive_summary)
and upserts all rows into the corresponding Supabase tables.

Idempotent: safe to run multiple times (upsert on primary key).

Usage:
    SUPABASE_URL=... SUPABASE_SERVICE_KEY=... python scripts/migrate_to_supabase.py
    # Or with --dry-run to just count rows without writing:
    python scripts/migrate_to_supabase.py --dry-run
"""

import json
import logging
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("migrate")

PROJECT_DIR = Path(__file__).parent.parent
DATA_DIR = PROJECT_DIR / "data"
FEEDS_DIR = DATA_DIR / "feeds"


def load_json(filepath: Path) -> list | dict:
    """Load a JSON file, returning [] on error."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        logger.warning(f"Could not load {filepath}: {e}")
        return []


def main():
    dry_run = "--dry-run" in sys.argv

    # ── 1. Migrate feed articles ──
    logger.info("=" * 60)
    logger.info("Migrating feed articles to Supabase")
    logger.info("=" * 60)

    total_articles = 0
    feed_files = sorted(FEEDS_DIR.glob("*.json"))
    for feed_file in feed_files:
        region = feed_file.stem
        articles = load_json(feed_file)
        if not isinstance(articles, list):
            logger.warning(f"Skipping {feed_file} — not a JSON array")
            continue
        logger.info(f"  Region '{region}': {len(articles)} articles")
        total_articles += len(articles)

        if not dry_run:
            from db import upsert_articles
            upsert_articles(region, articles)

    logger.info(f"Total feed articles: {total_articles}")

    # ── 2. Migrate attacks ──
    logger.info("=" * 60)
    logger.info("Migrating attacks to Supabase")
    logger.info("=" * 60)

    attacks_file = DATA_DIR / "attacks.json"
    attacks = load_json(attacks_file)
    if isinstance(attacks, list):
        logger.info(f"  {len(attacks)} attack articles")
        if not dry_run:
            from db import upsert_attacks
            upsert_attacks(attacks)
    else:
        logger.warning("attacks.json is not a list — skipping")

    # ── 3. Migrate threat level ──
    logger.info("=" * 60)
    logger.info("Migrating threat level to Supabase")
    logger.info("=" * 60)

    threat_file = DATA_DIR / "threat_level.json"
    threat = load_json(threat_file)
    if isinstance(threat, dict) and "current" in threat:
        history_len = len(threat.get("history", []))
        logger.info(f"  Threat level: {threat['current'].get('label', '?')}, history entries: {history_len}")
        if not dry_run:
            from db import upsert_threat_level
            upsert_threat_level(threat)
    else:
        logger.warning("threat_level.json is not valid — skipping")

    # ── 4. Migrate executive summary ──
    logger.info("=" * 60)
    logger.info("Migrating executive summary to Supabase")
    logger.info("=" * 60)

    summary_file = DATA_DIR / "executive_summary.json"
    summary = load_json(summary_file)
    if isinstance(summary, dict) and "generated_at" in summary:
        logger.info(f"  Summary generated at: {summary.get('generated_at', '?')}")
        if not dry_run:
            from db import upsert_executive_summary
            upsert_executive_summary(summary)
    else:
        logger.warning("executive_summary.json is not valid — skipping")

    # ── Done ──
    logger.info("=" * 60)
    if dry_run:
        logger.info("DRY RUN complete — no data was written to Supabase")
    else:
        logger.info("Migration complete!")
    logger.info(f"  Feed articles: {total_articles}")
    logger.info(f"  Attacks: {len(attacks) if isinstance(attacks, list) else 0}")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
