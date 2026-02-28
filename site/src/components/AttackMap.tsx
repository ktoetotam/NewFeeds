"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import type { Article } from "@/lib/types";
import { formatTimeAgo } from "@/lib/utils";
import { useEffect } from "react";

// Fix Leaflet default icon paths broken by webpack
// (only needed if using Marker; CircleMarker doesn't need this)

interface AttackMapProps {
  attacks: Article[];
}

const severityColor: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

const severityRadius: Record<string, number> = {
  critical: 14,
  high: 10,
  medium: 8,
  low: 6,
};

export default function AttackMap({ attacks }: AttackMapProps) {
  // Filter to only attacks with coordinates
  const mapped = attacks.filter(
    (a) => a.lat != null && a.lng != null && a.classification?.is_attack
  );

  if (mapped.length === 0) {
    return (
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 10,
          padding: 24,
          textAlign: "center",
          color: "var(--color-text-muted)",
          fontSize: 14,
        }}
      >
        No geolocated attack events yet.
      </div>
    );
  }

  return (
    <MapContainer
      center={[29, 45]}
      zoom={5}
      style={{ height: 420, width: "100%", borderRadius: 10 }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {mapped.map((attack) => {
        const severity = attack.classification?.severity ?? "low";
        const color = severityColor[severity] ?? "#6366f1";
        const radius = severityRadius[severity] ?? 7;
        return (
          <CircleMarker
            key={attack.id}
            center={[attack.lat!, attack.lng!]}
            radius={radius}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.75,
              weight: 1.5,
            }}
          >
            <Popup maxWidth={300}>
              <div style={{ fontFamily: "sans-serif", fontSize: 13 }}>
                <div
                  style={{
                    fontWeight: 700,
                    marginBottom: 4,
                    lineHeight: 1.4,
                  }}
                >
                  <a
                    href={attack.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#1d4ed8", textDecoration: "underline" }}
                  >
                    {attack.title_en || attack.title_original}
                  </a>
                </div>
                <div style={{ color: "#555", marginBottom: 6, fontSize: 12 }}>
                  📍 {attack.classification?.location} ·{" "}
                  {formatTimeAgo(attack.published)}
                </div>
                {attack.classification?.brief && (
                  <div style={{ lineHeight: 1.5, color: "#333" }}>
                    {attack.classification.brief}
                  </div>
                )}
                <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "1px 7px",
                      borderRadius: 4,
                      background: `${color}22`,
                      color,
                      fontWeight: 600,
                      textTransform: "uppercase",
                    }}
                  >
                    {severity}
                  </span>
                  {attack.classification?.category && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "1px 7px",
                        borderRadius: 4,
                        background: "#f3f4f6",
                        color: "#666",
                      }}
                    >
                      {attack.classification.category}
                    </span>
                  )}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
