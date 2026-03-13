"use client";

import type { Article } from "@/lib/types";
import { REGIONS } from "@/lib/types";
import { formatTimeAgo, formatFetchedAt } from "@/lib/utils";

interface NewsCardProps {
  article: Article;
  searchQuery?: string;
}

/**
 * If summary_en or title_en contains raw JSON from the LLM
 * (e.g. '{"h":"...","s":"...","r":true}'), extract the readable text.
 */
function cleanLLMField(value: string | undefined, field: "h" | "s"): string {
  if (!value) return "";
  const trimmed = value.trim();
  // Not JSON-like — return as-is
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  // Try full JSON parse first
  try {
    const obj = JSON.parse(trimmed);
    if (obj && typeof obj === "object" && obj[field]) return obj[field];
  } catch {
    // Truncated JSON — extract with regex
  }
  // Regex fallback for truncated JSON
  const regex = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"?`);
  const m = trimmed.match(regex);
  if (m?.[1]) return m[1].replace(/\\"/g, '"').replace(/\\n/g, " ");
  return ""; // Unrecoverable — hide rather than show raw JSON
}

function HighlightText({ text, query }: { text: string; query?: string }) {
  if (!query || !text || query.trim().length < 2) return <>{text}</>;
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return <>{text}</>;
  // Build regex matching any search word
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);
  // split with a capture group produces alternating [non-match, match, non-match, ...]
  // so odd-indexed parts are always matches — avoids stateful regex.test() bug with /g flag
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            style={{
              background: "#f68a6b40",
              color: "inherit",
              borderRadius: 2,
              padding: "0 1px",
            }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function NewsCard({ article, searchQuery }: NewsCardProps) {
  const regionCfg = REGIONS.find((r) => r.key === article.region);
  const regionColor = regionCfg?.color || "#f68a6b";

  const categoryLabels: Record<string, string> = {
    state: "State",
    "state-aligned": "State-aligned",
    proxy: "Proxy",
  };

  return (
    <article
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        padding: 16,
        transition: "background 0.15s",
      }}
    >
      {/* Top row: source info + timestamp */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Region badge */}
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 4,
              background: `${regionColor}20`,
              color: regionColor,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {regionCfg?.label || article.region}
          </span>

          {/* Source name */}
          <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
            {article.source_name}
          </span>

          {/* Category */}
          <span
            style={{
              fontSize: 11,
              padding: "2px 6px",
              borderRadius: 4,
              background: "var(--color-border)",
              color: "var(--color-text-muted)",
            }}
          >
            {categoryLabels[article.source_category] || article.source_category}
          </span>
        </div>

        <span
          style={{
            fontSize: 12,
            color: "var(--color-text-muted)",
            whiteSpace: "nowrap",
          }}
          suppressHydrationWarning
        >
          {formatTimeAgo(article.published, article.fetched_at)}
          {article.fetched_at && (
            <span style={{ opacity: 0.6 }} suppressHydrationWarning>
              {" · "}{formatFetchedAt(article.fetched_at)}
            </span>
          )}
        </span>
      </div>

      {/* Original headline */}
      <div
        style={{
          fontSize: 13,
          color: "var(--color-text-muted)",
          marginBottom: 4,
          direction: ["ar", "fa", "he"].includes(article.language)
            ? "rtl"
            : "ltr",
          fontStyle: "italic",
        }}
      >
        {article.title_original}
      </div>

      {/* English headline */}
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--color-text)" }}
        >
          <HighlightText text={cleanLLMField(article.title_en, "h") || article.title_original} query={searchQuery} />
        </a>
      </h3>

      {/* English summary */}
      {article.summary_en && (() => {
        const cleaned = cleanLLMField(article.summary_en, "s");
        return cleaned ? (
          <p
            style={{
              fontSize: 14,
              color: "var(--color-text-muted)",
              lineHeight: 1.6,
            }}
          >
            <HighlightText text={cleaned} query={searchQuery} />
          </p>
        ) : null;
      })()}

      {/* Language tag */}
      <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
        <span
          style={{
            fontSize: 11,
            padding: "1px 6px",
            borderRadius: 4,
            border: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
          }}
        >
          {article.language.toUpperCase()}
        </span>


      </div>
    </article>
  );
}
