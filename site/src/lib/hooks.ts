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
    classification: row.classification as Article["classification"],
  };
}

// Poll interval — 2 minutes for articles, 1 minute for attacks/threat
const ARTICLE_POLL_MS = 2 * 60 * 1000;
const FAST_POLL_MS = 60 * 1000;

// ── useArticlesByRegion ─────────────────────────────────────

export function useArticlesByRegion() {
  const [articlesByRegion, setArticlesByRegion] = useState<Record<string, Article[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const sb = getSupabaseBrowser();
    if (!sb) {
      setLoading(false);
      return;
    }

    const regions: RegionKey[] = REGIONS.map((r) => r.key);
    const results = await Promise.all(
      regions.map(async (region) => {
        const { data, error } = await sb
          .from("articles")
          .select("*")
          .eq("region", region)
          .not("relevant", "is", false)
          .eq("translated", true)
          .order("effective_time", { ascending: false });

        if (error) {
          console.warn(`[useArticlesByRegion] ${region}:`, error.message);
          return { region, articles: [] as Article[] };
        }
        return { region, articles: (data || []).map(rowToArticle) };
      })
    );

    const map: Record<string, Article[]> = {};
    for (const { region, articles } of results) {
      map[region] = articles;
    }
    setArticlesByRegion(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, ARTICLE_POLL_MS);
    return () => clearInterval(id);
  }, [fetchAll]);

  return { articlesByRegion, loading, refetch: fetchAll };
}

// ── useAttackArticles ───────────────────────────────────────

export function useAttackArticles() {
  const [attacks, setAttacks] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const sb = getSupabaseBrowser();
    if (!sb) {
      setLoading(false);
      return;
    }

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await sb
      .from("attacks")
      .select("*")
      .gte("effective_time", cutoff)
      .order("effective_time", { ascending: false });

    if (error) {
      console.warn("[useAttackArticles]", error.message);
    } else {
      setAttacks((data || []).map(rowToArticle));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, FAST_POLL_MS);
    return () => clearInterval(id);
  }, [fetch]);

  return { attacks, loading, refetch: fetch };
}

// ── useThreatLevel ──────────────────────────────────────────

export function useThreatLevel() {
  const [threatLevel, setThreatLevel] = useState<ThreatLevel>(DEFAULT_THREAT_LEVEL);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const sb = getSupabaseBrowser();
    if (!sb) {
      setLoading(false);
      return;
    }

    const { data, error } = await sb
      .from("threat_level")
      .select("*")
      .eq("id", "current")
      .single();

    if (!error && data) {
      setThreatLevel({
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
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, FAST_POLL_MS);
    return () => clearInterval(id);
  }, [fetch]);

  return { threatLevel, loading, refetch: fetch };
}

// ── useExecutiveSummary ─────────────────────────────────────

export function useExecutiveSummary() {
  const [summary, setSummary] = useState<ExecutiveSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const sb = getSupabaseBrowser();
    if (!sb) {
      setLoading(false);
      return;
    }

    const { data, error } = await sb
      .from("executive_summary")
      .select("*")
      .eq("id", "current")
      .single();

    if (!error && data?.data) {
      const blob =
        typeof data.data === "string" ? JSON.parse(data.data) : data.data;
      setSummary(blob as ExecutiveSummaryData);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, FAST_POLL_MS);
    return () => clearInterval(id);
  }, [fetch]);

  return { summary, loading, refetch: fetch };
}

// ── useOperationalBriefing ──────────────────────────────────

export function useOperationalBriefing() {
  const [briefing, setBriefing] = useState<OperationalBriefingData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const sb = getSupabaseBrowser();
    if (!sb) {
      setLoading(false);
      return;
    }

    const { data, error } = await sb
      .from("operational_briefing")
      .select("*")
      .eq("id", "current")
      .single();

    if (!error && data?.data) {
      const blob =
        typeof data.data === "string" ? JSON.parse(data.data) : data.data;
      setBriefing(blob as OperationalBriefingData);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, FAST_POLL_MS);
    return () => clearInterval(id);
  }, [fetch]);

  return { briefing, loading, refetch: fetch };
}
