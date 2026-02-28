import type { Article } from "@/lib/types";
import { REGIONS } from "@/lib/types";
import { formatTimeAgo } from "@/lib/utils";

interface NewsCardProps {
  article: Article;
}

export default function NewsCard({ article }: NewsCardProps) {
  const regionCfg = REGIONS.find((r) => r.key === article.region);
  const regionColor = regionCfg?.color || "#6366f1";

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
        >
          {formatTimeAgo(article.published)}
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
          {article.title_en || article.title_original}
        </a>
      </h3>

      {/* English summary */}
      {article.summary_en && (
        <p
          style={{
            fontSize: 14,
            color: "var(--color-text-muted)",
            lineHeight: 1.6,
          }}
        >
          {article.summary_en}
        </p>
      )}

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
        {!article.translated && (
          <span
            style={{
              fontSize: 11,
              padding: "1px 6px",
              borderRadius: 4,
              background: "#ca8a0420",
              color: "#ca8a04",
            }}
          >
            Translation pending
          </span>
        )}
        {article.relevant === true && (
          <span
            style={{
              fontSize: 11,
              padding: "1px 6px",
              borderRadius: 4,
              background: "#16a34a20",
              color: "#16a34a",
              fontWeight: 600,
            }}
          >
            Relevant
          </span>
        )}
        {article.relevant === false && (
          <span
            style={{
              fontSize: 11,
              padding: "1px 6px",
              borderRadius: 4,
              background: "var(--color-border)",
              color: "var(--color-text-muted)",
            }}
          >
            Not relevant
          </span>
        )}
      </div>
    </article>
  );
}
