import type { ExecutiveSummaryData } from "@/lib/types";
import { THREAT_LEVEL_COLORS, SEVERITY_COLORS } from "@/lib/types";

interface ExecutiveSummaryProps {
  summary: ExecutiveSummaryData;
}

function SectionHeader({
  title,
  icon,
}: {
  title: string;
  icon: string;
}) {
  return (
    <h3
      style={{
        fontSize: 16,
        fontWeight: 700,
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span>{icon}</span> {title}
    </h3>
  );
}

function BulletList({
  items,
  color,
  muted,
}: {
  items: string[];
  color?: string;
  muted?: boolean;
}) {
  if (!items || items.length === 0) return null;
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item, i) => (
        <li
          key={i}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            fontSize: 14,
            lineHeight: 1.6,
            color: muted ? "var(--color-text-muted)" : "var(--color-text)",
            fontStyle: muted ? "italic" : "normal",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: color || "var(--color-text-muted)",
              flexShrink: 0,
              marginTop: 8,
            }}
          />
          {item}
        </li>
      ))}
    </ul>
  );
}

function ImpactCard({
  title,
  icon,
  items,
  accentColor,
}: {
  title: string;
  icon: string;
  items: string[];
  accentColor: string;
}) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: 8,
        padding: 16,
        flex: "1 1 280px",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 10,
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: accentColor,
        }}
      >
        {icon} {title}
      </div>
      <BulletList items={items} color={accentColor} />
    </div>
  );
}

export default function ExecutiveSummary({ summary }: ExecutiveSummaryProps) {
  const snap = summary.threat_snapshot;
  const levelColor =
    THREAT_LEVEL_COLORS[snap.label] || "#16a34a";
  const breakdown = snap.severity_breakdown || {};
  const generatedTime = new Date(summary.generated_at);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Status bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          padding: "14px 20px",
          background: `${levelColor}10`,
          border: `1px solid ${levelColor}30`,
          borderRadius: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: `${levelColor}25`,
              border: `2px solid ${levelColor}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 800,
              color: levelColor,
            }}
          >
            {snap.level}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: levelColor }}>
              THREAT LEVEL: {snap.label}
              {snap.trend === "escalating" && " ↑"}
              {snap.trend === "de-escalating" && " ↓"}
              {snap.trend === "stable" && " →"}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {snap.incident_count_24h} incidents (24h) · {snap.incident_count_6h} incidents (6h) · Trend: {snap.trend}
            </div>
          </div>
        </div>

        {/* Severity breakdown pills */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["major", "high", "medium", "low"] as const).map((sev) => {
            const count = breakdown[sev] || 0;
            const color = SEVERITY_COLORS[sev] || "#888";
            return (
              <span
                key={sev}
                style={{
                  background: `${color}20`,
                  border: `1px solid ${color}40`,
                  borderRadius: 6,
                  padding: "3px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  color,
                  textTransform: "capitalize",
                }}
              >
                {sev}: {count}
              </span>
            );
          })}
        </div>
      </div>

      {/* Executive Summary */}
      <section>
        <SectionHeader title="Executive Summary" icon="📋" />
        <div
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            padding: 20,
            fontSize: 15,
            lineHeight: 1.7,
            borderLeft: `3px solid ${levelColor}`,
          }}
        >
          {summary.executive_summary}
        </div>
      </section>

      {/* What's New */}
      {summary.whats_new?.length > 0 && (
        <section>
          <SectionHeader title="What's New" icon="🔔" />
          <BulletList items={summary.whats_new} color="#3b82f6" />
        </section>
      )}

      {/* Confirmed & Credibly Reported */}
      {summary.confirmed_events?.length > 0 && (
        <section>
          <SectionHeader title="Confirmed & Credibly Reported" icon="✅" />
          <BulletList items={summary.confirmed_events} color="#16a34a" />
        </section>
      )}

      {/* Unverified / Emerging */}
      {summary.unverified_emerging?.length > 0 && (
        <section>
          <SectionHeader title="Unverified / Emerging" icon="⚠️" />
          <BulletList items={summary.unverified_emerging} color="#ca8a04" muted />
        </section>
      )}

      {/* Operational Impacts */}
      {summary.operational_impacts && (
        <section>
          <SectionHeader title="Operational Impacts (Near-Term)" icon="⚙️" />
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <ImpactCard
              title="People & Travel"
              icon="✈️"
              items={summary.operational_impacts.people_travel || []}
              accentColor="#3b82f6"
            />
            <ImpactCard
              title="Supply Chain & Logistics"
              icon="🚢"
              items={summary.operational_impacts.supply_chain || []}
              accentColor="#f59e0b"
            />
            <ImpactCard
              title="Market & Macro"
              icon="📈"
              items={summary.operational_impacts.market_macro || []}
              accentColor="#ef4444"
            />
          </div>
        </section>
      )}

      {/* 24-72h Outlook */}
      {summary.outlook_24_72h && (
        <section>
          <SectionHeader title="24–72h Outlook" icon="🔮" />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Base case */}
            <div
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                padding: 16,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#3b82f6",
                  marginBottom: 8,
                }}
              >
                Base Case (High likelihood)
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                {summary.outlook_24_72h.base_case}
              </div>
            </div>

            {/* Escalation risks */}
            {summary.outlook_24_72h.escalation_risks?.length > 0 && (
              <div
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderLeft: "3px solid #ef4444",
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#ef4444",
                    marginBottom: 8,
                  }}
                >
                  Escalation Risks
                </div>
                <BulletList
                  items={summary.outlook_24_72h.escalation_risks}
                  color="#ef4444"
                />
              </div>
            )}

            {/* De-escalation pathways */}
            {summary.outlook_24_72h.de_escalation_pathways && (
              <div
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  borderLeft: "3px solid #16a34a",
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#16a34a",
                    marginBottom: 8,
                  }}
                >
                  De-escalation Pathways
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                  {summary.outlook_24_72h.de_escalation_pathways}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Footer metadata */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          padding: "12px 0",
          borderTop: "1px solid var(--color-border)",
          fontSize: 12,
          color: "var(--color-text-muted)",
        }}
      >
        <span>
          Sources: {summary.source_count.attacks_analyzed} attacks, {summary.source_count.articles_analyzed} articles from{" "}
          {summary.source_count.regions_covered.join(", ")}
        </span>
        <span>
          Generated:{" "}
          {generatedTime.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZoneName: "short",
          })}
        </span>
      </div>
    </div>
  );
}
