"use client";

import Link from "next/link";
import Header from "@/components/Header";
import AttackMonitor from "@/components/AttackMonitor";
import NavCards from "@/components/NavCards";
import {
  useAttackArticles,
  useThreatLevel,
  useExecutiveSummary,
} from "@/lib/hooks";
import { THREAT_LEVEL_COLORS } from "@/lib/types";

export default function AttacksClient() {
  const { attacks, loading: attacksLoading } = useAttackArticles();
  const { threatLevel, loading: threatLoading } = useThreatLevel();
  const { summary } = useExecutiveSummary();

  const loading = attacksLoading || threatLoading;

  const tlLevel = threatLevel.current;
  const tlColor = tlLevel
    ? THREAT_LEVEL_COLORS[tlLevel.label] || "#16a34a"
    : "#16a34a";

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
        <NavCards />

        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>
          Attack Monitor
        </h2>
        <AttackMonitor attackArticles={attacks} threatLevel={threatLevel} />
      </main>
    </>
  );
}
