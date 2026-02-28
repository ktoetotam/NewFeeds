import Header from "@/components/Header";
import { getArchiveIndex, getThreatLevel, syncArchivesToPublic } from "@/lib/data";
import { THREAT_LEVEL_COLORS } from "@/lib/types";
import Link from "next/link";

export default function ArchivesPage() {
  syncArchivesToPublic();
  const archives = getArchiveIndex();
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>
              Summary Archives
            </h2>
            <p
              style={{
                fontSize: 13,
                color: "var(--color-text-muted)",
              }}
            >
              {archives.length} previous briefings — download as JSON
            </p>
          </div>
          <Link
            href="/summary"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#3b82f6",
              textDecoration: "none",
              padding: "6px 14px",
              border: "1px solid #3b82f630",
              borderRadius: 6,
              background: "#3b82f610",
            }}
          >
            ← Current Briefing
          </Link>
        </div>

        {archives.length === 0 ? (
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
            <div style={{ fontSize: 40, marginBottom: 16 }}>🗄️</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              No Archives Yet
            </div>
            <div style={{ fontSize: 14 }}>
              Archives are created automatically each time a new executive summary is generated.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Table header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "44px 1fr 140px 100px 60px",
                gap: 12,
                padding: "8px 20px",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <span>Lvl</span>
              <span>Summary</span>
              <span>Date</span>
              <span>Incidents</span>
              <span></span>
            </div>

            {archives.map((entry) => {
              const levelColor =
                THREAT_LEVEL_COLORS[entry.threat_label] || "#16a34a";
              const time = new Date(entry.generated_at);
              const formattedDate = time.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={entry.filename}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "44px 1fr 140px 100px 60px",
                    gap: 12,
                    alignItems: "center",
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderLeft: `3px solid ${levelColor}`,
                    borderRadius: 8,
                    padding: "12px 20px",
                  }}
                >
                  {/* Threat level badge */}
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: `${levelColor}20`,
                      border: `2px solid ${levelColor}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 800,
                      color: levelColor,
                    }}
                  >
                    {entry.threat_level}
                  </div>

                  {/* Preview */}
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.4,
                      color: "var(--color-text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{ fontWeight: 600, color: levelColor, marginRight: 6 }}>
                      {entry.threat_label}
                      {entry.trend === "escalating" ? " ↑" : entry.trend === "de-escalating" ? " ↓" : " →"}
                    </span>
                    {entry.summary_preview}
                  </div>

                  {/* Date */}
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                    {formattedDate}
                  </div>

                  {/* Incident count */}
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                    {entry.incident_count_24h} (24h)
                  </div>

                  {/* Download link */}
                  <a
                    href={`${process.env.NODE_ENV === "production" ? "/NewFeeds" : ""}/archives/${encodeURIComponent(entry.filename)}`}
                    download={entry.filename}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#3b82f6",
                      textDecoration: "none",
                      padding: "4px 8px",
                      border: "1px solid #3b82f630",
                      borderRadius: 5,
                      background: "#3b82f610",
                      textAlign: "center",
                    }}
                  >
                    ↓ JSON
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
