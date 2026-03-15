"use client";

import { useMemo } from "react";
import Link from "next/link";
import NavCards from "@/components/NavCards";
import Header from "@/components/Header";
import NewsFeed from "@/components/NewsFeed";
import HomeAttackMap from "@/components/HomeAttackMap";
import {
  useArticlesByRegion,
  useAttackArticles,
  useThreatLevel,
  useExecutiveSummary,
} from "@/lib/hooks";
import { THREAT_LEVEL_COLORS } from "@/lib/types";

export default function HomeClient() {
  const { articlesByRegion, loading: articlesLoading } = useArticlesByRegion();
  const { attacks, loading: attacksLoading } = useAttackArticles();
  const { threatLevel, loading: threatLoading } = useThreatLevel();
  const { summary } = useExecutiveSummary();

  const loading = articlesLoading || attacksLoading || threatLoading;

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
        <main style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 24px 48px" }}>
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
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 24px 48px" }}>
        {/* Nav cards */}
        <NavCards />

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
            <span style={{ fontSize: 13, fontWeight: 400, color: "var(--color-text-muted)" }}>
              — last {attacks.length} incidents
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
