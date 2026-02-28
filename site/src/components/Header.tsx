import Link from "next/link";
import type { ThreatLevel } from "@/lib/types";
import { THREAT_LEVEL_COLORS } from "@/lib/types";

interface HeaderProps {
  threatLevel?: ThreatLevel;
  updatedAt?: string;
}

export default function Header({ threatLevel, updatedAt }: HeaderProps) {
  const level = threatLevel?.current;
  const levelColor = level
    ? THREAT_LEVEL_COLORS[level.label] || "#16a34a"
    : "#16a34a";

  return (
    <header
      style={{
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        padding: "16px 24px",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>
            <span style={{ color: "#ef4444" }}>&#9673;</span> Iran &amp; Region
            Monitor
          </h1>
          <nav style={{ display: "flex", gap: 16, fontSize: 14 }}>
            <Link href="/" style={{ color: "var(--color-text-muted)" }}>
              News Feed
            </Link>
            <Link
              href="/attacks"
              style={{ color: "var(--color-text-muted)" }}
            >
              Attack Monitor
            </Link>
            <Link
              href="/summary"
              style={{ color: "var(--color-text-muted)" }}
            >
              Executive Summary
            </Link>
          </nav>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Threat level badge */}
          {level && (
            <Link
              href="/attacks"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: `${levelColor}20`,
                border: `1px solid ${levelColor}40`,
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: 13,
                fontWeight: 600,
                color: levelColor,
                textDecoration: "none",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: levelColor,
                  display: "inline-block",
                  animation:
                    level.level <= 2 ? "pulse 2s infinite" : undefined,
                }}
              />
              THREAT: {level.label}
              {threatLevel?.trend === "escalating" && " ↑"}
              {threatLevel?.trend === "de-escalating" && " ↓"}
            </Link>
          )}

          {/* Last updated */}
          {updatedAt && (
            <span
              style={{ fontSize: 12, color: "var(--color-text-muted)" }}
            >
              Updated:{" "}
              {new Date(updatedAt).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                timeZoneName: "short",
              })}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
