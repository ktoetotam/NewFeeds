#!/usr/bin/env python3
"""
add_source.py — Agent tool: add a new RSS/Telegram/scrape source (and region if needed).

Synchronises ALL touchpoints in the codebase:
  1. scripts/sources.yaml     — source definition under the region
  2. data/feeds/{region}.json — empty feed JSON (new regions only)
  3. site/src/lib/types.ts    — RegionKey type + REGIONS array (new regions only)

Usage (interactive):
    python scripts/add_source.py

Usage (non-interactive / CI):
    python scripts/add_source.py \\
        --region russia \\
        --name "Meduza English" \\
        --type rss \\
        --url "https://meduza.io/rss/en/all" \\
        --language en \\
        --category independent \\
        --skip-translation

    # New region:
    python scripts/add_source.py \\
        --region north_africa \\
        --region-label "North Africa" \\
        --region-color "#f472b6" \\
        --name "Libya Observer" \\
        --type rss \\
        --url "https://www.libyaobserver.ly/rss.xml" \\
        --language en \\
        --category independent \\
        --skip-translation

    # Telegram source:
    python scripts/add_source.py \\
        --region iran \\
        --name "IRGC Watch (TG)" \\
        --type telegram \\
        --channel "irgc_watch" \\
        --language fa \\
        --category state-aligned

Validation:
    --dry-run     Print what would change without writing anything.
    --validate    Test that the RSS URL is reachable and parseable.
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
import textwrap
from pathlib import Path
from typing import Optional

import yaml

# ──────────────────────────────── paths ────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
SOURCES_FILE = SCRIPT_DIR / "sources.yaml"
FEEDS_DIR = PROJECT_DIR / "data" / "feeds"
TYPES_FILE = PROJECT_DIR / "site" / "src" / "lib" / "types.ts"

# ──────────────────────────────── logging ──────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("add_source")

# ──────────────────────────────── constants ────────────────────────────

VALID_TYPES = {"rss", "scrape", "telegram"}
VALID_CATEGORIES = {"state", "state-aligned", "proxy", "independent", "unknown"}
VALID_LANGUAGES = {"en", "ar", "fa", "ru", "he", "zh", "tr", "ur", "hi", "fr", "de", "es", "pt"}
REGION_KEY_RE = re.compile(r"^[a-z][a-z0-9_]*$")
HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

# ──────────────────────────────── helpers ──────────────────────────────


def load_sources() -> dict:
    """Load the master sources.yaml."""
    with open(SOURCES_FILE, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def save_sources(data: dict) -> None:
    """Write sources.yaml back, preserving structure with block style."""
    class _Dumper(yaml.SafeDumper):
        pass

    def _str_representer(dumper, data):
        if "\n" in data:
            return dumper.represent_scalar("tag:yaml.org,2002:str", data, style="|")
        return dumper.represent_scalar("tag:yaml.org,2002:str", data)

    _Dumper.add_representer(str, _str_representer)

    with open(SOURCES_FILE, "w", encoding="utf-8") as f:
        yaml.dump(
            data,
            f,
            Dumper=_Dumper,
            default_flow_style=False,
            allow_unicode=True,
            sort_keys=False,
            width=120,
        )
    log.info("✓ Updated %s", SOURCES_FILE.relative_to(PROJECT_DIR))


def existing_region_keys(cfg: dict) -> set[str]:
    return set(cfg.get("regions", {}).keys())


def existing_source_names(cfg: dict, region: str) -> set[str]:
    return {
        s["name"]
        for s in cfg.get("regions", {}).get(region, {}).get("sources", [])
    }


def existing_source_urls(cfg: dict) -> set[str]:
    urls = set()
    for reg in cfg.get("regions", {}).values():
        for s in reg.get("sources", []):
            if "url" in s:
                urls.add(s["url"])
            if "channel" in s:
                urls.add(s["channel"])
    return urls


# ──────────────────────────────── validation ───────────────────────────

def validate_url_reachable(url: str, source_type: str) -> bool:
    """Best-effort check that the URL is reachable and looks like an RSS feed."""
    if source_type == "telegram":
        log.info("Telegram channel — skipping URL validation.")
        return True

    try:
        import requests  # optional dep
    except ImportError:
        log.warning("requests not installed — skipping URL validation.")
        return True

    try:
        log.info("Validating URL: %s", url)
        resp = requests.get(url, timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (compatible; NewsFeedBot/1.0)"
        })
        resp.raise_for_status()
    except Exception as exc:
        log.error("URL unreachable: %s — %s", url, exc)
        return False

    if source_type == "rss":
        try:
            import feedparser
            feed = feedparser.parse(resp.content)
            n = len(feed.entries)
            if n == 0:
                log.warning("RSS parsed but 0 entries — double-check the URL.")
            else:
                log.info("RSS OK — %d entries found.", n)
        except Exception as exc:
            log.warning("feedparser error: %s", exc)
    return True


# ──────────────────────────────── TypeScript sync ──────────────────────

def read_types_ts() -> str:
    return TYPES_FILE.read_text(encoding="utf-8")


def write_types_ts(content: str) -> None:
    TYPES_FILE.write_text(content, encoding="utf-8")
    log.info("✓ Updated %s", TYPES_FILE.relative_to(PROJECT_DIR))


def add_region_to_types_ts(key: str, label: str, color: str, *, dry_run: bool = False) -> bool:
    """
    Patch site/src/lib/types.ts to add the new region to:
      - RegionKey union type
      - REGIONS constant array
    Returns True if changes were made.
    """
    content = read_types_ts()
    changed = False

    # ── 1. Patch RegionKey union ──
    # Pattern: export type RegionKey = "iran" | "russia" | ... | "south_asia";
    rk_pattern = re.compile(
        r'(export\s+type\s+RegionKey\s*=\s*)("[\w"|\s]+?")(;)',
        re.DOTALL,
    )
    m = rk_pattern.search(content)
    if m:
        union_str = m.group(2)
        if f'"{key}"' not in union_str:
            new_union = union_str.rstrip('"') + f'" | "{key}"'
            # Fix: properly strip the trailing quote and add
            # Actually let's be more careful:
            new_union = union_str.rstrip().rstrip(";") + f' | "{key}"'
            content = content[:m.start(2)] + new_union + content[m.end(2):]
            changed = True
            log.info('  RegionKey: added "%s"', key)
        else:
            log.info('  RegionKey: "%s" already present.', key)
    else:
        log.warning("Could not locate RegionKey type. Manual edit needed.")

    # ── 2. Patch REGIONS array ──
    # Find the closing ]; of the REGIONS array
    regions_start = content.find("export const REGIONS: RegionConfig[]")
    if regions_start == -1:
        regions_start = content.find("export const REGIONS")
    if regions_start != -1:
        # Find the first ]; after regions_start
        bracket_end = content.find("];", regions_start)
        if bracket_end != -1:
            # Check if already present
            if f'key: "{key}"' in content[regions_start:bracket_end]:
                log.info("  REGIONS array: %s already present.", key)
            else:
                entry = f'  {{ key: "{key}", label: "{label}", color: "{color}" }},\n'
                content = content[:bracket_end] + entry + content[bracket_end:]
                changed = True
                log.info("  REGIONS array: added { key: %s, label: %s }", key, label)
        else:
            log.warning("Could not find end of REGIONS array.")
    else:
        log.warning("Could not locate REGIONS constant.")

    if changed and not dry_run:
        write_types_ts(content)
    return changed


# ──────────────────────────────── feed file ────────────────────────────

def ensure_feed_file(region: str, *, dry_run: bool = False) -> bool:
    """Create data/feeds/{region}.json with an empty array if it doesn't exist."""
    fp = FEEDS_DIR / f"{region}.json"
    if fp.exists():
        log.info("  Feed file %s already exists.", fp.name)
        return False
    if not dry_run:
        fp.write_text("[]", encoding="utf-8")
    log.info("✓ Created %s", fp.relative_to(PROJECT_DIR))
    return True


# ──────────────────────────────── sources.yaml ─────────────────────────

def add_source_to_yaml(
    cfg: dict,
    region: str,
    region_label: str,
    source: dict,
    *,
    dry_run: bool = False,
) -> dict:
    """
    Add a source entry to the sources config, creating the region if needed.
    Returns the updated config dict.
    """
    regions = cfg.setdefault("regions", {})

    # Create region block if new
    if region not in regions:
        regions[region] = {"label": region_label, "sources": []}
        log.info("✓ Created new region '%s' (%s) in sources.yaml", region, region_label)
    else:
        log.info("  Region '%s' already exists in sources.yaml.", region)

    regions[region]["sources"].append(source)
    log.info("✓ Added source '%s' under region '%s'", source["name"], region)

    if not dry_run:
        save_sources(cfg)
    return cfg


# ──────────────────────────────── build source dict ────────────────────

def build_source_entry(args) -> dict:
    """Build the source dict from parsed args."""
    entry: dict = {
        "name": args.name,
        "type": args.type,
        "language": args.language,
        "category": args.category,
    }

    if args.type == "rss":
        entry["url"] = args.url
    elif args.type == "scrape":
        entry["url"] = args.url
        if args.engine:
            entry["engine"] = args.engine
    elif args.type == "telegram":
        entry["channel"] = args.channel

    if args.skip_translation:
        entry["skip_translation"] = True

    return entry


# ──────────────────────────────── interactive ──────────────────────────

def prompt_choice(msg: str, choices: list[str], default: Optional[str] = None) -> str:
    """Prompt user to pick from a list or type a value."""
    while True:
        print(f"\n{msg}")
        for i, c in enumerate(choices, 1):
            marker = " (default)" if c == default else ""
            print(f"  {i}. {c}{marker}")
        raw = input("> ").strip()
        if not raw and default:
            return default
        if raw.isdigit() and 1 <= int(raw) <= len(choices):
            return choices[int(raw) - 1]
        if raw in choices:
            return raw
        print(f"  Invalid. Choose 1-{len(choices)} or type a value.")


def prompt_text(msg: str, default: Optional[str] = None, required: bool = True) -> str:
    hint = f" [{default}]" if default else ""
    while True:
        raw = input(f"{msg}{hint}: ").strip()
        if not raw and default:
            return default
        if raw or not required:
            return raw
        print("  Value required.")


def prompt_bool(msg: str, default: bool = False) -> bool:
    hint = " [Y/n]" if default else " [y/N]"
    raw = input(f"{msg}{hint}: ").strip().lower()
    if not raw:
        return default
    return raw in ("y", "yes", "1", "true")


def run_interactive(args):
    """Guide user through adding a source interactively."""
    cfg = load_sources()
    regions = list(existing_region_keys(cfg))

    print("=" * 60)
    print("  Add New Source — Interactive Mode")
    print("=" * 60)

    # Region
    print(f"\nExisting regions: {', '.join(sorted(regions))}")
    region = prompt_text("Region key (existing or new)", required=True).lower().replace(" ", "_")

    is_new_region = region not in regions
    if is_new_region:
        print(f"\n  ⚠ Region '{region}' is NEW — extra config needed.")
        region_label = prompt_text("Region display label", default=region.replace("_", " ").title())
        region_color = prompt_text("Region hex color (e.g. #f472b6)", default="#6b7280")
        if not HEX_COLOR_RE.match(region_color):
            log.error("Invalid hex color: %s", region_color)
            sys.exit(1)
    else:
        region_label = cfg["regions"][region]["label"]
        region_color = ""

    # Source type
    src_type = prompt_choice("Source type:", list(VALID_TYPES), default="rss")

    # Source name
    name = prompt_text("Source display name (e.g. 'Meduza English')")

    # URL or channel
    url = ""
    channel = ""
    if src_type in ("rss", "scrape"):
        url = prompt_text("Feed URL")
    else:
        channel = prompt_text("Telegram channel username (without @)")

    # Language
    language = prompt_choice(
        "Content language:", sorted(VALID_LANGUAGES), default="en"
    )

    # Category
    category = prompt_choice(
        "Source category:", sorted(VALID_CATEGORIES), default="independent"
    )

    # Skip translation?
    skip = False
    if language == "en":
        skip = prompt_bool("Skip translation (English source)?", default=True)
    else:
        skip = prompt_bool("Skip translation?", default=False)

    # Engine for scrape
    engine = None
    if src_type == "scrape":
        engine = prompt_choice("Scrape engine:", ["beautifulsoup", "playwright"], default="beautifulsoup")

    # Pack into namespace
    args.region = region
    args.region_label = region_label if is_new_region else ""
    args.region_color = region_color if is_new_region else ""
    args.type = src_type
    args.name = name
    args.url = url
    args.channel = channel
    args.language = language
    args.category = category
    args.skip_translation = skip
    args.engine = engine

    return args, is_new_region


# ──────────────────────────────── main ─────────────────────────────────

def validate_args(args) -> list[str]:
    """Return a list of validation error messages (empty = OK)."""
    errors: list[str] = []

    if not args.name:
        errors.append("--name is required.")
    if not args.type or args.type not in VALID_TYPES:
        errors.append(f"--type must be one of {VALID_TYPES}")
    if args.type in ("rss", "scrape") and not args.url:
        errors.append("--url is required for RSS/scrape sources.")
    if args.type == "telegram" and not args.channel:
        errors.append("--channel is required for Telegram sources.")
    if args.language and args.language not in VALID_LANGUAGES:
        errors.append(f"--language must be one of {sorted(VALID_LANGUAGES)}")
    if args.category and args.category not in VALID_CATEGORIES:
        errors.append(f"--category must be one of {sorted(VALID_CATEGORIES)}")
    if args.region and not REGION_KEY_RE.match(args.region):
        errors.append(f"Region key must match {REGION_KEY_RE.pattern} (got '{args.region}')")
    if args.region_color and not HEX_COLOR_RE.match(args.region_color):
        errors.append(f"--region-color must be a hex color like #f472b6 (got '{args.region_color}')")

    return errors


def run(args) -> int:
    """Execute the add-source operation. Returns 0 on success."""
    cfg = load_sources()
    is_new_region = args.region not in existing_region_keys(cfg)

    # ── Pre-flight checks ──
    if is_new_region:
        if not args.region_label:
            args.region_label = args.region.replace("_", " ").title()
        if not args.region_color:
            args.region_color = "#6b7280"  # default gray
        log.info("New region: %s (%s)", args.region, args.region_label)
    else:
        args.region_label = cfg["regions"][args.region]["label"]

    # Check for duplicate source name
    if args.name in existing_source_names(cfg, args.region):
        log.error("Source '%s' already exists in region '%s'.", args.name, args.region)
        return 1

    # Check for duplicate URL/channel
    known = existing_source_urls(cfg)
    dup_key = args.url or args.channel
    if dup_key and dup_key in known:
        log.error("URL/channel '%s' already registered in sources.yaml.", dup_key)
        return 1

    # Validate URL reachability
    if args.validate and args.type in ("rss", "scrape"):
        if not validate_url_reachable(args.url, args.type):
            if not args.force:
                log.error("URL validation failed. Use --force to add anyway.")
                return 1
            log.warning("Proceeding despite failed validation (--force).")

    # ── Summary ──
    source_entry = build_source_entry(args)
    print("\n" + "=" * 60)
    print("  Changes to apply:")
    print("=" * 60)
    print(f"  Region:    {args.region} ({'NEW' if is_new_region else 'existing'})")
    if is_new_region:
        print(f"  Label:     {args.region_label}")
        print(f"  Color:     {args.region_color}")
    print(f"  Source:    {source_entry}")
    print()
    print("  Files to update:")
    print(f"    1. scripts/sources.yaml           — add source entry")
    if is_new_region:
        print(f"    2. data/feeds/{args.region}.json   — create empty feed file")
        print(f"    3. site/src/lib/types.ts          — add RegionKey + REGIONS entry")
    print("=" * 60)

    if args.dry_run:
        print("\n  DRY RUN — no files modified.\n")
        return 0

    # ── Apply changes ──
    # 1. sources.yaml
    add_source_to_yaml(cfg, args.region, args.region_label, source_entry)

    # 2. Feed file (new region only)
    if is_new_region:
        ensure_feed_file(args.region)

    # 3. TypeScript types (new region only)
    if is_new_region:
        add_region_to_types_ts(args.region, args.region_label, args.region_color)

    print("\n✅ All files synchronised. You can now run the pipeline:")
    print(f"   cd scripts && poetry run python run_pipeline.py\n")
    return 0


def main():
    parser = argparse.ArgumentParser(
        description="Add a new RSS/Telegram/scrape source (and region) to the project.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            Examples:
              # Interactive mode (prompts for everything):
              python add_source.py

              # Non-interactive RSS:
              python add_source.py \\
                --region russia --name "Meduza EN" --type rss \\
                --url "https://meduza.io/rss/en/all" --language en \\
                --category independent --skip-translation --validate

              # New region + source:
              python add_source.py \\
                --region north_africa --region-label "North Africa" \\
                --region-color "#f472b6" \\
                --name "Libya Observer" --type rss \\
                --url "https://www.libyaobserver.ly/rss.xml" \\
                --language en --category independent --skip-translation
        """),
    )

    # Source params
    parser.add_argument("--region", help="Region key (e.g. iran, russia, or a new key)")
    parser.add_argument("--region-label", default="", help="Display label for new region")
    parser.add_argument("--region-color", default="", help="Hex color for new region (e.g. #f472b6)")
    parser.add_argument("--name", help="Source display name")
    parser.add_argument("--type", choices=sorted(VALID_TYPES), help="Source type")
    parser.add_argument("--url", default="", help="RSS/scrape URL")
    parser.add_argument("--channel", default="", help="Telegram channel (without @)")
    parser.add_argument("--language", default="en", help="ISO 639-1 language code")
    parser.add_argument("--category", default="independent", choices=sorted(VALID_CATEGORIES))
    parser.add_argument("--skip-translation", action="store_true", help="Mark as English (no translation needed)")
    parser.add_argument("--engine", choices=["beautifulsoup", "playwright"], help="Scrape engine (scrape type only)")

    # Control flags
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing files")
    parser.add_argument("--validate", action="store_true", help="Test that the feed URL is reachable")
    parser.add_argument("--force", action="store_true", help="Proceed even if validation fails")

    args = parser.parse_args()

    # If key required fields are missing, go interactive
    if not args.region or not args.name or not args.type:
        args, _ = run_interactive(args)

    # Validate
    errors = validate_args(args)
    if errors:
        for e in errors:
            log.error(e)
        sys.exit(1)

    sys.exit(run(args))


if __name__ == "__main__":
    main()
