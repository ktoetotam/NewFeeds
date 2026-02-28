# Iran & Region Situation Monitor

Real-time monitoring dashboard aggregating state media from **Iran, Russia, Israel, Gulf States, and proxy actors** (Hezbollah, Houthis) in their native languages, with English translations, summaries, and attack classification.

## Features

- **Multi-source news feed**: 20+ sources across Farsi, Russian, Arabic, Hebrew, and English
- **English translations & summaries**: Powered by MiniMax AI — 2-3 sentence summaries per article
- **Attack Monitor**: Keyword pre-filter + LLM classification of military/security events
- **DEFCON-style threat level**: 5-level indicator computed from 24h incident severity
- **Auto-updating**: GitHub Actions fetches, translates, and deploys every 15 minutes
- **Static site**: Fast, no server needed — hosted on GitHub Pages

## Sources

| Region | Sources | Language |
|--------|---------|----------|
| Iran | IRNA, Tasnim, Fars News, Press TV, Al Alam | fa, en, ar |
| Russia | TASS, RIA Novosti | ru |
| Israel | Ynet, Maariv | he |
| Gulf States | QNA (Qatar), BNA (Bahrain), Al Arabiya, SPA (Saudi), WAM (UAE), ONA (Oman) | ar |
| Proxy Actors | Al Manar (Hezbollah), Al Masirah (Houthis), SABA News (Yemen) | ar |

## Setup

### 1. Fork/Clone this repository

```bash
git clone https://github.com/YOUR_USERNAME/NewFeeds.git
cd NewFeeds
```

### 2. Set up the MiniMax API key

Go to **Settings → Secrets and variables → Actions → New repository secret**:
- Name: `MINIMAX_API_KEY`
- Value: Your MiniMax API key

### 3. Enable GitHub Pages

Go to **Settings → Pages**:
- Source: **GitHub Actions**

### 4. Trigger the first run

Go to **Actions → "Fetch News & Deploy" → Run workflow**

The pipeline will:
1. Fetch RSS feeds and scrape websites
2. Translate articles to English via MiniMax
3. Classify military/attack events
4. Compute threat level
5. Build and deploy the static site

### Local Development

**Python pipeline:**
```bash
cd scripts
pip install -r requirements.txt
playwright install chromium
MINIMAX_API_KEY=your_key python run_pipeline.py
```

**Next.js site:**
```bash
cd site
npm install
npm run dev
```

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌────────────────┐
│  RSS Feeds      │────▶│  Python      │────▶│  data/*.json   │
│  HTML Scrapers  │     │  Pipeline    │     │  (committed)   │
└─────────────────┘     │              │     └───────┬────────┘
                        │  • fetch     │             │
┌─────────────────┐     │  • translate │     ┌───────▼────────┐
│  MiniMax API    │◀───▶│  • classify  │     │  Next.js SSG   │
│  (translation)  │     │  • threat    │     │  Static Build  │
└─────────────────┘     └──────────────┘     └───────┬────────┘
                                                     │
                        ┌──────────────┐     ┌───────▼────────┐
                        │  GitHub      │────▶│  GitHub Pages  │
                        │  Actions     │     │  (site/out/)   │
                        │  (cron 15m)  │     └────────────────┘
                        └──────────────┘
```

## License

MIT
