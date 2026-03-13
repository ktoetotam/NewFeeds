"use client";

import Link from "next/link";
import Header from "@/components/Header";
import DownloadBriefingsButton from "@/components/DownloadBriefingsButton";
import { useOperationalBriefing, useThreatLevel } from "@/lib/hooks";
import type { OperationalBriefingData, CountrySummary, BriefingSource } from "@/lib/types";

function formatBriefingTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

function CitedText({ text, sources }: { text: string; sources?: BriefingSource[] }) {
  if (!sources?.length) return <>{text}</>;
  const parts = text.split(/(\[\d+\])/g);
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[(\d+)\]$/);
        if (m) {
          const idx = parseInt(m[1]);
          const src = sources.find((s) => s.index === idx);
          if (src) {
            return (
              <sup key={i} style={{ lineHeight: 0 }}>
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={src.title}
                  style={{
                    color: "#6a4c93",
                    textDecoration: "none",
                    fontWeight: 700,
                    fontSize: "0.75em",
                  }}
                >
                  [{idx}]
                </a>
              </sup>
            );
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <h3
      style={{
        fontSize: 16,
        fontWeight: 700,
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span>{icon}</span> {title}
    </h3>
  );
}

function BulletList({
  items,
  color,
  muted,
  sources,
}: {
  items: string[];
  color?: string;
  muted?: boolean;
  sources?: BriefingSource[];
}) {
  if (!items || items.length === 0) return null;
  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {items.map((item, i) => (
        <li
          key={i}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            fontSize: 14,
            lineHeight: 1.6,
            color: muted ? "var(--color-text-muted)" : "var(--color-text)",
            fontStyle: muted ? "italic" : "normal",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: color || "var(--color-text-muted)",
              flexShrink: 0,
              marginTop: 8,
            }}
          />
          <CitedText text={item} sources={sources} />
        </li>
      ))}
    </ul>
  );
}

function CountryCard({ summary, sources }: { summary: CountrySummary; sources?: BriefingSource[] }) {
  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderLeft: "3px solid #6a4c93",
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          marginBottom: 10,
          color: "#6a4c93",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        🏳️ {summary.country}
      </div>
      <BulletList items={summary.bullets} color="#6a4c93" sources={sources} />
    </div>
  );
}

function BriefingContent({ briefing }: { briefing: OperationalBriefingData }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Time window bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          padding: "14px 20px",
          background: "#6a4c9310",
          border: "1px solid #6a4c9330",
          borderRadius: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#6a4c9325",
              border: "2px solid #6a4c93",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            📧
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#6a4c93" }}>
              OPERATIONAL BRIEFING
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {briefing.window_minutes}-minute window ·{" "}
              {briefing.source_count.attacks_analyzed} attacks ·{" "}
              {briefing.source_count.articles_analyzed} articles
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            Window
          </span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {briefing.window_start_display} — {briefing.window_end_display}
          </span>
        </div>
      </div>

      {/* Produced at */}
      <div
        style={{
          textAlign: "center",
          fontSize: 13,
          color: "var(--color-text-muted)",
          fontStyle: "italic",
        }}
      >
        Produced {formatBriefingTime(briefing.generated_at)}
      </div>

      {/* Caveat */}
      {briefing.caveat && (
        <div
          style={{
            background: "#f68a6b10",
            border: "1px solid #f68a6b30",
            borderLeft: "3px solid #f68a6b",
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--color-text-muted)",
            fontStyle: "italic",
          }}
        >
          ⚠️ {briefing.caveat}
        </div>
      )}

      {/* Executive Summary */}
      <section>
        <SectionHeader title="Summary" icon="📋" />
        <div
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            padding: 20,
            fontSize: 15,
            lineHeight: 1.7,
            borderLeft: "3px solid #6a4c93",
          }}
        >
          <CitedText text={briefing.executive_summary} sources={briefing.sources} />
        </div>
      </section>

      {/* Trends */}
      {briefing.trends?.length > 0 && (
        <section>
          <SectionHeader title="Trends (This Hour)" icon="📊" />
          <BulletList items={briefing.trends} color="#6a4c93" sources={briefing.sources} />
        </section>
      )}

      {/* Country Summaries */}
      {briefing.country_summaries?.length > 0 && (
        <section>
          <SectionHeader title="By Country" icon="🌍" />
          {briefing.country_summaries.map((cs, i) => (
            <CountryCard key={i} summary={cs} sources={briefing.sources} />
          ))}
        </section>
      )}

      {/* Sources */}
      {briefing.sources && briefing.sources.length > 0 && (
        <section>
          <SectionHeader title="Sources" icon="📎" />
          <ol
            style={{
              padding: "0 0 0 20px",
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {briefing.sources.map((s) => (
              <li
                key={s.index}
                style={{
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: "var(--color-text-muted)",
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
                  {s.source_name}
                </span>
                {" — "}
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#6a4c93", textDecoration: "underline" }}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          padding: "12px 0",
          borderTop: "1px solid var(--color-border)",
          fontSize: 12,
          color: "var(--color-text-muted)",
        }}
      >
        <span>
          Sources: {briefing.source_count.attacks_analyzed} attacks,{" "}
          {briefing.source_count.articles_analyzed} articles
        </span>
        <span>Generated: {formatBriefingTime(briefing.generated_at)}</span>
      </div>
    </div>
  );
}

export default function BriefingClient() {
  const { threatLevel, loading: threatLoading } = useThreatLevel();
  const { briefing, loading: briefingLoading } = useOperationalBriefing();

  const loading = threatLoading || briefingLoading;

  if (loading) {
    return (
      <>
        <Header threatLevel={threatLevel} updatedAt={threatLevel.updated_at} />
        <main
          style={{
            maxWidth: 1000,
            margin: "0 auto",
            padding: "24px 24px 48px",
          }}
        >
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
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}
        >
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
              <div
                style={{
                  fontSize: 13,
                  color: "var(--color-text-muted)",
                  lineHeight: 1.5,
                }}
              >
                Live articles from all monitored regions.
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#6a4c93",
                }}
              >
                Go to News Feed →
              </div>
            </div>
          </Link>

          <Link
            href="/summary"
            style={{ textDecoration: "none", color: "inherit" }}
          >
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
              <span style={{ fontSize: 18, fontWeight: 700 }}>
                📊 Executive Summary
              </span>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--color-text-muted)",
                  lineHeight: 1.5,
                }}
              >
                Full analytical briefing with outlook and impacts.
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#6a4c93",
                }}
              >
                View Executive Summary →
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
          <h2 style={{ fontSize: 24, fontWeight: 700 }}>
            Operational Briefing
          </h2>
          <DownloadBriefingsButton />
        </div>
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-muted)",
            marginBottom: 24,
          }}
        >
          Hourly fact-based operational email — events from the last 60 minutes
          only
        </p>

        {briefing ? (
          <BriefingContent briefing={briefing} />
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
            <div style={{ fontSize: 40, marginBottom: 16 }}>📧</div>
            <div
              style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}
            >
              No Operational Briefing Available
            </div>
            <div style={{ fontSize: 14 }}>
              The briefing will be generated automatically on the next summary
              cycle when event data is available.
            </div>
          </div>
        )}
      </main>
    </>
  );
}
