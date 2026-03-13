"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import ExecutiveSummary from "@/components/ExecutiveSummary";
import {
  useAttackArticles,
  useThreatLevel,
  useExecutiveSummary,
} from "@/lib/hooks";
import { THREAT_LEVEL_COLORS } from "@/lib/types";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export default function SummaryClient() {
  const { attacks } = useAttackArticles();
  const { threatLevel, loading: threatLoading } = useThreatLevel();
  const { summary, loading: summaryLoading } = useExecutiveSummary();
  const [downloadLoading, setDownloadLoading] = useState(false);

  const loading = threatLoading || summaryLoading;

  async function handleDownloadAll() {
    setDownloadLoading(true);
    try {
      const sb = getSupabaseBrowser();
      if (!sb) { alert("Supabase client unavailable."); return; }
      const { data, error } = await sb
        .from("summary_archive")
        .select("*")
        .order("generated_at", { ascending: true });
      if (error || !data?.length) {
        alert(error ? `Error: ${error.message}` : "No archived summaries found yet.");
        return;
      }
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      data.forEach((row: { generated_at: string; data: unknown }) => {
        const ts = row.generated_at.replace(/[:.]/g, "-").slice(0, 19);
        zip.file(`summary_${ts}.json`, JSON.stringify(row.data, null, 2));
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "executive_summaries.zip";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadLoading(false);
    }
  }

  const tlLevel = threatLevel.current;
  const tlColor = tlLevel
    ? THREAT_LEVEL_COLORS[tlLevel.label] || "#16a34a"
    : "#16a34a";
  const severityBreakdown = tlLevel?.severity_breakdown;
  const majorCount = severityBreakdown?.major ?? 0;
  const highCount = severityBreakdown?.high ?? 0;

  if (loading) {
    return (
      <>
        <Header threatLevel={threatLevel} updatedAt={threatLevel.updated_at} />
        <main style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 24px 48px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: 300,
              color: "var(--color-text-muted)",
              fontSize: 16,
            }}
          >
            Loading live data…
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header threatLevel={threatLevel} updatedAt={threatLevel.updated_at} />
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 24px 48px" }}>
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
              <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600, color: "#6a4c93" }}>
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
                    color: "#fef6f0",
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
                {attacks.length} incidents tracked.
                {majorCount + highCount > 0 && (
                  <>
                    {" "}
                    <strong style={{ color: "#f68a6b" }}>
                      {majorCount + highCount} major/high
                    </strong>{" "}
                    in last 48h.
                  </>
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
          <h2 style={{ fontSize: 24, fontWeight: 700 }}>Executive Summary</h2>
          <button
            onClick={handleDownloadAll}
            disabled={downloadLoading}
            style={{
              background: downloadLoading ? "var(--color-border)" : "var(--color-surface)",
              border: "1.5px solid var(--color-border)",
              borderRadius: 8,
              padding: "7px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: downloadLoading ? "not-allowed" : "pointer",
              color: downloadLoading ? "var(--color-text-muted)" : "var(--color-text)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
            }}
          >
            {downloadLoading ? "Preparing…" : "⬇ Download All"}
          </button>
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
