# NewFeeds — Global Conflict & Security Monitor

> **Read the story behind this project:** [I Built a Public Monitoring Website](https://msukhareva.substack.com/p/i-built-a-public-monitoring-website) on the [AI Realist](https://msukhareva.substack.com/) Substack.

Real-time monitoring dashboard that aggregates **120+ news sources** across **10 regions** in **7 languages** (Farsi, Russian, Arabic, Hebrew, German, English, Urdu), translates everything to English, classifies military events, and generates AI-powered executive briefings — all fully automated.

**Dual-LLM architecture:**
- [**Qwen3.5-122B**](https://huggingface.co/Qwen/Qwen3.5-122B-A10B) on a self-hosted NVIDIA DGX Spark via llama.cpp — high-volume translation, relevance scoring, and attack classification
- [**MiniMax M2.5**](https://www.minimaxi.com/) via API — executive summary and operational briefing generation

---

## Features

- **Multi-source news feed** — 120+ RSS feeds, Telegram channels, and web scrapers across 10 geographic regions
- **AI translation & summarisation** — Qwen3.5-122B translates and produces 2–3 sentence summaries per article with propaganda-neutrality filtering
- **Attack Monitor** — Two-stage classification: regex keyword pre-filter → LLM severity/category/parties/location extraction
- **DEFCON-style threat level** — 5-level indicator (LOW → MAJOR) computed from 24 h incident severity with trend tracking
- **Interactive attack map** — Geocoded military events plotted on a Leaflet map via OpenStreetMap Nominatim
- **Executive briefings** — NATO SITREP–style AI-generated summaries (MiniMax M2.5) with operational impacts, escalation risks, and de-escalation pathways
- **Continuous pipeline** — GitHub Actions runs a self-triggering loop via `repository_dispatch`; summary generation every 20 min; frontend auto-refreshes every 5 minutes
- **Dual hosting** — Deploy to Cloudflare Pages (primary) or GitHub Pages with a single env-var toggle
- **Supabase real-time backend** — Pipeline writes to Supabase; frontend reads live data client-side with local JSON fallback

---

## Architecture

```
┌──────────────────┐     ┌───────────────────┐     ┌──────────────────┐
│  RSS Feeds       │     │  Python Pipeline   │     │  Supabase        │
│  Telegram (t.me) │────▶│                    │────▶│  (PostgreSQL)    │
│  Web Scrapers    │     │  fetch_rss.py      │     │                  │
└──────────────────┘     │  fetch_telegram.py │     │  articles        │
                         │  fetch_scrape.py   │     │  attacks         │
┌──────────────────┐     │  translate_sum…    │     │  threat_level    │
│  DGX Spark       │◀───▶│  classify_attacks  │     │  exec_summary    │
│  Qwen3.5-122B    │     │  geocode_new.py    │     │  summary_archive │
│  (llama.cpp)     │     │  threat_level.py   │     └────────┬─────────┘
└──────────────────┘     │                    │              │
                         │  generate_summary  │     ┌───────▼─────────┐
┌──────────────────┐     │  generate_briefing │     │  Next.js 16     │
│  MiniMax M2.5    │◀───▶│                    │     │  React 19       │
│  (summary API)   │     └───────────────────┘     │  Tailwind 4     │
└──────────────────┘                                │  Leaflet maps   │
                         ┌───────────────────┐      └───────┬─────────┘
┌──────────────────┐     │  Cloudflare Pages │              │
│  Nominatim       │     │  or GitHub Pages  │◀─────────────┘
│  (geocoding)     │     └───────────────────┘
└──────────────────┘              ▲
                                  │
┌──────────────────┐     ┌────────┴──────────┐
│  Tailscale VPN   │────▶│  GitHub Actions   │
│  (DGX access)    │     │  (continuous loop) │
└──────────────────┘     └───────────────────┘
```

### Pipeline steps

| Step | Script | Description |
|------|--------|-------------|
| **fetch** | `fetch_rss.py`, `fetch_telegram.py`, `fetch_scrape.py` | Ingest articles from RSS, Telegram public previews, and web scrapers (< 30 min old) |
| **translate** | `translate_summarize.py` | Translate title → assess relevance → produce 2–3 sentence English summary via Qwen3.5-122B (DGX) |
| **classify** | `classify_attacks.py` | Regex keyword pre-filter + LLM classification → `is_attack`, severity, category, parties, location (DGX) |
| **geocode** | `geocode_new.py` | Geocode attack locations via OpenStreetMap Nominatim (free, no API key) |
| **threat** | `threat_level.py` | DEFCON-style 1–5 scoring from 24 h attacks. Weights: major=10, high=5, medium=2, low=1 |
| **summary** | `generate_summary.py`, `generate_briefing.py` | NATO SITREP–style executive briefing + operational briefing via MiniMax M2.5 |

---

## Sources

### By region

| Region | # Sources | Key outlets | Languages | Type |
|--------|-----------|-------------|-----------|------|
| **Iran** | 12 | IRNA, Tasnim News, Press TV, Al Alam, Tehran Times, Iran International (TG) | fa, en, ar | RSS + Telegram |
| **Russia** | 12 | TASS, RIA Novosti, RT, Kommersant, RBC, Rybar (TG), Russian MoD (TG) | ru, en | RSS + Telegram |
| **Israel** | 15 | Ynet, Maariv, Jerusalem Post, Mivzakim, IsraelInfo, HonestReporting | he, ru, en | RSS |
| **Gulf States** | 8 | QNA Qatar, Al Jazeera (AR/EN), Asharq Al-Awsat, WAM (TG) | ar, en | RSS + Telegram |
| **Middle East** | 28 | Middle East Eye, Al-Monitor, SANA Syria, Jordan Times, Daily News Egypt, Iraq Business News | ar, en | RSS + Telegram |
| **Proxy Actors** | 10 | Al Masirah (Houthi), Islamic Resistance Iraq (TG), Hezbollah Electronic Army (TG) | ar, en | RSS + Telegram |
| **China** | 5 | Xinhua, Global Times, CGTN, China Daily, South China Morning Post | en | RSS |
| **Turkey** | 2 | Anadolu Agency, Daily Sabah | en | RSS |
| **South Asia** | 7 | Dawn, Geo TV, Express Tribune, The Hindu, Times of India, Hindustan Times | en | RSS |
| **Western** | 21 | NYT, BBC, CNN, Washington Post, WSJ, The Guardian, FOX News, DW, Tagesschau, Bellingcat | en, de | RSS |

### Source categories

| Category | Description | Examples |
|----------|-------------|---------|
| `state` | Official government / state news agency | IRNA, TASS, Xinhua, QNA |
| `state-aligned` | Editorially aligned with government | Global Times, Daily Sabah, Tasnim |
| `proxy` | Militia / non-state armed group media | Al Masirah, Houthi TG channels |
| `independent` | Independent / opposition media | Middle East Eye, Bellingcat, Dawn |
| `unknown` | Cannot determine alignment | — |

---

## Setup

### Prerequisites

- **Python 3.12+** (with Poetry)
- **Node.js 20+**
- **LLM endpoint** — either a self-hosted OpenAI-compatible server (llama.cpp, vLLM) or a cloud API (MiniMax, OpenAI, etc.)
- **MiniMax API key** (for summary generation) — sign up at [minimaxi.com](https://www.minimaxi.com/)
- **Supabase project** — free tier at [supabase.com](https://supabase.com/)
- **(Optional) NVIDIA DGX / GPU server** — for self-hosted inference with Tailscale VPN

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/NewFeeds.git
cd NewFeeds
```

### 2. Set up the Python pipeline

```bash
cd scripts
pip install poetry
poetry install --no-root
poetry run python -m playwright install chromium --with-deps
```

### 3. Set up the Next.js frontend

```bash
cd site
npm install
```

### 4. Create a Supabase project

1. Go to [supabase.com](https://supabase.com/) → **New Project**
2. Run the migration to create tables:
   ```bash
   # Apply the SQL migration in Supabase SQL Editor or via CLI
   cat scripts/supabase_migration.sql | supabase db push
   ```
3. Note your project values:
   - **Project URL** (e.g. `https://xxxx.supabase.co`)
   - **Anon key** (safe for client-side, respects RLS)
   - **Service role key** (bypasses RLS — keep secret, pipeline only)

### 4b. (Optional) Set up DGX / GPU inference server

If you want to self-host the LLM instead of using a cloud API:

```bash
# On the GPU server:
bash scripts/setup_dgx_inference.sh
```

This builds llama.cpp with CUDA, downloads Qwen3.5-122B-A10B (GGUF Q5_K_XL), and creates a systemd service on port 8080 with 4 concurrent request slots.

For GitHub Actions connectivity, set up [Tailscale](https://tailscale.com/) on the GPU server and use Tailscale OAuth in the workflow (already configured in `fetch-and-deploy.yml`).

### 5. Configure environment variables

Create a `.env` file in `scripts/` for local pipeline development:

```bash
# LLM endpoint (translate, classify) — self-hosted or cloud
LLM_API_URL=http://your-gpu-server:8080/v1/chat/completions
LLM_API_KEY=not-needed          # any string for llama.cpp; real key for cloud APIs
LLM_MODEL=qwen3.5-122b          # model name (llama.cpp ignores this)

# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
```

Create `site/.env.local` for the frontend:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 6. Run locally

**Pipeline:**
```bash
cd scripts
LLM_API_URL="http://localhost:8080/v1/chat/completions" \
LLM_API_KEY="not-needed" \
LLM_MODEL="qwen3.5" \
poetry run python run_pipeline.py

# Or run specific steps / regions:
PIPELINE_REGIONS=iran,russia poetry run python run_pipeline.py --steps fetch,translate
```

**Summary generation (MiniMax):**
```bash
cd scripts
LLM_API_URL="https://api.minimax.io/v1/text/chatcompletion_v2" \
LLM_API_KEY="your_minimax_key" \
LLM_MODEL="MiniMax-M2.5" \
poetry run python run_summary.py
```

**Frontend:**
```bash
cd site
npm run dev
# Opens at http://localhost:3000
```

---

## Environment variables reference

### Pipeline (Python)

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_API_URL` | Yes | Chat completions endpoint — self-hosted (e.g. `http://100.x.x.x:8080/v1/chat/completions`) or cloud API |
| `LLM_API_KEY` | Yes | Bearer token for the LLM endpoint (any string for llama.cpp) |
| `LLM_MODEL` | Yes | Model name (e.g. `qwen3.5-122b`, `MiniMax-M2.5`) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Service-role key (bypasses RLS, never expose client-side) |
| `PIPELINE_REGIONS` | No | Comma-separated region filter (e.g. `iran,russia`) |
| `TEST_MODE` | No | Set `true` to limit to 3 articles per region |
| `LLM_CONCURRENCY` | No | Parallel LLM requests for translation (default: 4) |
| `LLM_CLASSIFY_CONCURRENCY` | No | Parallel LLM requests for classification (default: 3) |

### Frontend (Next.js)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase URL baked into JS bundle |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Anon key baked into JS bundle |
| `NEXT_PUBLIC_BASE_PATH` | No | Set to `"/NewFeeds"` for GitHub Pages; leave empty for Cloudflare |

---

## Deployment

### Option A — Cloudflare Pages (recommended)

Cloudflare Pages gives global CDN, instant deploys, and a free custom domain.

#### 1. Connect your repository

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create application** → **Pages**
2. Connect your GitHub repository
3. Configure build settings:

| Setting | Value |
|---------|-------|
| **Framework preset** | Next.js (Static HTML Export) |
| **Build command** | `cd site && npm install && npm run build` |
| **Build output directory** | `site/out` |
| **Root directory** | `/` (repository root) |
| **Node.js version** | `20` |

#### 2. Set environment variables

In the Cloudflare Pages project → **Settings** → **Environment variables**, add:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `NEXT_PUBLIC_BASE_PATH` | *(leave empty)* |
| `NODE_VERSION` | `20` |

> **Important:** Do NOT set `NEXT_PUBLIC_BASE_PATH` for Cloudflare — the site deploys at the root.

#### 3. Set up a custom domain (optional)

1. In Cloudflare Pages → **Custom domains** → **Set up a custom domain**
2. Enter your domain (e.g. `monitor.yourdomain.com`)
3. Cloudflare automatically provisions an SSL certificate

#### 4. Deploy

Every push to `main` triggers an automatic build and deploy. You can also trigger manual deploys from the Cloudflare dashboard.

---

### Option B — GitHub Pages

#### 1. Enable GitHub Pages

Go to **Settings** → **Pages** → Source: **GitHub Actions**

#### 2. Set environment variables in GitHub

Go to **Settings** → **Secrets and variables** → **Actions** → **New repository secret** and add each secret:

| Secret name | Value |
|-------------|-------|
| `LLM_API_URL` | Your DGX/GPU endpoint (e.g. `http://100.x.x.x:8080/v1/chat/completions`) |
| `LLM_API_KEY` | LLM API key (any string for llama.cpp) |
| `LLM_MODEL` | Model name (e.g. `qwen3.5-122b`) |
| `MINIMAX_API_URL` | `https://api.minimax.io/v1/text/chatcompletion_v2` |
| `MINIMAX_API_KEY` | Your MiniMax API key |
| `MINIMAX_MODEL` | `MiniMax-M2.5` |
| `SUPABASE_URL` | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Your service-role key |
| `SUPABASE_ANON_KEY` | Your anon key |
| `TS_OAUTH_CLIENT_ID` | Tailscale OAuth client ID (for DGX connectivity) |
| `TS_OAUTH_SECRET` | Tailscale OAuth secret |
| `PIPELINE_PAT` | GitHub fine-grained PAT with `Contents: Read` (for self-trigger loop) |

Then add these as **repository variables** (not secrets) under **Actions** → **Variables**:

| Variable name | Value |
|---------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your anon key |
| `NEXT_PUBLIC_BASE_PATH` | `/NewFeeds` (GitHub Pages only; leave empty for Cloudflare) |

#### 3. Trigger the pipeline

Go to **Actions** → **"Fetch News & Deploy"** → **Run workflow**

The workflow processes all 10 regions in a single job (the DGX server handles concurrency). After each run, it automatically re-triggers itself via `repository_dispatch` with a 60 s delay, creating a continuous pipeline loop. A `*/30` cron serves as fallback if the self-trigger fails.

Pipeline steps per run: fetch → translate → classify → geocode → threat → push to Supabase.

#### 4. Deploy the site

Go to **Actions** → **"Deploy Site Only"** → **Run workflow**

This builds the Next.js static export and deploys to GitHub Pages at `https://YOUR_USERNAME.github.io/NewFeeds/`.

---

### Setting up GitHub Actions environment variables

All pipeline secrets are configured in your GitHub repository settings:

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Under **Repository secrets**, click **New repository secret**
4. Add each secret one by one:

```
# DGX / self-hosted LLM (for fetch-and-deploy workflow)
LLM_API_URL            → http://100.x.x.x:8080/v1/chat/completions
LLM_API_KEY            → not-needed (any string for llama.cpp)
LLM_MODEL              → qwen3.5-122b

# MiniMax API (for generate-summary workflow)
MINIMAX_API_URL        → https://api.minimax.io/v1/text/chatcompletion_v2
MINIMAX_API_KEY        → sk-api-...
MINIMAX_MODEL          → MiniMax-M2.5

# Supabase
SUPABASE_URL           → https://xxxx.supabase.co
SUPABASE_SERVICE_KEY   → eyJ... (service role key)
SUPABASE_ANON_KEY      → eyJ... (anon key)

# Tailscale (for DGX VPN access from GitHub Actions)
TS_OAUTH_CLIENT_ID     → tskey-client-...
TS_OAUTH_SECRET        → tskey-...

# Self-trigger loop
PIPELINE_PAT           → github_pat_... (fine-grained PAT with Contents: Read)
```

5. Under **Repository variables** (tab next to Secrets), add:

```
NEXT_PUBLIC_SUPABASE_URL       → https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  → eyJ... (anon key)
NEXT_PUBLIC_BASE_PATH          → /NewFeeds  (GitHub Pages only)
```

> **Secrets** are encrypted and hidden in logs. Use them for API keys and service tokens.
> **Variables** are visible in logs. Use them for non-sensitive configuration like URLs and base paths.

---

## GitHub Actions workflows

| Workflow | Trigger | LLM | Description |
|----------|---------|-----|-------------|
| **Fetch News & Deploy** | Continuous self-trigger + `*/30` cron fallback | DGX (Qwen3.5-122B via Tailscale) | All regions in a single job: fetch → translate → classify → geocode → threat → push to Supabase |
| **Generate Executive Summary** | `*/20` cron (every 20 min) | MiniMax M2.5 (API) | Executive summary + operational briefing from latest Supabase data |
| **Deploy Site Only** | Manual | — | Build Next.js static export and deploy to GitHub Pages |
| **Test Supabase Pipeline** | Manual | DGX | Debug/test workflow for pipeline validation |

---

## Adding a new source

Use the CLI tool or edit files manually. See [`.github/copilot-instructions.md`](.github/copilot-instructions.md) for the full guide.

**Quick example — add an RSS source:**
```bash
cd scripts
python add_source.py \
  --region russia \
  --name "Meduza English" \
  --type rss \
  --url "https://meduza.io/rss/en/all" \
  --language en \
  --category independent \
  --skip-translation \
  --validate
```

**Quick example — add a Telegram source:**
```bash
python add_source.py \
  --region iran \
  --name "IRGC Watch (TG)" \
  --type telegram \
  --channel "irgc_watch" \
  --language fa \
  --category state-aligned
```

Three files stay in sync automatically: `scripts/sources.yaml`, `data/feeds/<region>.json`, `site/src/lib/types.ts`.

---

## Supabase schema

| Table | Key | Description |
|-------|-----|-------------|
| `articles` | `id` (upsert) | Translated articles per region |
| `attacks` | `id` (upsert) | Classified military/security events |
| `threat_level` | `id="current"` | Current DEFCON-style threat assessment |
| `executive_summary` | `id="current"` | Latest AI-generated executive briefing |
| `summary_archive` | auto | Historical executive summaries |
| `operational_briefing` | `id="current"` | Latest operational briefing |
| `briefing_archive` | auto | Historical operational briefings |

The SQL migration is at [`scripts/supabase_migration.sql`](scripts/supabase_migration.sql).

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| **LLM (high-volume)** | [Qwen3.5-122B-A10B](https://huggingface.co/Qwen/Qwen3.5-122B-A10B) via llama.cpp on NVIDIA DGX Spark — translation, relevance scoring, attack classification |
| **LLM (summaries)** | [MiniMax M2.5](https://www.minimaxi.com/) — executive summary and operational briefing generation |
| **Pipeline** | Python 3.12, Poetry, feedparser, BeautifulSoup, Playwright, requests |
| **Database** | [Supabase](https://supabase.com/) (PostgreSQL + real-time + RLS) |
| **Frontend** | Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 4 |
| **Maps** | Leaflet + react-leaflet with OpenStreetMap tiles |
| **Geocoding** | OpenStreetMap Nominatim (free, no API key) |
| **Networking** | [Tailscale](https://tailscale.com/) VPN — connects GitHub Actions runners to DGX Spark |
| **CI/CD** | GitHub Actions (continuous self-trigger loop + cron fallback) |
| **Hosting** | Cloudflare Pages or GitHub Pages (static export) |

---

## Project structure

```
NewFeeds/
├── .github/workflows/       # CI/CD — fetch-and-deploy, deploy-only, generate-summary
├── data/
│   ├── feeds/               # Per-region article JSON (iran.json, russia.json, …)
│   ├── attacks.json          # Classified military events
│   ├── threat_level.json     # Current threat assessment
│   ├── executive_summary.json
│   └── summary_archive/     # Historical briefings
├── scripts/
│   ├── sources.yaml          # All source definitions (RSS, Telegram, scrape)
│   ├── run_pipeline.py       # Main orchestrator
│   ├── llm_client.py         # Shared LLM client (OpenAI-compatible + MiniMax)
│   ├── fetch_rss.py          # RSS feed ingestion
│   ├── fetch_telegram.py     # Telegram channel scraper
│   ├── fetch_scrape.py       # Web scraper (BS4 / Playwright)
│   ├── translate_summarize.py # LLM translation + summary
│   ├── classify_attacks.py   # Attack classification
│   ├── geocode_new.py        # Location geocoding
│   ├── threat_level.py       # Threat level computation
│   ├── generate_summary.py   # Executive briefing generation
│   ├── generate_briefing.py  # Operational briefing generation
│   ├── run_summary.py        # Standalone summary runner
│   ├── db.py                 # Supabase database layer
│   ├── add_source.py         # CLI to add new sources
│   ├── setup_dgx_inference.sh # DGX Spark llama.cpp server setup
│   └── pyproject.toml        # Python dependencies (Poetry)
├── site/
│   ├── src/
│   │   ├── app/              # Next.js pages (/, /attacks, /summary, /briefing)
│   │   ├── components/       # React components (NewsFeed, AttackMap, ThreatLevel, …)
│   │   └── lib/              # Types, data layer, Supabase client, hooks
│   ├── next.config.ts
│   └── package.json
└── README.md
```

---


## License

MIT
