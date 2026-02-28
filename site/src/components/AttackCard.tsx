import type { Article } from "@/lib/types";
import { REGIONS, SEVERITY_COLORS } from "@/lib/types";
import { formatTimeAgo } from "@/lib/utils";

interface AttackCardProps {
  article: Article;
}

export default function AttackCard({ article }: AttackCardProps) {
  const classification = article.classification;
  if (!classification) return null;

  const regionCfg = REGIONS.find((r) => r.key === article.region);
  const regionColor = regionCfg?.color || "#6366f1";
  const severityColor = SEVERITY_COLORS[classification.severity] || "#16a34a";

  const categoryIcons: Record<string, string> = {
    airstrike: "💥",
    missile_attack: "🚀",
    drone_strike: "🛩️",
    ground_operation: "⚔️",
    naval_incident: "🚢",
    cyber_attack: "💻",
    nuclear_development: "☢️",
    threat_statement: "⚠️",
    escalation: "📈",
    military_deployment: "🎯",
    ceasefire_violation: "🏳️",
    sanctions: "🚫",
    other: "📋",
  };

  const icon = categoryIcons[classification.category] || "📋";

  return (
    <article
      style={{
        background: "var(--color-surface)",
        border: `1px solid ${severityColor}40`,
        borderLeft: `4px solid ${severityColor}`,
        borderRadius: 10,
        padding: 16,
      }}
    >
      {/* Top row: severity + category + source + time */}
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
          {/* Severity badge */}
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 4,
              background: `${severityColor}20`,
              color: severityColor,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {classification.severity}
          </span>

          {/* Category */}
          <span style={{ fontSize: 13 }}>
            {icon}{" "}
            {classification.category.replace(/_/g, " ")}
          </span>

          {/* Region */}
          <span
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 4,
              background: `${regionColor}20`,
              color: regionColor,
              fontWeight: 600,
            }}
          >
            {regionCfg?.label || article.region}
          </span>

          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            {article.source_name}
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

      {/* English headline */}
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--color-text)" }}
        >
          {article.title_en || article.title_original}
        </a>
      </h3>

      {/* Brief military significance */}
      {classification.brief && (
        <p
          style={{
            fontSize: 14,
            color: severityColor,
            fontWeight: 500,
            marginBottom: 6,
          }}
        >
          {classification.brief}
        </p>
      )}

      {/* Summary */}
      {article.summary_en && (
        <p
          style={{
            fontSize: 14,
            color: "var(--color-text-muted)",
            lineHeight: 1.6,
            marginBottom: 8,
          }}
        >
          {article.summary_en}
        </p>
      )}

      {/* Tags: parties + location */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {classification.location && classification.location !== "Unknown" && (
          <span
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 4,
              background: "var(--color-border)",
              color: "var(--color-text-muted)",
            }}
          >
            📍 {classification.location}
          </span>
        )}
        {classification.parties_involved?.map((party) => (
          <span
            key={party}
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 4,
              background: "var(--color-border)",
              color: "var(--color-text-muted)",
            }}
          >
            {party}
          </span>
        ))}
      </div>
    </article>
  );
}
