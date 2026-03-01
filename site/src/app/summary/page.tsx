import Header from "@/components/Header";
import ExecutiveSummary from "@/components/ExecutiveSummary";
import { getExecutiveSummary, getThreatLevel, getArchiveIndex, getAttackArticles } from "@/lib/data";
import Link from "next/link";
import { THREAT_LEVEL_COLORS } from "@/lib/types";

export default function SummaryPage() {
  const summary = getExecutiveSummary();
  const threatLevel = getThreatLevel();
  const archiveCount = getArchiveIndex().length;
  const attacks = getAttackArticles();

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
          maxWidth: 1000,
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

          {/* Attack Monitor card */}
          <Link href="/attacks" style={{ textDecoration: "none", color: "inherit" }}>
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
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 18, fontWeight: 700 }}>🎯 Attack Monitor</span>
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
              <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: tlColor }}>
                View Attack Monitor →
              </div>
            </div>
          </Link>
        </section>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 6,
          }}
        >
          <h2
            style={{
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            Executive Summary
          </h2>
          {archiveCount > 0 && (
            <Link
              href="/summary/archives"
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--color-text-muted)",
                textDecoration: "none",
                padding: "6px 14px",
                border: "1px solid var(--color-border)",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              🗄️ Archives ({archiveCount})
            </Link>
          )}
        </div>
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-muted)",
            marginBottom: 24,
          }}
        >
          Iran–US–Israel Escalation — Auto-generated situational briefing
        </p>

        {summary ? (
          <ExecutiveSummary summary={summary} />
        ) : (
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              padding: 40,
              textAlign: "center",
              color: "var(--color-text-muted)",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              No Executive Summary Available
            </div>
            <div style={{ fontSize: 14 }}>
              The summary will be generated automatically on the next pipeline
              run when attack and feed data are available.
            </div>
          </div>
        )}
      </main>
    </>
  );
}
