import Link from "next/link";
import Image from "next/image";
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
      <style>{`@media (max-width: 640px) { header { position: static !important; } }`}</style>
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
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>
              <span style={{ color: "#f68a6b" }}>&#9673;</span> Iran &amp; Region Monitor
              <a
                href="https://www.airealist.org/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 20, fontWeight: 700, color: "#f68a6b", textDecoration: "none", marginLeft: 10, letterSpacing: -0.5 }}
              >by AI Realist</a>
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
              <Link
                href="/briefing"
                style={{ color: "var(--color-text-muted)" }}
              >
                Briefing by Country
              </Link>
            </nav>
          </div>
          {/* Attribution & support */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--color-text-muted)",
            }}
          >
            <span>
              To support this project{" "}
              <a
                href="https://msukhareva.substack.com/subscribe"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#f68a6b", fontWeight: 600, textDecoration: "none" }}
              >
                subscribe to AI Realist newsletter
              </a>
            </span>
          </div>
        </div>

        <a
          href="https://msukhareva.substack.com/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "stretch", flexShrink: 0, alignSelf: "stretch" }}
        >
          <Image src="/ai-realist-logo-cropped.png" alt="AI Realist" width={160} height={80} style={{ borderRadius: 6, width: "auto", height: "100%", minHeight: 40, maxHeight: 80 }} />
        </a>
      </div>

    </header>
  );
}
