"use client";

import { useState } from "react";
import type { Article, RegionKey } from "@/lib/types";
import { REGIONS } from "@/lib/types";
import NewsCard from "./NewsCard";

interface NewsFeedProps {
  articlesByRegion: Record<string, Article[]>;
}

export default function NewsFeed({ articlesByRegion }: NewsFeedProps) {
  const [activeRegion, setActiveRegion] = useState<RegionKey | "all">("all");
  const [translationFilter, setTranslationFilter] = useState<
    "all" | "translated" | "pending"
  >("translated");

  const allArticles = Object.values(articlesByRegion)
    .flat()
    .sort((a, b) => {
      const da = new Date(a.published).getTime() || 0;
      const db = new Date(b.published).getTime() || 0;
      return db - da;
    });

  const regionArticles =
    activeRegion === "all"
      ? allArticles
      : articlesByRegion[activeRegion] || [];

  const displayedArticles = regionArticles.filter((a) => {
    if (translationFilter === "translated") return a.translated === true;
    if (translationFilter === "pending") return !a.translated;
    return true;
  });

  const translatedCount = regionArticles.filter(
    (a) => a.translated === true
  ).length;
  const pendingCount = regionArticles.filter((a) => !a.translated).length;

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
          color="#6366f1"
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

      {/* Translation filter */}
      <div
        style={{
          display: "flex",
          gap: 4,
          paddingBottom: 12,
          borderBottom: "1px solid var(--color-border)",
          marginBottom: 12,
        }}
      >
        <FilterPill
          active={translationFilter === "translated"}
          onClick={() => setTranslationFilter("translated")}
          count={translatedCount}
          color="#22c55e"
        >
          Translated
        </FilterPill>
        <FilterPill
          active={translationFilter === "all"}
          onClick={() => setTranslationFilter("all")}
          count={regionArticles.length}
          color="#6366f1"
        >
          All
        </FilterPill>
        <FilterPill
          active={translationFilter === "pending"}
          onClick={() => setTranslationFilter("pending")}
          count={pendingCount}
          color="#ca8a04"
        >
          Pending
        </FilterPill>
      </div>

      {/* Articles */}
      <div
        style={{
          display: "grid",
          gap: 12,
        }}
      >
        {displayedArticles.length > 0 ? (
          displayedArticles.map((article) => (
            <NewsCard key={article.id} article={article} />
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

function FilterPill({
  active,
  onClick,
  count,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 12px",
        borderRadius: 20,
        border: active ? `1px solid ${color}60` : "1px solid var(--color-border)",
        background: active ? `${color}15` : "transparent",
        color: active ? color : "var(--color-text-muted)",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        display: "flex",
        alignItems: "center",
        gap: 5,
      }}
    >
      {children}
      <span
        style={{
          fontSize: 11,
          background: active ? `${color}30` : "var(--color-border)",
          padding: "1px 6px",
          borderRadius: 10,
        }}
      >
        {count}
      </span>
    </button>
  );
}
