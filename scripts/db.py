"""
db.py — Supabase database layer for the NewFeeds pipeline.

Provides upsert/read/prune helpers that mirror the existing JSON file I/O.
Uses the service_role key (bypasses RLS) for pipeline writes.

Environment variables:
    SUPABASE_URL         — e.g. https://xxxx.supabase.co
    SUPABASE_SERVICE_KEY — service_role secret key
"""

import json
import logging
import os
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

# Lazy singleton — initialised on first call to get_client()
_client = None


def get_client():
    """Return a cached Supabase client (service_role)."""
    global _client
    if _client is not None:
        return _client

    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")

    if not url or not key:
        logger.warning("SUPABASE_URL / SUPABASE_SERVICE_KEY not set — DB writes disabled")
        return None

    from supabase import create_client
    _client = create_client(url, key)
    logger.info("Supabase client initialised")
    return _client


def is_enabled() -> bool:
    """Return True if Supabase credentials are configured."""
    return bool(os.environ.get("SUPABASE_URL")) and bool(os.environ.get("SUPABASE_SERVICE_KEY"))


# ── Helpers ──────────────────────────────────────────────────


def _parse_ts(value: str | None) -> str | None:
    """Normalise a timestamp string to ISO-8601 for Postgres TIMESTAMPTZ, or None."""
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    except (ValueError, TypeError):
        return None


def _article_to_row(a: dict) -> dict:
    """Convert an in-memory article dict to a flat row for the articles table."""
    return {
        "id": a["id"],
        "title_original": a.get("title_original", ""),
        "content_original": a.get("content_original"),
        "url": a.get("url", ""),
        "published": _parse_ts(a.get("published")),
        "fetched_at": _parse_ts(a.get("fetched_at")),
        "source_name": a.get("source_name", ""),
        "source_category": a.get("source_category", "unknown"),
        "language": a.get("language", "en"),
        "region": a.get("region", ""),
        "skip_translation": bool(a.get("skip_translation", False)),
        "translated": a.get("translated"),
        "relevant": a.get("relevant"),
        "title_en": a.get("title_en"),
        "summary_en": a.get("summary_en"),
    }


def _attack_to_row(a: dict) -> dict:
    """Convert an in-memory attack dict to a flat row for the attacks table."""
    row = _article_to_row(a)  # base article fields
    row.update({
        "keyword_matches": a.get("keyword_matches", 0),
        "matched_keywords": a.get("matched_keywords", []),
        "classification": json.dumps(a["classification"]) if isinstance(a.get("classification"), dict) else a.get("classification"),
        "merged_source_count": a.get("merged_source_count", 1),
        "lat": a.get("lat"),
        "lng": a.get("lng"),
        "geocode_failed": bool(a.get("geocode_failed", False)),
    })
    return row


# ── Batch size for upserts ───────────────────────────────────
BATCH_SIZE = 500


def _chunked(lst: list, n: int):
    """Yield successive n-sized chunks from lst."""
    for i in range(0, len(lst), n):
        yield lst[i : i + n]


# ── Public API ───────────────────────────────────────────────


def upsert_articles(region: str, articles: list[dict]) -> int:
    """
    Bulk upsert articles for a region into the articles table.
    Uses on_conflict=id so repeated calls are safe.
    Returns the number of rows upserted.
    """
    client = get_client()
    if client is None:
        return 0

    rows = [_article_to_row(a) for a in articles]
    if not rows:
        return 0

    total = 0
    for batch in _chunked(rows, BATCH_SIZE):
        try:
            client.table("articles").upsert(batch, on_conflict="id").execute()
            total += len(batch)
        except Exception as e:
            logger.error(f"Supabase upsert_articles failed for region={region}: {e}")

    logger.info(f"Supabase: upserted {total} articles for region '{region}'")
    return total


def upsert_attacks(attacks: list[dict]) -> int:
    """Bulk upsert attack articles into the attacks table."""
    client = get_client()
    if client is None:
        return 0

    rows = [_attack_to_row(a) for a in attacks]
    if not rows:
        return 0

    total = 0
    for batch in _chunked(rows, BATCH_SIZE):
        try:
            client.table("attacks").upsert(batch, on_conflict="id").execute()
            total += len(batch)
        except Exception as e:
            logger.error(f"Supabase upsert_attacks failed: {e}")

    logger.info(f"Supabase: upserted {total} attack articles")
    return total


def upsert_threat_level(data: dict) -> bool:
    """Upsert the singleton threat_level row."""
    client = get_client()
    if client is None:
        return False

    try:
        row = {
            "id": "current",
            "current_data": json.dumps(data.get("current", {})),
            "short_term_6h": json.dumps(data.get("short_term_6h", {})),
            "medium_term_48h": json.dumps(data.get("medium_term_48h", {})),
            "trend": data.get("trend", "stable"),
            "history": json.dumps(data.get("history", [])),
            "updated_at": data.get("updated_at", datetime.now(timezone.utc).isoformat()),
        }
        client.table("threat_level").upsert(row, on_conflict="id").execute()
        logger.info("Supabase: upserted threat_level")
        return True
    except Exception as e:
        logger.error(f"Supabase upsert_threat_level failed: {e}")
        return False


def upsert_executive_summary(data: dict) -> bool:
    """Upsert the singleton executive_summary row."""
    client = get_client()
    if client is None:
        return False

    try:
        row = {
            "id": "current",
            "data": json.dumps(data),
            "generated_at": data.get("generated_at", datetime.now(timezone.utc).isoformat()),
        }
        client.table("executive_summary").upsert(row, on_conflict="id").execute()
        logger.info("Supabase: upserted executive_summary")
        return True
    except Exception as e:
        logger.error(f"Supabase upsert_executive_summary failed: {e}")
        return False


def upsert_operational_briefing(data: dict) -> bool:
    """Upsert the singleton operational_briefing row."""
    client = get_client()
    if client is None:
        return False

    try:
        row = {
            "id": "current",
            "data": json.dumps(data),
            "generated_at": data.get("generated_at", datetime.now(timezone.utc).isoformat()),
        }
        client.table("operational_briefing").upsert(row, on_conflict="id").execute()
        logger.info("Supabase: upserted operational_briefing")
        return True
    except Exception as e:
        logger.error(f"Supabase upsert_operational_briefing failed: {e}")
        return False


# ── Read helpers (used by the merge job to load cross-region data) ────


def load_articles_by_region(region: str) -> list[dict]:
    """Load all articles for a region from Supabase."""
    client = get_client()
    if client is None:
        return []

    try:
        resp = (
            client.table("articles")
            .select("*")
            .eq("region", region)
            .order("published", desc=True)
            .execute()
        )
        return resp.data or []
    except Exception as e:
        logger.error(f"Supabase load_articles_by_region({region}) failed: {e}")
        return []


def load_all_attacks() -> list[dict]:
    """Load all attack articles from Supabase."""
    client = get_client()
    if client is None:
        return []

    try:
        resp = (
            client.table("attacks")
            .select("*")
            .order("published", desc=True)
            .execute()
        )
        rows = resp.data or []
        # Deserialise classification JSONB back to dict
        for row in rows:
            if isinstance(row.get("classification"), str):
                try:
                    row["classification"] = json.loads(row["classification"])
                except (json.JSONDecodeError, TypeError):
                    pass
        return rows
    except Exception as e:
        logger.error(f"Supabase load_all_attacks failed: {e}")
        return []


def load_threat_level() -> dict | None:
    """Load the current threat level from Supabase."""
    client = get_client()
    if client is None:
        return None

    try:
        resp = (
            client.table("threat_level")
            .select("*")
            .eq("id", "current")
            .single()
            .execute()
        )
        row = resp.data
        if not row:
            return None
        # Re-assemble the dict the pipeline/frontend expects
        result = {
            "current": json.loads(row["current_data"]) if isinstance(row["current_data"], str) else row["current_data"],
            "short_term_6h": json.loads(row["short_term_6h"]) if isinstance(row["short_term_6h"], str) else row["short_term_6h"],
            "medium_term_48h": json.loads(row["medium_term_48h"]) if isinstance(row["medium_term_48h"], str) else row["medium_term_48h"],
            "trend": row.get("trend", "stable"),
            "history": json.loads(row["history"]) if isinstance(row["history"], str) else row["history"],
            "updated_at": row.get("updated_at", ""),
        }
        return result
    except Exception as e:
        logger.error(f"Supabase load_threat_level failed: {e}")
        return None


# ── Pruning ──────────────────────────────────────────────────


def prune_articles(max_age_days: int = 7) -> int:
    """Delete articles older than max_age_days. Returns count deleted."""
    client = get_client()
    if client is None:
        return 0

    cutoff = (datetime.now(timezone.utc) - timedelta(days=max_age_days)).isoformat()
    try:
        resp = (
            client.table("articles")
            .delete()
            .lt("published", cutoff)
            .execute()
        )
        count = len(resp.data) if resp.data else 0
        if count:
            logger.info(f"Supabase: pruned {count} articles older than {max_age_days} days")
        return count
    except Exception as e:
        logger.error(f"Supabase prune_articles failed: {e}")
        return 0


def prune_attacks(max_age_days: int = 7) -> int:
    """Delete attacks older than max_age_days."""
    client = get_client()
    if client is None:
        return 0

    cutoff = (datetime.now(timezone.utc) - timedelta(days=max_age_days)).isoformat()
    try:
        resp = (
            client.table("attacks")
            .delete()
            .lt("published", cutoff)
            .execute()
        )
        count = len(resp.data) if resp.data else 0
        if count:
            logger.info(f"Supabase: pruned {count} attacks older than {max_age_days} days")
        return count
    except Exception as e:
        logger.error(f"Supabase prune_attacks failed: {e}")
        return 0
