"use client";

import { useState, useEffect, useMemo } from "react";
import type { Article, RegionKey } from "@/lib/types";
import { REGIONS } from "@/lib/types";
import NewsCard from "./NewsCard";
import TimeRangeFilter, { type TimeRange } from "@/components/TimeRangeFilter";
import CountryFilter from "./CountryFilter";

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

interface NewsFeedProps {
  articlesByRegion: Record<string, Article[]>;
}

export default function NewsFeed({ articlesByRegion }: NewsFeedProps) {
  const [activeRegion, setActiveRegion] = useState<RegionKey | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>(() => ({
    from: null,
    to: null,
  }));
  const debouncedQuery = useDebounce(searchQuery, 250);

  function effectiveTime(a: Article): number {
    const now = Date.now();
    const pub = new Date(a.published).getTime();
    if (!isNaN(pub) && pub <= now) return pub;
    const fetched = a.fetched_at ? new Date(a.fetched_at).getTime() : NaN;
    if (!isNaN(fetched)) return fetched;
    return 0;
  }

  const allArticles = Object.values(articlesByRegion)
    .flat()
    .sort((a, b) => effectiveTime(b) - effectiveTime(a));

  const regionArticles =
    activeRegion === "all"
      ? allArticles
      : (articlesByRegion[activeRegion] || []).slice().sort((a, b) => effectiveTime(b) - effectiveTime(a));

  const timeFilteredArticles = useMemo(() => {
    const { from, to } = timeRange;
    if (!from && !to) return regionArticles;
    return regionArticles.filter((a) => {
      const t = effectiveTime(a);
      if (from && t < from.getTime()) return false;
      if (to && t > to.getTime()) return false;
      return true;
    });
  }, [regionArticles, timeRange]);

  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    allArticles.forEach((a) => a.countries_mentioned?.forEach((c) => set.add(c)));
    return Array.from(set).sort();
  }, [allArticles]);

  const countryFiltered = useMemo(() => {
    if (selectedCountries.length === 0) return timeFilteredArticles;
    return timeFilteredArticles.filter((a) =>
      selectedCountries.some((c) => a.countries_mentioned?.includes(c))
    );
  }, [timeFilteredArticles, selectedCountries]);

  const searchWords = useMemo(
    () => debouncedQuery.toLowerCase().split(/\s+/).filter(Boolean),
    [debouncedQuery]
  );

  const displayedArticles = useMemo(() => {
    // Require at least 2 characters to avoid matching on single-letter typos while typing
    if (searchWords.length === 0 || debouncedQuery.trim().length < 2) return countryFiltered;
    return countryFiltered.filter((a) => {
      const haystack = [
        a.title_en,
        a.summary_en,
        a.source_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchWords.every((w) => haystack.includes(w));
    });
  }, [countryFiltered, searchWords, debouncedQuery]);

  return (
    <div>
      {/* Tab navigation */}
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "16px 0",
          overflowX: "auto",
          flexWrap: "wrap",
        }}
      >
        <TabButton
          active={activeRegion === "all"}
          onClick={() => setActiveRegion("all")}
          color="#f68a6b"
          count={allArticles.length}
        >
          All
        </TabButton>
        {REGIONS.map((region) => (
          <TabButton
            key={region.key}
            active={activeRegion === region.key}
            onClick={() => setActiveRegion(region.key)}
            color={region.color}
            count={(articlesByRegion[region.key] || []).length}
          >
            {region.label}
          </TabButton>
        ))}
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
          marginBottom: 8,
        }}
      >
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search headlines & summaries…"
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
        {/* Search icon */}
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
        {/* Clear button + match count */}
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
              {displayedArticles.length}
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



      {/* Articles */}
      <div
        style={{
          display: "grid",
          gap: 12,
        }}
      >
        {displayedArticles.length > 0 ? (
          displayedArticles.map((article, idx) => (
            <NewsCard key={`${article.region}-${article.id}-${idx}`} article={article} searchQuery={debouncedQuery} />
          ))
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: 48,
              color: "var(--color-text-muted)",
            }}
          >
            No articles available yet. Run the pipeline to fetch news.
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  color,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 16px",
        borderRadius: 8,
        border: active ? `1px solid ${color}60` : "1px solid var(--color-border)",
        background: active ? `${color}15` : "transparent",
        color: active ? color : "var(--color-text-muted)",
        cursor: "pointer",
        fontSize: 14,
        fontWeight: active ? 600 : 400,
        display: "flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
      }}
    >
      {children}
      <span
        style={{
          fontSize: 11,
          background: active ? `${color}30` : "var(--color-border)",
          padding: "2px 6px",
          borderRadius: 10,
        }}
      >
        {count}
      </span>
    </button>
  );
}


