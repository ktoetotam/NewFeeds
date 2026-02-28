"use client";

import { useState, useRef, useCallback, useMemo, createRef } from "react";
import type { Article, ThreatLevel } from "@/lib/types";
import ThreatLevelDisplay from "./ThreatLevelDisplay";
import AttackCard from "./AttackCard";
import AttackMapClient from "./AttackMapClient";
import type { NumberedAttack } from "./AttackMap";

interface AttackMonitorProps {
  attackArticles: Article[];
  threatLevel: ThreatLevel;
}

type SeverityFilter = "all" | "major" | "high" | "medium" | "low";

export default function AttackMonitor({
  attackArticles,
  threatLevel,
}: AttackMonitorProps) {
  const [severityFilter, setSeverityFilter] =
    useState<SeverityFilter>("all");
  const [selectedAttackId, setSelectedAttackId] = useState<string | null>(null);

  const filtered =
    severityFilter === "all"
      ? attackArticles
      : attackArticles.filter(
          (a) => a.classification?.severity === severityFilter
        );

  // Build numberedAttacks: every attack gets a sequential number so the list is never missing badges.
  // Attacks with coordinates will also appear on the map with the same number.
  const numberedAttacks: NumberedAttack[] = useMemo(() => {
    return filtered.map((a, i) => ({ attack: a, index: i + 1 }));
  }, [filtered]);

  // Subset that actually appears on the map (has coordinates)
  const mappedAttacks = useMemo(
    () =>
      numberedAttacks.filter(
        (na) => na.attack.lat != null && na.attack.lng != null
      ),
    [numberedAttacks]
  );

  // Refs for each card to scroll into view
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  const handleSelectFromMap = useCallback((id: string) => {
    setSelectedAttackId(id);
    // Scroll the card into view
    const el = cardRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const mapRef = useRef<HTMLDivElement>(null);

  const handleSelectFromList = useCallback((id: string) => {
    setSelectedAttackId((prev) => (prev === id ? null : id));
  }, []);

  const handleCircleClick = useCallback((id: string) => {
    setSelectedAttackId(id);
    // Scroll up to the map
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const severityCounts = {
    all: attackArticles.length,
    major: attackArticles.filter(
      (a) => a.classification?.severity === "major"
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
    major: "#dc2626",
    high: "#ea580c",
    medium: "#ca8a04",
    low: "#16a34a",
  };

  return (
    <div>
      <ThreatLevelDisplay threatLevel={threatLevel} />

      {/* Map */}
      <div ref={mapRef} style={{ marginBottom: 20 }}>
        <AttackMapClient
          numberedAttacks={mappedAttacks}
          selectedId={selectedAttackId}
          onSelectAttack={handleSelectFromMap}
          onScrollToCard={handleSelectFromMap}
        />
      </div>

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
          ["all", "major", "high", "medium", "low"] as SeverityFilter[]
        ).map((sev) => (
          <button
            key={sev}
            onClick={() => {
              setSeverityFilter(sev);
              setSelectedAttackId(null);
            }}
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
          numberedAttacks.map((na) => (
            <AttackCard
              key={na.attack.id}
              ref={(el: HTMLElement | null) => {
                if (el) cardRefs.current.set(na.attack.id, el);
                else cardRefs.current.delete(na.attack.id);
              }}
              article={na.attack}
              index={na.index}
              isSelected={na.attack.id === selectedAttackId}
              onSelect={() => handleSelectFromList(na.attack.id)}
              onCircleClick={
                na.attack.lat != null && na.attack.lng != null
                  ? () => handleCircleClick(na.attack.id)
                  : undefined
              }
            />
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
