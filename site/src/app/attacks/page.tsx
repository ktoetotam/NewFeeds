import Header from "@/components/Header";
import AttackMonitor from "@/components/AttackMonitor";
import Link from "next/link";
import { getAttackArticles, getThreatLevel, getExecutiveSummary } from "@/lib/data";
import { THREAT_LEVEL_COLORS } from "@/lib/types";

export default function AttacksPage() {
  const attackArticles = getAttackArticles();
  const threatLevel = getThreatLevel();
  const summary = getExecutiveSummary();

  const tlLevel = threatLevel.current;
  const tlColor = tlLevel ? (THREAT_LEVEL_COLORS[tlLevel.label] || "#16a34a") : "#16a34a";

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
          padding: "24px 24px 48px",
        }}
      >
        {/* Cross-nav cards */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
          {/* News Feed card */}
          <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
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
              <span style={{ fontSize: 18, fontWeight: 700 }}>📰 News Feed</span>
              <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                Live articles from all monitored regions, translated and relevance-filtered.
              </div>
              <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: "#3b82f6" }}>
                Go to News Feed →
              </div>
            </div>
          </Link>

          {/* Executive Summary card */}
          <Link href="/summary" style={{ textDecoration: "none", color: "inherit" }}>
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
                <span style={{ fontSize: 18, fontWeight: 700 }}>📋 Executive Summary</span>
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
              <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: "#3b82f6" }}>
                Read Executive Summary →
              </div>
            </div>
          </Link>
        </section>

        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 20,
          }}
        >
          Attack Monitor
        </h2>
        <AttackMonitor
          attackArticles={attackArticles}
          threatLevel={threatLevel}
        />
      </main>
    </>
  );
}
