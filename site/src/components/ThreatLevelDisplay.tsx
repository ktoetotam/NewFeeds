import type { ThreatLevel } from "@/lib/types";
import { THREAT_LEVEL_COLORS } from "@/lib/types";

interface ThreatLevelDisplayProps {
  threatLevel: ThreatLevel;
}

export default function ThreatLevelDisplay({
  threatLevel,
}: ThreatLevelDisplayProps) {
  const current = threatLevel.current;
  const color = THREAT_LEVEL_COLORS[current.label] || "#16a34a";
  const breakdown = current.severity_breakdown || {};

  const trendLabel =
    threatLevel.trend === "escalating"
      ? "↑ Escalating"
      : threatLevel.trend === "de-escalating"
        ? "↓ De-escalating"
        : "→ Stable";

  const trendColor =
    threatLevel.trend === "escalating"
      ? "#ef4444"
      : threatLevel.trend === "de-escalating"
        ? "#16a34a"
        : "#8888a0";

  // 7-day history chart (sparkline)
  const historyScores = threatLevel.history.map((h) => h.score);
  const maxScore = Math.max(...historyScores, 1);

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: `2px solid ${color}60`,
        borderRadius: 12,
        padding: 24,
        marginBottom: 24,
      }}
    >
      {/* Main threat gauge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        {/* Level circle */}
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            border: `4px solid ${color}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: `${color}15`,
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>
            {current.level}
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color, letterSpacing: 1 }}>
            LEVEL
          </div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color,
              letterSpacing: 1,
              marginBottom: 4,
            }}
          >
            {current.label}
          </div>
          <div
            style={{
              fontSize: 14,
              color: "var(--color-text-muted)",
              marginBottom: 8,
            }}
          >
            {current.incident_count} incident
            {current.incident_count !== 1 ? "s" : ""} in the last 24 hours •
            Score: {current.score}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: trendColor, fontWeight: 600 }}>
              {trendLabel}
            </span>
            <span
              style={{ fontSize: 13, color: "var(--color-text-muted)" }}
            >
              6h: {threatLevel.short_term_6h.label} ({threatLevel.short_term_6h.incident_count})
            </span>
            <span
              style={{ fontSize: 13, color: "var(--color-text-muted)" }}
            >
              48h: {threatLevel.medium_term_48h.label} ({threatLevel.medium_term_48h.incident_count})
            </span>
          </div>
        </div>

        {/* Severity breakdown */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 8,
            fontSize: 13,
          }}
        >
          {(["critical", "high", "medium", "low"] as const).map((sev) => (
            <div
              key={sev}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                background: `${
                  sev === "critical"
                    ? "#dc2626"
                    : sev === "high"
                      ? "#ea580c"
                      : sev === "medium"
                        ? "#ca8a04"
                        : "#16a34a"
                }15`,
                color:
                  sev === "critical"
                    ? "#dc2626"
                    : sev === "high"
                      ? "#ea580c"
                      : sev === "medium"
                        ? "#ca8a04"
                        : "#16a34a",
                fontWeight: 600,
              }}
            >
              {sev}: {breakdown[sev] || 0}
            </div>
          ))}
        </div>
      </div>

      {/* History sparkline */}
      {historyScores.length > 1 && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
          <div
            style={{
              fontSize: 12,
              color: "var(--color-text-muted)",
              marginBottom: 8,
            }}
          >
            7-Day Threat Score History
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 1,
              height: 40,
            }}
          >
            {historyScores.slice(-168).map((score, i) => {
              const height = Math.max(2, (score / maxScore) * 40);
              const barColor =
                score >= 30
                  ? "#dc2626"
                  : score >= 15
                    ? "#ea580c"
                    : score >= 6
                      ? "#ca8a04"
                      : score >= 2
                        ? "#2563eb"
                        : "#16a34a";
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height,
                    background: barColor,
                    borderRadius: 1,
                    opacity: 0.8,
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
