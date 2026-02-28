"use client";

import { useState } from "react";
import type { Article, ThreatLevel } from "@/lib/types";
import ThreatLevelDisplay from "./ThreatLevelDisplay";
import AttackCard from "./AttackCard";

interface AttackMonitorProps {
  attackArticles: Article[];
  threatLevel: ThreatLevel;
}

type SeverityFilter = "all" | "critical" | "high" | "medium" | "low";

export default function AttackMonitor({
  attackArticles,
  threatLevel,
}: AttackMonitorProps) {
  const [severityFilter, setSeverityFilter] =
    useState<SeverityFilter>("all");

  const filtered =
    severityFilter === "all"
      ? attackArticles
      : attackArticles.filter(
          (a) => a.classification?.severity === severityFilter
        );

  const severityCounts = {
    all: attackArticles.length,
    critical: attackArticles.filter(
      (a) => a.classification?.severity === "critical"
    ).length,
    high: attackArticles.filter(
      (a) => a.classification?.severity === "high"
    ).length,
    medium: attackArticles.filter(
      (a) => a.classification?.severity === "medium"
    ).length,
    low: attackArticles.filter(
      (a) => a.classification?.severity === "low"
    ).length,
  };

  const severityColors: Record<SeverityFilter, string> = {
    all: "#6366f1",
    critical: "#dc2626",
    high: "#ea580c",
    medium: "#ca8a04",
    low: "#16a34a",
  };

  return (
    <div>
      <ThreatLevelDisplay threatLevel={threatLevel} />

      {/* Severity filter tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {(
          ["all", "critical", "high", "medium", "low"] as SeverityFilter[]
        ).map((sev) => (
          <button
            key={sev}
            onClick={() => setSeverityFilter(sev)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border:
                severityFilter === sev
                  ? `1px solid ${severityColors[sev]}60`
                  : "1px solid var(--color-border)",
              background:
                severityFilter === sev
                  ? `${severityColors[sev]}15`
                  : "transparent",
              color:
                severityFilter === sev
                  ? severityColors[sev]
                  : "var(--color-text-muted)",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: severityFilter === sev ? 600 : 400,
              display: "flex",
              alignItems: "center",
              gap: 6,
              textTransform: "capitalize",
            }}
          >
            {sev}
            <span
              style={{
                fontSize: 11,
                background:
                  severityFilter === sev
                    ? `${severityColors[sev]}30`
                    : "var(--color-border)",
                padding: "2px 6px",
                borderRadius: 10,
              }}
            >
              {severityCounts[sev]}
            </span>
          </button>
        ))}
      </div>

      {/* Attack articles list */}
      <div style={{ display: "grid", gap: 12 }}>
        {filtered.length > 0 ? (
          filtered.map((article) => (
            <AttackCard key={article.id} article={article} />
          ))
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: 48,
              color: "var(--color-text-muted)",
            }}
          >
            {attackArticles.length === 0
              ? "No attack-related articles detected. Run the pipeline to fetch and classify news."
              : `No ${severityFilter}-severity incidents found.`}
          </div>
        )}
      </div>
    </div>
  );
}
