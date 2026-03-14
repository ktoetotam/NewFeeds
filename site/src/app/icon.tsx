import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#f68a6b",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 20,
          fontWeight: 800,
          color: "#fef6f0",
        }}
      >
        N
      </div>
    ),
    { ...size }
  );
}
