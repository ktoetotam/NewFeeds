import Header from "@/components/Header";
import ExecutiveSummary from "@/components/ExecutiveSummary";
import { getExecutiveSummary, getThreatLevel } from "@/lib/data";

export default function SummaryPage() {
  const summary = getExecutiveSummary();
  const threatLevel = getThreatLevel();

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
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          Executive Summary
        </h2>
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
