"""
fetch_telegram.py — Fetch messages from public Telegram channels via t.me/s/ preview pages.

No API key required — uses Telegram's own public HTML preview.
Each channel must be public. Messages are parsed from the server-rendered HTML.
"""

import hashlib
import logging
import os
import re
from datetime import datetime, timedelta, timezone

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

MAX_AGE_MINUTES = int(os.environ.get("MAX_NEW_ARTICLE_AGE_MINUTES", "30"))

# Mimic a browser to avoid being blocked
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


def make_article_id(url: str) -> str:
    """Generate a deterministic ID from message URL."""
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def fetch_telegram_channel(source: dict, region: str) -> list[dict]:
    """
    Fetch recent messages from a public Telegram channel.

    Uses https://t.me/s/<channel> which is Telegram's own public
    server-rendered preview — works without an API key.

    Args:
        source: Source config dict with keys: name, channel, language, category
        region: Region key (iran, russia, israel, gulf, proxies)

    Returns:
        List of article dicts matching the standard article schema.
    """
    channel = source["channel"]  # e.g. "C_Media_h"
    name = source["name"]
    url = f"https://t.me/s/{channel}"

    articles = []
    try:
        logger.info(f"Fetching Telegram: {name} (@{channel})")
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "lxml")

        # Each message is inside .tgme_widget_message_wrap
        messages = soup.select(".tgme_widget_message_wrap")
        if not messages:
            # Fallback selector for some page variants
            messages = soup.select(".tgme_widget_message")

        for msg in messages:
            # Extract message link (unique per message)
            link_el = msg.select_one(".tgme_widget_message_date")
            if not link_el or not link_el.get("href"):
                continue
            msg_url = link_el["href"]

            # Extract text content
            text_el = msg.select_one(".tgme_widget_message_text")
            text = ""
            if text_el:
                # Preserve line breaks but strip HTML
                text = text_el.get_text(separator=" ").strip()

            # Some messages are media-only (photos/videos without text)
            if not text:
                # Check for photo/video caption or forwarded header
                fwd_el = msg.select_one(".tgme_widget_message_forwarded_from_name")
                if fwd_el:
                    text = f"[Forwarded from {fwd_el.get_text(strip=True)}]"
                else:
                    # Skip media-only messages with no text
                    continue

            # Extract date
            time_el = msg.select_one("time[datetime]")
            published = datetime.now(timezone.utc).isoformat()
            if time_el and time_el.get("datetime"):
                published = time_el["datetime"]

            # ── Skip messages older than MAX_AGE_MINUTES ──
            try:
                from dateutil import parser as _dp
                pub_dt = _dp.parse(published)
                if pub_dt.tzinfo is None:
                    pub_dt = pub_dt.replace(tzinfo=timezone.utc)
                cutoff = datetime.now(timezone.utc) - timedelta(minutes=MAX_AGE_MINUTES)
                if pub_dt < cutoff:
                    continue
            except (ValueError, TypeError):
                pass  # keep on parse failure

            # First line (or first 120 chars) as title
            first_line = text.split("\n")[0].strip()
            if len(first_line) > 120:
                first_line = first_line[:117] + "..."
            title = first_line if first_line else text[:120]

            # Truncate content
            content = re.sub(r"\s+", " ", text).strip()
            if len(content) > 1000:
                content = content[:1000] + "..."

            article = {
                "id": make_article_id(msg_url),
                "title_original": title,
                "content_original": content if content else title,
                "url": msg_url,
                "published": published,
                "source_name": name,
                "source_category": source.get("category", "proxy"),
                "language": source.get("language", "ar"),
                "region": region,
                "skip_translation": source.get("skip_translation", False),
            }
            articles.append(article)

        logger.info(f"Fetched {len(articles)} messages from @{channel}")

    except requests.exceptions.RequestException as e:
        logger.error("Failed to fetch Telegram @%s: %s", channel, e)
    except Exception as e:
        logger.error("Error parsing Telegram @%s: %s", channel, e, exc_info=True)

    return articles


def fetch_all_telegram(sources_config: dict) -> dict[str, list[dict]]:
    """
    Fetch messages from all Telegram sources across all regions.

    Args:
        sources_config: Parsed sources.yaml config

    Returns:
        Dict mapping region -> list of articles
    """
    all_articles = {}

    for region_key, region_cfg in sources_config.get("regions", {}).items():
        region_articles = []
        for source in region_cfg.get("sources", []):
            if source.get("type") != "telegram":
                continue
            articles = fetch_telegram_channel(source, region_key)
            region_articles.extend(articles)

        if region_articles:
            all_articles[region_key] = region_articles
            logger.info(
                f"Region '{region_key}': {len(region_articles)} Telegram messages total"
            )

    return all_articles
