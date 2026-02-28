import "server-only";
import fs from "fs";
import path from "path";
import type { Article, ThreatLevel, RegionKey, ExecutiveSummaryData, ArchiveEntry } from "./types";
import { REGIONS } from "./types";
import { cpSync, existsSync, mkdirSync } from "fs";

const DATA_DIR = path.join(process.cwd(), "..", "data");
const FEEDS_DIR = path.join(DATA_DIR, "feeds");
const ARCHIVE_DIR = path.join(DATA_DIR, "summary_archive");

function readJSON<T>(filePath: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getArticlesByRegion(region: RegionKey): Article[] {
  const raw = readJSON<Article[]>(path.join(FEEDS_DIR, `${region}.json`), []);
  // Filter out articles marked as irrelevant by the title-relevance filter
  return raw.filter((a) => a.relevant !== false);
}

export function getAllArticles(): Article[] {
  const regions: RegionKey[] = REGIONS.map((r) => r.key);
  const all: Article[] = [];
  for (const region of regions) {
    all.push(...getArticlesByRegion(region));
  }
  // Sort by published date, newest first
  all.sort((a, b) => {
    const da = new Date(a.published).getTime() || 0;
    const db = new Date(b.published).getTime() || 0;
    return db - da;
  });
  return all;
}

export function getAttackArticles(): Article[] {
  return readJSON<Article[]>(path.join(DATA_DIR, "attacks.json"), []);
}

export function getThreatLevel(): ThreatLevel {
  return readJSON<ThreatLevel>(path.join(DATA_DIR, "threat_level.json"), {
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
  });
}

export function getExecutiveSummary(): ExecutiveSummaryData | null {
  return readJSON<ExecutiveSummaryData | null>(
    path.join(DATA_DIR, "executive_summary.json"),
    null
  );
}

export function getArchiveIndex(): ArchiveEntry[] {
  return readJSON<ArchiveEntry[]>(
    path.join(ARCHIVE_DIR, "index.json"),
    []
  );
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




