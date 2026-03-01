"""
fetch_rss.py — Fetch articles from RSS/Atom feeds.
Returns a list of raw article dicts ready for translation.
"""

import os
import feedparser
import hashlib
import logging
import requests
from datetime import datetime, timedelta, timezone
from dateutil import parser as dateparser

FEED_TIMEOUT = 15  # seconds per feed download

logger = logging.getLogger(__name__)

# Only accept entries published within this window (minutes).
# Override with env var MAX_NEW_ARTICLE_AGE_MINUTES.
MAX_AGE_MINUTES = int(os.environ.get("MAX_NEW_ARTICLE_AGE_MINUTES", "30"))


def make_article_id(url: str) -> str:
    """Generate a deterministic ID from article URL."""
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def parse_date(date_str: str) -> str:
    """Parse various date formats into ISO 8601 UTC string."""
    if not date_str:
        return datetime.now(timezone.utc).isoformat()
    try:
        dt = dateparser.parse(date_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    except (ValueError, TypeError):
        return datetime.now(timezone.utc).isoformat()


def _is_fresh(date_str: str, max_age_minutes: int = MAX_AGE_MINUTES) -> bool:
    """Return True if *date_str* is within the last *max_age_minutes* minutes."""
    if not date_str:
        return True  # keep entries with no date (might be recent)
    try:
        dt = dateparser.parse(date_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=max_age_minutes)
        return dt >= cutoff
    except (ValueError, TypeError):
        return True  # keep on parse failure


def fetch_rss_source(source: dict, region: str) -> list[dict]:
    """
    Fetch articles from a single RSS source.

    Args:
        source: Source config dict from sources.yaml
        region: Region key (iran, russia, israel, gulf, proxies)

    Returns:
        List of article dicts with keys:
        id, title_original, content_original, url, published,
        source_name, source_category, language, region
    """
    articles = []
    url = source["url"]
    name = source["name"]

    try:
        logger.info(f"Fetching RSS: {name} ({url})")

        # Download feed content with a strict timeout (feedparser has none)
        try:
            resp = requests.get(url, timeout=FEED_TIMEOUT, headers={
                "User-Agent": "Mozilla/5.0 (compatible; NewFeeds/1.0)",
                "Accept": "application/rss+xml, application/xml, text/xml, */*",
            })
            resp.raise_for_status()
            feed = feedparser.parse(resp.content)
        except requests.RequestException as req_err:
            logger.warning(f"Feed download failed for {name}: {req_err}")
            return []

        if feed.bozo and not feed.entries:
            logger.warning(f"Feed error for {name}: {feed.bozo_exception}")
            return []

        for entry in feed.entries[:50]:  # Cap at 50 entries per feed
            link = entry.get("link", "")
            if not link:
                continue

            title = entry.get("title", "").strip()
            if not title:
                continue

            # Extract content: prefer content, fall back to summary, then description
            content = ""
            if hasattr(entry, "content") and entry.content:
                content = entry.content[0].get("value", "")
            elif hasattr(entry, "summary"):
                content = entry.summary or ""
            elif hasattr(entry, "description"):
                content = entry.description or ""

            # Strip HTML tags (basic)
            import re
            content = re.sub(r"<[^>]+>", " ", content)
            content = re.sub(r"\s+", " ", content).strip()

            # Truncate content to save on API costs (summarizer uses first 800 chars)
            if len(content) > 1000:
                content = content[:1000] + "..."

            published = ""
            if hasattr(entry, "published"):
                published = entry.published
            elif hasattr(entry, "updated"):
                published = entry.updated

            # ── Skip entries older than MAX_AGE_MINUTES ──
            if not _is_fresh(published):
                continue

            article = {
                "id": make_article_id(link),
                "title_original": title,
                "content_original": content if content else title,
                "url": link,
                "published": parse_date(published),
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "source_name": name,
                "source_category": source.get("category", "unknown"),
                "language": source.get("language", "unknown"),
                "region": region,
                "skip_translation": source.get("skip_translation", False),
            }
            articles.append(article)

        logger.info(f"Fetched {len(articles)} articles from {name}")

    except Exception as e:
        logger.error(f"Failed to fetch {name}: {e}")

    return articles


def fetch_all_rss(sources_config: dict) -> dict[str, list[dict]]:
    """
    Fetch articles from all RSS sources across all regions.

    Args:
        sources_config: Parsed sources.yaml config

    Returns:
        Dict mapping region -> list of articles
    """
    all_articles = {}

    for region_key, region_cfg in sources_config.get("regions", {}).items():
        region_articles = []
        for source in region_cfg.get("sources", []):
            if source.get("type") != "rss":
                continue
            articles = fetch_rss_source(source, region_key)
            region_articles.extend(articles)

        all_articles[region_key] = region_articles
        logger.info(f"Region '{region_key}': {len(region_articles)} RSS articles total")

    return all_articles
