import Link from "next/link";

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
  return (
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

      {/* Executive Summary */}
      <Link href="/summary" style={{ textDecoration: "none", color: "inherit", display: "flex" }}>
        <div style={CARD_STYLE}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>📋 Executive Summary</span>
          <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5, flex: 1 }}>
            AI-generated intelligence briefing covering regional threat assessments, key incidents, and escalation risks.
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#6a4c93" }}>
            Read Executive Summary →
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
  );
}
