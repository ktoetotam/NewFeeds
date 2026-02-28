"""
fetch_scrape.py — Scrape articles from websites without RSS feeds.
Supports both BeautifulSoup (static) and Playwright (JavaScript-rendered) pages.
"""

import hashlib
import logging
import re
from datetime import datetime, timezone
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from dateutil import parser as dateparser

logger = logging.getLogger(__name__)

# Shared headers to mimic a real browser
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ar,en;q=0.5",
}


def make_article_id(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def parse_date(date_str: str) -> str:
    if not date_str:
        return datetime.now(timezone.utc).isoformat()
    try:
        dt = dateparser.parse(date_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    except (ValueError, TypeError):
        return datetime.now(timezone.utc).isoformat()


def clean_text(text: str) -> str:
    """Remove HTML tags and normalize whitespace."""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def scrape_with_beautifulsoup(source: dict, region: str) -> list[dict]:
    """Scrape a static HTML page using requests + BeautifulSoup."""
    articles = []
    url = source["url"]
    name = source["name"]
    selectors = source.get("selectors", {})

    try:
        logger.info(f"Scraping (BS4): {name} ({url})")
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()

        # Try to detect encoding properly for Arabic/Farsi
        resp.encoding = resp.apparent_encoding or "utf-8"
        soup = BeautifulSoup(resp.text, "lxml")

        # Try multiple selectors for articles
        article_selector = selectors.get("article", "article")
        article_elements = []
        for sel in article_selector.split(","):
            sel = sel.strip()
            article_elements.extend(soup.select(sel))

        if not article_elements:
            # Fallback: try common patterns
            for fallback_sel in ["article", ".post", ".news-item", ".card", "li"]:
                article_elements = soup.select(fallback_sel)
                if article_elements:
                    break

        for el in article_elements[:30]:
            # Extract title
            title_el = None
            for sel in selectors.get("title", "h2, h3").split(","):
                title_el = el.select_one(sel.strip())
                if title_el:
                    break
            if not title_el:
                title_el = el.select_one("h2") or el.select_one("h3") or el.select_one("a")

            title = clean_text(title_el.get_text()) if title_el else ""
            if not title or len(title) < 5:
                continue

            # Extract link
            link_el = None
            for sel in selectors.get("link", "a").split(","):
                link_el = el.select_one(sel.strip())
                if link_el:
                    break
            if not link_el:
                link_el = el.select_one("a")

            link = ""
            if link_el and link_el.get("href"):
                link = urljoin(url, link_el["href"])
            if not link:
                continue

            # Extract date
            date_el = None
            for sel in selectors.get("date", ".date, time").split(","):
                date_el = el.select_one(sel.strip())
                if date_el:
                    break
            date_str = ""
            if date_el:
                date_str = date_el.get("datetime", "") or date_el.get_text().strip()

            # Extract content snippet
            content = ""
            for sel in selectors.get("content", "p").split(","):
                content_el = el.select_one(sel.strip())
                if content_el:
                    content = clean_text(content_el.get_text())
                    break
            if not content:
                # Use all paragraph text
                paragraphs = el.select("p")
                content = " ".join(clean_text(p.get_text()) for p in paragraphs[:3])

            if len(content) > 1000:
                content = content[:1000] + "..."

            article = {
                "id": make_article_id(link),
                "title_original": title,
                "content_original": content if content else title,
                "url": link,
                "published": parse_date(date_str),
                "source_name": name,
                "source_category": source.get("category", "unknown"),
                "language": source.get("language", "unknown"),
                "region": region,
                "skip_translation": False,
            }
            articles.append(article)

        logger.info(f"Scraped {len(articles)} articles from {name} (BS4)")

    except Exception as e:
        logger.error(f"Failed to scrape {name} (BS4): {e}")

    return articles


async def scrape_with_playwright(source: dict, region: str) -> list[dict]:
    """Scrape a JavaScript-rendered page using Playwright."""
    articles = []
    url = source["url"]
    name = source["name"]
    selectors = source.get("selectors", {})

    try:
        from playwright.async_api import async_playwright

        logger.info(f"Scraping (Playwright): {name} ({url})")

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            # Set Arabic locale for Gulf sites
            await page.set_extra_http_headers({
                "Accept-Language": "ar,en;q=0.5"
            })

            await page.goto(url, wait_until="networkidle", timeout=60000)
            await page.wait_for_timeout(3000)  # Extra wait for dynamic content

            html = await page.content()
            await browser.close()

        soup = BeautifulSoup(html, "lxml")

        # Same extraction logic as BS4 scraper
        article_selector = selectors.get("article", "article")
        article_elements = []
        for sel in article_selector.split(","):
            sel = sel.strip()
            article_elements.extend(soup.select(sel))

        if not article_elements:
            for fallback_sel in ["article", ".post", ".news-item", ".card"]:
                article_elements = soup.select(fallback_sel)
                if article_elements:
                    break

        for el in article_elements[:30]:
            title_el = None
            for sel in selectors.get("title", "h2, h3").split(","):
                title_el = el.select_one(sel.strip())
                if title_el:
                    break

            title = clean_text(title_el.get_text()) if title_el else ""
            if not title or len(title) < 5:
                continue

            link_el = el.select_one("a")
            link = ""
            if link_el and link_el.get("href"):
                link = urljoin(url, link_el["href"])
            if not link:
                continue

            date_el = None
            for sel in selectors.get("date", ".date, time").split(","):
                date_el = el.select_one(sel.strip())
                if date_el:
                    break
            date_str = ""
            if date_el:
                date_str = date_el.get("datetime", "") or date_el.get_text().strip()

            content = ""
            for sel in selectors.get("content", "p").split(","):
                content_el = el.select_one(sel.strip())
                if content_el:
                    content = clean_text(content_el.get_text())
                    break

            if len(content) > 1000:
                content = content[:1000] + "..."

            article = {
                "id": make_article_id(link),
                "title_original": title,
                "content_original": content if content else title,
                "url": link,
                "published": parse_date(date_str),
                "source_name": name,
                "source_category": source.get("category", "unknown"),
                "language": source.get("language", "unknown"),
                "region": region,
                "skip_translation": False,
            }
            articles.append(article)

        logger.info(f"Scraped {len(articles)} articles from {name} (Playwright)")

    except Exception as e:
        logger.error(f"Failed to scrape {name} (Playwright): {e}")

    return articles


def fetch_scrape_source(source: dict, region: str) -> list[dict]:
    """Scrape a single source, choosing the appropriate engine."""
    engine = source.get("engine", "beautifulsoup")

    if engine == "playwright":
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If we're already in an async context
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    return pool.submit(
                        asyncio.run, scrape_with_playwright(source, region)
                    ).result()
            else:
                return loop.run_until_complete(scrape_with_playwright(source, region))
        except RuntimeError:
            return asyncio.run(scrape_with_playwright(source, region))
    else:
        return scrape_with_beautifulsoup(source, region)


def fetch_all_scrape(sources_config: dict) -> dict[str, list[dict]]:
    """
    Scrape articles from all scrape-type sources across all regions.

    Returns:
        Dict mapping region -> list of articles
    """
    all_articles = {}

    for region_key, region_cfg in sources_config.get("regions", {}).items():
        region_articles = []
        for source in region_cfg.get("sources", []):
            if source.get("type") != "scrape":
                continue
            articles = fetch_scrape_source(source, region_key)
            region_articles.extend(articles)

        if region_articles:
            all_articles.setdefault(region_key, [])
            all_articles[region_key].extend(region_articles)
            logger.info(f"Region '{region_key}': {len(region_articles)} scraped articles")

    return all_articles
