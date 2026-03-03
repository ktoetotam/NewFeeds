"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type { Article, ThreatLevel } from "@/lib/types";
import ThreatLevelDisplay from "./ThreatLevelDisplay";
import AttackCard from "./AttackCard";
import AttackMapClient from "./AttackMapClient";
import type { NumberedAttack } from "./AttackMap";
import { useAttackArticles, useThreatLevel } from "@/lib/hooks";
import TimeRangeFilter, { type TimeRange } from "@/components/TimeRangeFilter";
import CountryFilter from "./CountryFilter";

interface AttackMonitorProps {
  attackArticles: Article[];
  threatLevel: ThreatLevel;
}

type SeverityFilter = "all" | "major" | "high" | "medium" | "low";

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    // Clear instantly when value is emptied (no delay)
    if (!value.trim()) {
      setDebounced(value);
      return;
    }
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function AttackMonitor({
  attackArticles: initialAttacks,
  threatLevel: initialThreatLevel,
}: AttackMonitorProps) {
  // Hydrate with live Supabase data after initial SSR render
  const { attacks: liveAttacks } = useAttackArticles();
  const { threatLevel: liveThreatLevel } = useThreatLevel();

  const attackArticles = liveAttacks.length > 0 ? liveAttacks : initialAttacks;
  const threatLevel = liveThreatLevel ?? initialThreatLevel;

  const [severityFilter, setSeverityFilter] =
    useState<SeverityFilter>("all");
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedAttackId, setSelectedAttackId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>(() => ({
    from: null,
    to: null,
  }));
  const debouncedQuery = useDebounce(searchQuery, 250);

  const searchWords = useMemo(
    () => debouncedQuery.toLowerCase().split(/\s+/).filter(Boolean),
    [debouncedQuery]
  );

  function effectiveTime(a: Article): number {
    const now = Date.now();
    const pub = new Date(a.published).getTime();
    if (!isNaN(pub) && pub <= now) return pub;
    const fetched = a.fetched_at ? new Date(a.fetched_at).getTime() : NaN;
    if (!isNaN(fetched)) return fetched;
    return 0;
  }

  const timeFiltered = useMemo(() => {
    const { from, to } = timeRange;
    if (!from && !to) return attackArticles;
    return attackArticles.filter((a) => {
      const t = effectiveTime(a);
      if (from && t < from.getTime()) return false;
      if (to && t > to.getTime()) return false;
      return true;
    });
  }, [attackArticles, timeRange]);

  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    attackArticles.forEach((a) => a.countries_mentioned?.forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [attackArticles]);

  const countryFiltered = useMemo(() => {
    if (selectedCountries.length === 0) return timeFiltered;
    return timeFiltered.filter((a) =>
      selectedCountries.some((c) => a.countries_mentioned?.includes(c))
    );
  }, [timeFiltered, selectedCountries]);

  const severityFiltered =
    severityFilter === "all"
      ? countryFiltered
      : countryFiltered.filter(
          (a) => a.classification?.severity === severityFilter
        );

  const filtered = useMemo(() => {
    // Require at least 2 characters to avoid matching on single-letter typos while typing
    if (searchWords.length === 0 || debouncedQuery.trim().length < 2) return severityFiltered;
    return severityFiltered.filter((a) => {
      const haystack = [
        a.title_en,
        a.summary_en,
        a.source_name,
        a.classification?.brief,
        a.classification?.location,
        ...(a.classification?.parties_involved || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchWords.every((w) => haystack.includes(w));
    });
  }, [severityFiltered, searchWords, debouncedQuery]);

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
    all: countryFiltered.length,
    major: countryFiltered.filter((a) => a.classification?.severity === "major").length,
    high: countryFiltered.filter((a) => a.classification?.severity === "high").length,
    medium: countryFiltered.filter((a) => a.classification?.severity === "medium").length,
    low: countryFiltered.filter((a) => a.classification?.severity === "low").length,
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

      {/* Time range filter */}
      <TimeRangeFilter value={timeRange} onChange={setTimeRange} />

      {/* Country filter */}
      <div style={{ marginBottom: 12 }}>
        <CountryFilter
          available={availableCountries}
          selected={selectedCountries}
          onChange={setSelectedCountries}
        />
      </div>

      {/* Search input */}
      <div
        style={{
          position: "relative",
          marginBottom: 12,
        }}
      >
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search attacks, locations, parties…"
          style={{
            width: "100%",
            padding: "10px 40px 10px 36px",
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <span
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--color-text-muted)",
            fontSize: 14,
            pointerEvents: "none",
          }}
        >
          🔍
        </span>
        {searchQuery && (
          <span
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "var(--color-text-muted)",
                background: "var(--color-border)",
                padding: "2px 6px",
                borderRadius: 10,
              }}
            >
              {filtered.length}
            </span>
            <button
              onClick={() => setSearchQuery("")}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-text-muted)",
                cursor: "pointer",
                fontSize: 16,
                padding: 0,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </span>
        )}
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
              key={`${na.attack.id}-${na.index}`}
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
              searchQuery={debouncedQuery}
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
