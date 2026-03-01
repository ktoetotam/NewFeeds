import Header from "@/components/Header";
import NewsFeed from "@/components/NewsFeed";
import Link from "next/link";
import {
  getArticlesByRegion,
  getAttackArticles,
  getThreatLevel,
  getExecutiveSummary,
} from "@/lib/data";
import type { RegionKey } from "@/lib/types";
import { REGIONS, THREAT_LEVEL_COLORS } from "@/lib/types";
import HomeAttackMap from "@/components/HomeAttackMap";

export default function HomePage() {
  const regions: RegionKey[] = REGIONS.map((r) => r.key);
  const articlesByRegion: Record<string, ReturnType<typeof getArticlesByRegion>> = {};

  for (const region of regions) {
    articlesByRegion[region] = getArticlesByRegion(region);
  }

  const threatLevel = getThreatLevel();
  const attacks = getAttackArticles();
  const summary = getExecutiveSummary();

  const tlLevel = threatLevel.current;
  const tlColor = tlLevel ? (THREAT_LEVEL_COLORS[tlLevel.label] || "#16a34a") : "#16a34a";

  const severityBreakdown = tlLevel?.severity_breakdown;
  const majorCount = severityBreakdown?.major ?? 0;
  const highCount = severityBreakdown?.high ?? 0;

  return (
    <>
      <Header
        threatLevel={threatLevel}
        updatedAt={threatLevel.updated_at}
      />
      <main
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "0 24px 48px",
        }}
      >
        {/* Prominent nav cards */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 16,
            margin: "24px 0 32px",
          }}
        >
          {/* Attack Monitor card */}
          <Link
            href="/attacks"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div
              style={{
                background: "var(--color-surface)",
                border: `2px solid ${tlColor}`,
                borderRadius: 12,
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                cursor: "pointer",
                transition: "box-shadow 0.15s",
                boxShadow: `0 0 0 0 ${tlColor}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  🎯 Attack Monitor
                </span>
                <span
                  style={{
                    background: tlColor,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 99,
                    letterSpacing: 0.5,
                  }}
                >
                  {tlLevel?.label ?? "—"}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                {attacks.length} classified incidents tracked.
                {majorCount + highCount > 0 && (
                  <> <strong style={{ color: "#ef4444" }}>{majorCount + highCount} major/high</strong> in last 48h.</>
                )}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  color: tlColor,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                View Attack Monitor →
              </div>
            </div>
          </Link>

          {/* Executive Summary card */}
          <Link
            href="/summary"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div
              style={{
                background: "var(--color-surface)",
                border: "2px solid var(--color-border)",
                borderRadius: 12,
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  📋 Executive Summary
                </span>
                {summary?.generated_at && (
                  <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                    {new Date(summary.generated_at).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "UTC",
                    })} UTC
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--color-text-muted)",
                  lineHeight: 1.5,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {summary?.executive_summary
                  ? summary.executive_summary
                  : "AI-generated intelligence briefing covering regional threat assessments, key incidents, and escalation risks."}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#3b82f6",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                Read Executive Summary →
              </div>
            </div>
          </Link>
        </section>

        {/* Attack Map */}
        <section style={{ marginBottom: 40 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            🗺️ Attack Events Map
            <span
              style={{
                fontSize: 13,
                fontWeight: 400,
                color: "var(--color-text-muted)",
              }}
            >
              — last {attacks.length} classified incidents
            </span>
          </h2>
          <HomeAttackMap attacks={attacks} />
          {/* Legend */}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 10,
              flexWrap: "wrap",
              fontSize: 12,
              color: "var(--color-text-muted)",
            }}
          >
            {[
              { label: "Major", color: "#ef4444" },
              { label: "High", color: "#f97316" },
              { label: "Medium", color: "#eab308" },
              { label: "Low", color: "#22c55e" },
            ].map(({ label, color }) => (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: color,
                    display: "inline-block",
                  }}
                />
                {label}
              </span>
            ))}
          </div>
        </section>

        <NewsFeed articlesByRegion={articlesByRegion} />
      </main>
    </>
  );
}
