export interface Article {
  id: string;
  title_original: string;
  title_en: string;
  content_original: string;
  summary_en: string;
  url: string;
  published: string;
  fetched_at?: string;
  source_name: string;
  source_category: "state" | "state-aligned" | "proxy" | "unknown";
  language: string;
  region: string;
  translated: boolean;
  relevant?: boolean;
  skip_translation?: boolean;
  lat?: number;
  lng?: number;
  // Attack classification (only on attack articles)
  keyword_matches?: number;
  matched_keywords?: string[];
  classification?: AttackClassification;
}

export interface AttackClassification {
  is_attack: boolean;
  category: string;
  severity: "major" | "high" | "medium" | "low";
  parties_involved: string[];
  location: string;
  brief: string;
}

export interface ThreatWindow {
  score: number;
  level: number;
  label: string;
  incident_count: number;
  color?: string;
  severity_breakdown?: Record<string, number>;
  window_hours?: number;
  computed_at?: string;
}

export interface ThreatHistoryEntry {
  timestamp: string;
  level: number;
  label: string;
  score: number;
  incident_count: number;
}

export interface ThreatLevel {
  current: ThreatWindow;
  short_term_6h: ThreatWindow;
  medium_term_48h: ThreatWindow;
  trend: "escalating" | "de-escalating" | "stable";
  history: ThreatHistoryEntry[];
  updated_at: string;
}

export type RegionKey = "iran" | "russia" | "israel" | "gulf" | "proxies" | "middle_east" | "china" | "turkey" | "south_asia" | "western";

export interface RegionConfig {
  key: RegionKey;
  label: string;
  color: string;
}

export const REGIONS: RegionConfig[] = [
  { key: "iran", label: "Iran", color: "#10b981" },
  { key: "russia", label: "Russia", color: "#3b82f6" },
  { key: "israel", label: "Israel", color: "#a855f7" },
  { key: "gulf", label: "Gulf States", color: "#f59e0b" },
  { key: "proxies", label: "Proxy Actors", color: "#ef4444" },
  { key: "middle_east", label: "Middle East", color: "#f97316" },
  { key: "china", label: "China", color: "#e11d48" },
  { key: "turkey", label: "Turkey", color: "#0ea5e9" },
  { key: "south_asia", label: "South Asia", color: "#8b5cf6" },
  { key: "western", label: "Western", color: "#6366f1" },
];

export const SEVERITY_COLORS: Record<string, string> = {
  major: "#dc2626",
  high: "#ea580c",
  medium: "#ca8a04",
  low: "#16a34a",
};

export const THREAT_LEVEL_COLORS: Record<string, string> = {
  MAJOR: "#dc2626",
  HIGH: "#ea580c",
  ELEVATED: "#ca8a04",
  GUARDED: "#2563eb",
  LOW: "#16a34a",
};

export interface ExecutiveSummaryData {
  generated_at: string;
  threat_snapshot: {
    level: number;
    label: string;
    color: string;
    trend: "escalating" | "de-escalating" | "stable";
    incident_count_24h: number;
    incident_count_6h: number;
    severity_breakdown: Record<string, number>;
  };
  source_count: {
    attacks_analyzed: number;
    articles_analyzed: number;
    regions_covered: string[];
  };
  executive_summary: string;
  whats_new: string[];
  confirmed_events: string[];
  unverified_emerging: string[];
  operational_impacts: {
    people_travel: string[];
    supply_chain: string[];
    market_macro: string[];
  };
  outlook_24_72h: {
    base_case: string;
    escalation_risks: string[];
    de_escalation_pathways: string;
  };
}

export interface ArchiveEntry {
  filename: string;
  generated_at: string;
  threat_label: string;
  threat_level: number;
  trend: "escalating" | "de-escalating" | "stable";
  incident_count_24h: number;
  summary_preview: string;
}
