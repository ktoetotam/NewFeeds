import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "AI Realist Iran Monitor — Live Middle East Conflict Feed and Briefing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#fef6f0",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px 96px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Top label */}
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: "#6a4c93",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginBottom: 28,
          }}
        >
          by AI Realist · airealist.org
        </div>

        {/* Main title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: "#5b4230",
            lineHeight: 1.05,
            marginBottom: 28,
          }}
        >
          Iran Monitor
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 34,
            fontWeight: 700,
            color: "#f68a6b",
            lineHeight: 1.2,
            marginBottom: 32,
          }}
        >
          Live Middle East Conflict Feed & Briefing
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 24,
            color: "#5b4230",
            opacity: 0.75,
            lineHeight: 1.4,
            maxWidth: 820,
            marginBottom: 48,
          }}
        >
          120+ sources · AI-translated news · Attack tracking · Threat levels · Intelligence briefings
        </div>

        {/* Bottom stat pills */}
        <div style={{ display: "flex", gap: 16 }}>
          {["Iran", "Russia", "Israel", "Gulf", "China", "Proxies"].map((label) => (
            <div
              key={label}
              style={{
                background: "#f68a6b",
                color: "#fef6f0",
                fontSize: 18,
                fontWeight: 600,
                padding: "8px 20px",
                borderRadius: 24,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
