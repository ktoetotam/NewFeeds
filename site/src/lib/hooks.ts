/**
 * Client-side React hooks that fetch live data from Supabase.
 *
 * These replace the build-time server-side `data.ts` queries so that
 * the static GitHub Pages site always shows the latest data.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabaseBrowser } from "./supabase-browser";
import type {
  Article,
  ThreatLevel,
  ExecutiveSummaryData,
  OperationalBriefingData,
  RegionKey,
  ArchiveEntry,
} from "./types";
import { REGIONS } from "./types";

// ── Helpers ─────────────────────────────────────────────────

const DEFAULT_THREAT_LEVEL: ThreatLevel = {
  current: {
    score: 0,
    level: 5,
    label: "LOW",
    color: "#16a34a",
    incident_count: 0,
    severity_breakdown: { major: 0, high: 0, medium: 0, low: 0 },
    window_hours: 24,
  },
  short_term_6h: { score: 0, level: 5, label: "LOW", incident_count: 0 },
  medium_term_48h: { score: 0, level: 5, label: "LOW", incident_count: 0 },
  trend: "stable",
  history: [],
  updated_at: new Date().toISOString(),
};

function rowToArticle(row: Record<string, unknown>): Article {
  return {
    id: row.id as string,
    title_original: (row.title_original as string) ?? "",
    title_en: (row.title_en as string) ?? "",
    content_original: (row.content_original as string) ?? "",
    summary_en: (row.summary_en as string) ?? "",
    url: (row.url as string) ?? "",
    published: row.published ? String(row.published) : "",
    fetched_at: row.fetched_at ? String(row.fetched_at) : undefined,
    source_name: (row.source_name as string) ?? "",
    source_category: (row.source_category as Article["source_category"]) ?? "unknown",
    language: (row.language as string) ?? "en",
    region: (row.region as string) ?? "",
    translated: row.translated as boolean,
    relevant: row.relevant as boolean | undefined,
    skip_translation: row.skip_translation as boolean | undefined,
    lat: row.lat as number | undefined,
    lng: row.lng as number | undefined,
    keyword_matches: row.keyword_matches as number | undefined,
    matched_keywords: row.matched_keywords as string[] | undefined,
    classification: typeof row.classification === "string"
      ? JSON.parse(row.classification)
      : row.classification as Article["classification"],
    countries_mentioned: (row.countries_mentioned as string[]) ?? [],
  };
}

// ── Local-fallback helpers ───────────────────────────────────

/** Rejects after `ms` milliseconds — used to race against Supabase. */
function timeoutReject(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), ms)
  );
}

async function fetchLocalArticles(): Promise<Article[]> {
  const res = await fetch("/api/local/articles");
  if (!res.ok) throw new Error("local articles unavailable");
  const data: Record<string, unknown>[] = await res.json();
  const filtered = data.filter(
    (r) => r.relevant !== false && r.translated === true
  );
  return filtered.map(rowToArticle);
}

async function fetchLocalAttacks(): Promise<Article[]> {
  const res = await fetch("/api/local/attacks");
  if (!res.ok) throw new Error("local attacks unavailable");
  const data: Record<string, unknown>[] = await res.json();
  return data.map(rowToArticle);
}

async function fetchLocalThreatLevel(): Promise<ThreatLevel> {
  const res = await fetch("/api/local/threat-level");
  if (!res.ok) throw new Error("local threat-level unavailable");
  return res.json() as Promise<ThreatLevel>;
}

async function fetchLocalExecutiveSummary(): Promise<ExecutiveSummaryData | null> {
  const res = await fetch("/api/local/executive-summary");
  if (!res.ok) return null;
  const row = await res.json() as { data: ExecutiveSummaryData };
  return row.data ?? null;
}

// How long to wait for Supabase before falling back to local JSON
const SUPABASE_TIMEOUT_MS = 8_000;

// Poll interval — 10 minutes for articles, 5 minutes for attacks/threat/summary
const ARTICLE_POLL_MS = 10 * 60 * 1000;
const FAST_POLL_MS = 5 * 60 * 1000;

// Only fetch columns the frontend actually uses (excludes content_original etc.)
// articles table does NOT have lat, lng, classification — those are attacks-only
const ARTICLE_COLUMNS = "id,title_original,title_en,summary_en,url,published,fetched_at,effective_time,source_name,source_category,language,region,translated,relevant,countries_mentioned";
const ATTACK_COLUMNS = "id,title_original,title_en,summary_en,url,published,fetched_at,effective_time,source_name,source_category,language,region,translated,relevant,countries_mentioned,lat,lng,classification,keyword_matches,matched_keywords";

// ── useArticlesByRegion ─────────────────────────────────────

export function useArticlesByRegion() {
  const [articlesByRegion, setArticlesByRegion] = useState<Record<string, Article[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const sb = getSupabaseBrowser();
    let articles: Article[] | null = null;

    if (sb) {
      try {
        const regions: RegionKey[] = REGIONS.map((r) => r.key);
        // Fetch up to 1000 per region, but only the last 24 hours
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const perRegionQueries = regions.map((region) =>
          sb
            .from("articles")
            .select(ARTICLE_COLUMNS)
            .eq("region", region)
            .not("relevant", "is", false)
            .eq("translated", true)
            .gte("effective_time", since)
            .order("effective_time", { ascending: false })
            .limit(200)
            .then((r) => r)
        );
        const results = await Promise.race([
          Promise.all(perRegionQueries),
          timeoutReject(SUPABASE_TIMEOUT_MS),
        ]);
        const allRows: Record<string, unknown>[] = [];
        let hasError = false;
        for (const result of results as Array<{ data: Record<string, unknown>[] | null; error: unknown }>) {
          if (result.error) {
            hasError = true;
            console.warn("[useArticlesByRegion] Supabase region error:", result.error);
          } else if (result.data) {
            allRows.push(...result.data);
          }
        }
        if (!hasError || allRows.length > 0) {
          articles = allRows.map(rowToArticle);
        }
      } catch (e) {
        console.warn("[useArticlesByRegion] Supabase unavailable, falling back to local data.", e);
      }
    }

    if (articles === null) {
      try {
        articles = await fetchLocalArticles();
      } catch (e) {
        console.warn("[useArticlesByRegion] Local fallback failed:", e);
        articles = [];
      }
    }

    // Group by region client-side
    const map: Record<string, Article[]> = {};
    for (const article of articles) {
      if (!map[article.region]) map[article.region] = [];
      map[article.region].push(article);
    }
    setArticlesByRegion(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, ARTICLE_POLL_MS);
    // Safety: never block UI forever if Supabase is paused / unreachable
    const safety = setTimeout(() => setLoading(false), 15_000);
    return () => { clearInterval(id); clearTimeout(safety); };
  }, [fetchAll]);

  return { articlesByRegion, loading, refetch: fetchAll };
}

// ── useAttackArticles ───────────────────────────────────────

export function useAttackArticles() {
  const [attacks, setAttacks] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const sb = getSupabaseBrowser();
    let articles: Article[] | null = null;

    if (sb) {
      try {
        const sbQuery = sb
          .from("attacks")
          .select(ATTACK_COLUMNS)
          .order("effective_time", { ascending: false })
          .limit(500)
          .then((r) => r);
        const result = await Promise.race([sbQuery, timeoutReject(SUPABASE_TIMEOUT_MS)]);
        if (!result.error) {
          articles = (result.data || []).map(rowToArticle);
        } else {
          console.warn("[useAttackArticles] Supabase error, falling back:", result.error.message);
        }
      } catch (e) {
        console.warn("[useAttackArticles] Supabase unavailable, falling back to local data.", e);
      }
    }

    if (articles === null) {
      try {
        articles = await fetchLocalAttacks();
      } catch (e) {
        console.warn("[useAttackArticles] Local fallback failed:", e);
        articles = [];
      }
    }

    const sorted = articles.sort((a, b) => {
      const tA = a.fetched_at ? new Date(a.fetched_at).getTime() : new Date(a.published).getTime();
      const tB = b.fetched_at ? new Date(b.fetched_at).getTime() : new Date(b.published).getTime();
      return tB - tA;
    });
    setAttacks(sorted);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, FAST_POLL_MS);
    const safety = setTimeout(() => setLoading(false), 15_000);
    return () => { clearInterval(id); clearTimeout(safety); };
  }, [fetch]);

  return { attacks, loading, refetch: fetch };
}

// ── useThreatLevel ──────────────────────────────────────────

export function useThreatLevel() {
  const [threatLevel, setThreatLevel] = useState<ThreatLevel>(DEFAULT_THREAT_LEVEL);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const sb = getSupabaseBrowser();
    let tl: ThreatLevel | null = null;

    if (sb) {
      try {
        const sbQuery = sb
          .from("threat_level")
          .select("*")
          .eq("id", "current")
          .single()
          .then((r) => r);
        const result = await Promise.race([sbQuery, timeoutReject(SUPABASE_TIMEOUT_MS)]);
        if (!result.error && result.data) {
          const data = result.data;
          tl = {
            current:
              typeof data.current_data === "string"
                ? JSON.parse(data.current_data)
                : data.current_data,
            short_term_6h:
              typeof data.short_term_6h === "string"
                ? JSON.parse(data.short_term_6h)
                : data.short_term_6h,
            medium_term_48h:
              typeof data.medium_term_48h === "string"
                ? JSON.parse(data.medium_term_48h)
                : data.medium_term_48h,
            trend: data.trend ?? "stable",
            history:
              typeof data.history === "string"
                ? JSON.parse(data.history)
                : (data.history ?? []),
            updated_at: data.updated_at ?? new Date().toISOString(),
          };
        } else if (result.error) {
          console.warn("[useThreatLevel] Supabase error, falling back:", result.error.message);
        }
      } catch (e) {
        console.warn("[useThreatLevel] Supabase unavailable, falling back to local data.", e);
      }
    }

    if (tl === null) {
      try {
        tl = await fetchLocalThreatLevel();
      } catch (e) {
        console.warn("[useThreatLevel] Local fallback failed:", e);
      }
    }

    if (tl) setThreatLevel(tl);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, FAST_POLL_MS);
    const safety = setTimeout(() => setLoading(false), 15_000);
    return () => { clearInterval(id); clearTimeout(safety); };
  }, [fetch]);

  return { threatLevel, loading, refetch: fetch };
}

// ── useExecutiveSummary ─────────────────────────────────────

export function useExecutiveSummary() {
  const [summary, setSummary] = useState<ExecutiveSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const sb = getSupabaseBrowser();
    let blob: ExecutiveSummaryData | null = null;

    if (sb) {
      try {
        const sbQuery = sb
          .from("executive_summary")
          .select("*")
          .eq("id", "current")
          .single()
          .then((r) => r);
        const result = await Promise.race([sbQuery, timeoutReject(SUPABASE_TIMEOUT_MS)]);
        if (!result.error && result.data?.data) {
          blob =
            typeof result.data.data === "string"
              ? JSON.parse(result.data.data)
              : result.data.data;
        } else if (result.error) {
          console.warn("[useExecutiveSummary] Supabase error, falling back:", result.error.message);
        }
      } catch (e) {
        console.warn("[useExecutiveSummary] Supabase unavailable, falling back to local data.", e);
      }
    }

    if (blob === null) {
      try {
        blob = await fetchLocalExecutiveSummary();
      } catch (e) {
        console.warn("[useExecutiveSummary] Local fallback failed:", e);
      }
    }

    if (blob) setSummary(blob);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, FAST_POLL_MS);
    const safety = setTimeout(() => setLoading(false), 15_000);
    return () => { clearInterval(id); clearTimeout(safety); };
  }, [fetch]);

  return { summary, loading, refetch: fetch };
}

// ── useOperationalBriefing ──────────────────────────────────

export function useOperationalBriefing() {
  const [briefing, setBriefing] = useState<OperationalBriefingData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const sb = getSupabaseBrowser();
    let blob: OperationalBriefingData | null = null;

    if (sb) {
      try {
        const sbQuery = sb
          .from("operational_briefing")
          .select("*")
          .eq("id", "current")
          .single()
          .then((r) => r);
        const result = await Promise.race([sbQuery, timeoutReject(SUPABASE_TIMEOUT_MS)]);
        if (!result.error && result.data?.data) {
          blob =
            typeof result.data.data === "string"
              ? JSON.parse(result.data.data)
              : result.data.data;
        } else if (result.error) {
          console.warn("[useOperationalBriefing] Supabase error, falling back:", result.error.message);
        }
      } catch (e) {
        console.warn("[useOperationalBriefing] Supabase unavailable, falling back to local data.", e);
      }
    }

    if (blob === null) {
      // No local file for operational briefing — just unset loading
    }

    if (blob) setBriefing(blob);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, FAST_POLL_MS);
    const safety = setTimeout(() => setLoading(false), 15_000);
    return () => { clearInterval(id); clearTimeout(safety); };
  }, [fetch]);

  return { briefing, loading, refetch: fetch };
}
