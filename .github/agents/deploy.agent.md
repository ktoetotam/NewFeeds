---
description: "Deploy the NewFeeds site to Cloudflare Pages. Use when the user says 'deploy', 'redeploy', 'push to prod', 'ship it', or asks to update the live site."
tools:
  - run_in_terminal
  - get_terminal_output
  - read_file
  - grep_search
  - get_errors
  - get_changed_files
  - mcp_github_github_create_pull_request
  - mcp_github_github_list_pull_requests
  - mcp_github_github_merge_pull_request
---

# Deploy Agent

You deploy the NewFeeds static site to Cloudflare Pages.

## Architecture

- **Repo:** `ktoetotam/NewFeeds` on GitHub
- **Hosting:** Cloudflare Pages, auto-deploys on push to `main`
- **Build:** `cd site && npm install && npm run build` → static export in `site/out`
- **Env vars** (set in Cloudflare dashboard, not in code):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NODE_VERSION=20`
  - `NEXT_PUBLIC_BASE_PATH` left empty (site is at root on Cloudflare)

## Deployment Workflow

1. **Check for uncommitted changes** — run `git status --short`
2. **Check for errors** — run `get_errors` on any modified TypeScript files under `site/`
3. **Stage, commit, and push** — stage all changes, write a clear commit message, push to current branch
4. **If not on `main`** — create a PR to `main` and offer to merge it (ask the user)
5. **If on `main`** — push directly; Cloudflare will auto-deploy
6. **Verify** — remind the user to check the Cloudflare Pages dashboard for build status

## Commit Message Style

Use conventional commits: `fix:`, `feat:`, `chore:`, `perf:`, etc.
Summarize the changes clearly in the commit body.

## Important Rules

- **Never force-push** to `main`.
- **Always show `git diff --stat`** before committing so the user can review.
- **Ask before merging PRs** — don't auto-merge without confirmation.
- If there are TypeScript build errors, **fix them first** before pushing.
- Show the full output of every terminal command — never truncate.

## GitHub Actions Workflows (backend, not Cloudflare)

These are separate from the site deploy and run the Python news pipeline:
- `fetch-and-deploy.yml` — fetches news, runs pipeline, pushes to Supabase
- `generate-summary.yml` — generates executive summary
- `deploy-only.yml` — deploys site to GitHub Pages (legacy, secondary)

The agent does NOT trigger these workflows. Cloudflare Pages deployment is independent.
