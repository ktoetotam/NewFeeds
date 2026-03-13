import "server-only";
import fs from "fs";
import path from "path";
import type { Article, ThreatLevel, RegionKey, ExecutiveSummaryData, ArchiveEntry } from "./types";
import { REGIONS } from "./types";
import { cpSync, existsSync, mkdirSync } from "fs";
import { getSupabase, isSupabaseEnabled } from "./supabase";

const DATA_DIR = path.join(process.cwd(), "..", "data");
const FEEDS_DIR = path.join(DATA_DIR, "feeds");
const ARCHIVE_DIR = path.join(DATA_DIR, "summary_archive");

// ── JSON fallback helpers ───────────────────────────────────

function readJSON<T>(filePath: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Returns the effective timestamp used for display (matches formatTimeAgo logic). */
function effectiveTime(a: Article): number {
  const now = Date.now();
  const pub = new Date(a.published).getTime();
  if (!isNaN(pub) && pub <= now) return pub;
  const fetched = a.fetched_at ? new Date(a.fetched_at).getTime() : NaN;
  if (!isNaN(fetched)) return fetched;
  return 0;
}

// ── Default threat level (shared fallback) ──────────────────

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

// ── Supabase row → Article mapper ───────────────────────────

// Only fetch columns the frontend actually uses (excludes content_original etc.)
// articles table does NOT have lat, lng, classification — those are attacks-only
const ARTICLE_COLUMNS = "id,title_original,title_en,summary_en,url,published,fetched_at,effective_time,source_name,source_category,language,region,translated,relevant,countries_mentioned";
const ATTACK_COLUMNS = "id,title_original,title_en,summary_en,url,published,fetched_at,effective_time,source_name,source_category,language,region,translated,relevant,countries_mentioned,lat,lng,classification,keyword_matches,matched_keywords";

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
  };
}

// ── Public async API ────────────────────────────────────────

export async function getArticlesByRegion(region: RegionKey): Promise<Article[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("articles")
        .select(ARTICLE_COLUMNS)
        .eq("region", region)
        .not("relevant", "is", false)
        .eq("translated", true)
        .order("effective_time", { ascending: false })
        .limit(200);

      if (!error && data) {
        return data.map(rowToArticle);
      }
      console.warn(`[data] Supabase articles query failed for ${region}:`, error?.message);
    } catch (e) {
      console.warn(`[data] Supabase articles exception for ${region}:`, e);
    }
  }

  // Fallback: read from JSON files
  const raw = readJSON<Article[]>(path.join(FEEDS_DIR, `${region}.json`), []);
  const filtered = raw.filter((a) => a.relevant !== false && a.translated === true);
  filtered.sort((a, b) => effectiveTime(b) - effectiveTime(a));
  return filtered;
}

export async function getAllArticles(): Promise<Article[]> {
  const regions: RegionKey[] = REGIONS.map((r) => r.key);

  if (isSupabaseEnabled()) {
    // Fetch all regions in parallel from Supabase
    const results = await Promise.all(regions.map((r) => getArticlesByRegion(r)));
    const all = results.flat();
    all.sort((a, b) => effectiveTime(b) - effectiveTime(a));
    return all;
  }

  // Fallback: sequential JSON reads
  const all: Article[] = [];
  for (const region of regions) {
    all.push(...(await getArticlesByRegion(region)));
  }
  all.sort((a, b) => effectiveTime(b) - effectiveTime(a));
  return all;
}

export async function getAttackArticles(): Promise<Article[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("attacks")
        .select(ATTACK_COLUMNS)
        .order("effective_time", { ascending: false })
        .limit(500);

      if (!error && data) {
        return data
          .map(rowToArticle)
          .sort((a, b) => effectiveTime(b) - effectiveTime(a));
      }
      console.warn("[data] Supabase attacks query failed:", error?.message);
    } catch (e) {
      console.warn("[data] Supabase attacks exception:", e);
    }
  }

  // Fallback
  const attacks = readJSON<Article[]>(path.join(DATA_DIR, "attacks.json"), []);
  return attacks
    .sort((a, b) => effectiveTime(b) - effectiveTime(a))
    .slice(0, 1000);
}

export async function getThreatLevel(): Promise<ThreatLevel> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("threat_level")
        .select("*")
        .eq("id", "current")
        .single();

      if (!error && data) {
        return {
          current: typeof data.current_data === "string" ? JSON.parse(data.current_data) : data.current_data,
          short_term_6h: typeof data.short_term_6h === "string" ? JSON.parse(data.short_term_6h) : data.short_term_6h,
          medium_term_48h: typeof data.medium_term_48h === "string" ? JSON.parse(data.medium_term_48h) : data.medium_term_48h,
          trend: data.trend ?? "stable",
          history: typeof data.history === "string" ? JSON.parse(data.history) : (data.history ?? []),
          updated_at: data.updated_at ?? new Date().toISOString(),
        };
      }
      console.warn("[data] Supabase threat_level query failed:", error?.message);
    } catch (e) {
      console.warn("[data] Supabase threat_level exception:", e);
    }
  }

  return readJSON<ThreatLevel>(path.join(DATA_DIR, "threat_level.json"), DEFAULT_THREAT_LEVEL);
}

export async function getExecutiveSummary(): Promise<ExecutiveSummaryData | null> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("executive_summary")
        .select("*")
        .eq("id", "current")
        .single();

      if (!error && data?.data) {
        const blob = typeof data.data === "string" ? JSON.parse(data.data) : data.data;
        return blob as ExecutiveSummaryData;
      }
      // No data yet or error — fall through to JSON
      if (error && error.code !== "PGRST116") {
        console.warn("[data] Supabase executive_summary query failed:", error?.message);
      }
    } catch (e) {
      console.warn("[data] Supabase executive_summary exception:", e);
    }
  }

  return readJSON<ExecutiveSummaryData | null>(
    path.join(DATA_DIR, "executive_summary.json"),
    null
  );
}

export async function getArchiveIndex(): Promise<ArchiveEntry[]> {
  // Archives are filesystem-only (not migrated to Supabase)
  return readJSON<ArchiveEntry[]>(path.join(ARCHIVE_DIR, "index.json"), []);
}

/**
 * Copy archive JSON files into public/archives/ so they are served as static assets.
 * Called at build time from data reads (server components).
 */
export function syncArchivesToPublic(): void {
  const publicArchives = path.join(process.cwd(), "public", "archives");
  if (!existsSync(ARCHIVE_DIR)) return;
  mkdirSync(publicArchives, { recursive: true });
  cpSync(ARCHIVE_DIR, publicArchives, { recursive: true });
}




