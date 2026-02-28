---
description: "Add a new RSS/Telegram/scrape source (and region) to the NewFeeds war-monitoring pipeline"
---

# Add Source Agent Skill

## Purpose

Add a new news source to the NewFeeds project, automatically synchronising **all** files that reference regions, source lists, and frontend labels. Optionally create a brand-new region.

## When to use

Use this skill when the user asks to:

- Add a new RSS feed, Telegram channel, or web-scrape source
- Create a new region / geographic area for news monitoring
- Expand coverage to a new country or media outlet

## Touchpoints that MUST stay in sync

| # | File | What changes |
|---|------|-------------|
| 1 | `scripts/sources.yaml` | New source entry under the region (or new region block) |
| 2 | `data/feeds/{region}.json` | Empty `[]` JSON file created for **new regions only** |
| 3 | `site/src/lib/types.ts` | `RegionKey` union type + `REGIONS` config array for **new regions only** |

All three files must be updated atomically. The pipeline (`run_pipeline.py`), frontend (`page.tsx`, `NewsFeed.tsx`, `AttackCard.tsx`, `NewsCard.tsx`), and data layer (`data.ts`) derive region data dynamically from these three sources — no other files need manual edits.

## How to use

### Option A — Run the CLI tool

```sh
cd scripts

# Interactive (prompts for every field):
python add_source.py

# Non-interactive — existing region:
python add_source.py \
  --region russia \
  --name "Meduza English" \
  --type rss \
  --url "https://meduza.io/rss/en/all" \
  --language en \
  --category independent \
  --skip-translation \
  --validate

# Non-interactive — new region:
python add_source.py \
  --region north_africa \
  --region-label "North Africa" \
  --region-color "#f472b6" \
  --name "Libya Observer" \
  --type rss \
  --url "https://www.libyaobserver.ly/rss.xml" \
  --language en \
  --category independent \
  --skip-translation

# Telegram source:
python add_source.py \
  --region iran \
  --name "IRGC Watch (TG)" \
  --type telegram \
  --channel "irgc_watch" \
  --language fa \
  --category state-aligned
```

### Option B — Manual edits (follow the checklist)

1. **`scripts/sources.yaml`** — Add the source under the desired region:
   ```yaml
   regions:
     <region_key>:
       label: "<Display Name>"
       sources:
         - name: "<Source Name>"
           type: rss          # rss | scrape | telegram
           language: en       # ISO 639-1
           url: "<feed URL>"  # or channel: "<tg_channel>" for telegram
           category: state    # state | state-aligned | proxy | independent | unknown
           skip_translation: true  # only if language is English
   ```

2. **`data/feeds/<region_key>.json`** — Create with `[]` if the region is new.

3. **`site/src/lib/types.ts`** — If the region is new:
   - Add `"<region_key>"` to the `RegionKey` union type
   - Add `{ key: "<region_key>", label: "<Label>", color: "<#hex>" }` to the `REGIONS` array

## Source entry fields

| Field | Required | Values | Notes |
|-------|----------|--------|-------|
| `name` | ✅ | string | Human-readable, unique per region |
| `type` | ✅ | `rss` \| `scrape` \| `telegram` | |
| `language` | ✅ | ISO 639-1 (`en`, `ar`, `fa`, `ru`, `he`, …) | |
| `url` | for rss/scrape | URL string | |
| `channel` | for telegram | Username without `@` | |
| `category` | ✅ | `state` \| `state-aligned` \| `proxy` \| `independent` \| `unknown` | |
| `skip_translation` | optional | `true` | Set for English-language sources |
| `engine` | scrape only | `beautifulsoup` \| `playwright` | |

## Validation

- `--validate` flag tests RSS URL reachability and entry count via `feedparser`
- `--dry-run` prints the change plan without modifying any files
- Duplicate source names and URLs are rejected automatically

## Category guidance

| Category | Use when |
|----------|---------|
| `state` | Official government / state news agency (IRNA, TASS, Xinhua) |
| `state-aligned` | Editorially aligned with government but not official (Global Times, Daily Sabah) |
| `proxy` | Militia / non-state armed group media (Al Manar, SABA) |
| `independent` | Independent / opposition media |
| `unknown` | Cannot determine alignment |

## What happens next

After adding a source, the pipeline (`run_pipeline.py`) will automatically:
1. Fetch articles from the new source
2. Translate & assess relevance via LLM
3. Classify military events
4. Geocode attack locations
5. Update threat level
6. Generate executive summary

The frontend will display the new region tab and articles with no additional changes.
