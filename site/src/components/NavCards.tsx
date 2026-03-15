"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const SITE_URL = "https://iran.airealist.org";
const SHARE_TEXT = "AI Realist Iran Monitor — Live Middle East Conflict Feed and Briefing";

const SHARE_LINKS = [
  {
    label: "X",
    icon: "𝕏",
    url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(SITE_URL)}`,
    color: "#000",
  },
  {
    label: "Facebook",
    icon: "f",
    url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SITE_URL)}`,
    color: "#1877f2",
  },
  {
    label: "LinkedIn",
    icon: "in",
    url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL)}`,
    color: "#0a66c2",
  },
  {
    label: "Telegram",
    icon: "✈",
    url: `https://t.me/share/url?url=${encodeURIComponent(SITE_URL)}&text=${encodeURIComponent(SHARE_TEXT)}`,
    color: "#26a5e4",
  },
  {
    label: "WhatsApp",
    icon: "W",
    url: `https://wa.me/?text=${encodeURIComponent(SHARE_TEXT + " " + SITE_URL)}`,
    color: "#25d366",
  },
];

const CARD_STYLE: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "2px solid var(--color-border)",
  borderRadius: 12,
  padding: "20px 24px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
  cursor: "pointer",
  height: "100%",
  boxSizing: "border-box",
};

export default function NavCards() {
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    setCanNativeShare(!!navigator.share && navigator.maxTouchPoints > 0);
  }, []);

  async function handleNativeShare() {
    try {
      await navigator.share({ title: SHARE_TEXT, url: SITE_URL });
    } catch {
      // user cancelled or error — do nothing
    }
  }

  return (
    <>
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 16,
        marginBottom: 32,
      }}
    >
      {/* News Feed */}
      <Link href="/" style={{ textDecoration: "none", color: "inherit", display: "flex" }}>
        <div style={CARD_STYLE}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>📰 News Feed</span>
          <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5, flex: 1 }}>
            Live articles from all monitored regions, translated and relevance-filtered.
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#6a4c93" }}>
            Go to News Feed →
          </div>
        </div>
      </Link>

      {/* Attack Monitor */}
      <Link href="/attacks" style={{ textDecoration: "none", color: "inherit", display: "flex" }}>
        <div style={CARD_STYLE}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>🎯 Attack Monitor</span>
          <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5, flex: 1 }}>
            Geolocated military incidents with severity classification and threat-level tracking.
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#6a4c93" }}>
            View Attack Monitor →
          </div>
        </div>
      </Link>

      {/* Briefing by Country */}
      <Link href="/summary" style={{ textDecoration: "none", color: "inherit", display: "flex" }}>
        <div style={CARD_STYLE}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>📋 Briefing by Country</span>
          <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5, flex: 1 }}>
            AI-generated intelligence briefing covering regional threat assessments, key incidents, and escalation risks.
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#6a4c93" }}>
            Read Briefing by Country →
          </div>
        </div>
      </Link>

      {/* AI Realist Articles */}
      <div style={CARD_STYLE}>
        <span style={{ fontSize: 18, fontWeight: 700 }}>✍️ AI Realist Articles</span>
        <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
          Read AI Realist analysis on the topic:
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
          <a href="https://msukhareva.substack.com/p/did-ai-misidentify-the-minab-school" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#f68a6b", fontWeight: 600, textDecoration: "none" }}>
            → Did AI misidentify the Minab school?
          </a>
          <a href="https://msukhareva.substack.com/p/i-built-a-public-monitoring-website" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#f68a6b", fontWeight: 600, textDecoration: "none" }}>
            → I built a public monitoring website
          </a>
          <a href="https://msukhareva.substack.com/p/the-bailout-that-isnt-a-bailout" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#f68a6b", fontWeight: 600, textDecoration: "none" }}>
            → The bailout that isn't a bailout
          </a>
        </div>
      </div>
    </section>

    {/* Share bar */}
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, color: "var(--color-text-muted)", fontWeight: 600 }}>Share:</span>
      {SHARE_LINKS.map(({ label, icon, url, color }) => {
        // LinkedIn: use native share sheet if available (LinkedIn app doesn't handle web share URLs)
        if (label === "LinkedIn" && canNativeShare) {
          return (
            <button
              key={label}
              onClick={handleNativeShare}
              title="Share on LinkedIn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                borderRadius: 8,
                background: color,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {icon}
            </button>
          );
        }
        return (
          <a
            key={label}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={`Share on ${label}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: 8,
              background: color,
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            {icon}
          </a>
        );
      })}
    </div>
  </>
  );
}
