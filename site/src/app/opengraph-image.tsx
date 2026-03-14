import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "NewFeeds — Global Conflict & Security Monitor";
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
          Global Conflict & Security Monitor
        </div>

        {/* Main title */}
        <div
          style={{
            fontSize: 88,
            fontWeight: 800,
            color: "#5b4230",
            lineHeight: 1.05,
            marginBottom: 36,
          }}
        >
          NewFeeds
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 28,
            color: "#5b4230",
            opacity: 0.75,
            lineHeight: 1.4,
            maxWidth: 820,
            marginBottom: 56,
          }}
        >
          120+ sources · 10 regions · 7 languages · real-time AI translation & threat tracking
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
