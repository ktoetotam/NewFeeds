"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import type { Article } from "@/lib/types";
import { formatTimeAgo } from "@/lib/utils";
import { useEffect, useMemo } from "react";

export interface NumberedAttack {
  attack: Article;
  index: number | undefined;
}

interface AttackMapProps {
  numberedAttacks: NumberedAttack[];
  selectedId: string | null;
  onSelectAttack: (id: string) => void;
  onScrollToCard: (id: string) => void;
}

const severityColor: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

function createNumberedIcon(
  num: number,
  severity: string,
  isSelected: boolean
): L.DivIcon {
  const color = severityColor[severity] ?? "#6366f1";
  const size = isSelected ? 36 : 28;
  const fontSize = isSelected ? 14 : 12;
  const border = isSelected ? "3px solid #fff" : "2px solid #fff";
  const shadow = isSelected
    ? "0 0 0 3px " + color + ", 0 2px 8px rgba(0,0,0,0.4)"
    : "0 1px 4px rgba(0,0,0,0.3)";
  const zExtra = isSelected ? "z-index:1000;" : "";

  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${color};
      border:${border};
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:700;font-size:${fontSize}px;
      font-family:system-ui,sans-serif;
      box-shadow:${shadow};
      cursor:pointer;
      transition:all 0.2s ease;
      ${zExtra}
    ">${num}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

/** Sub-component that flies to the selected marker */
function FlyToSelected({
  numberedAttacks,
  selectedId,
}: {
  numberedAttacks: NumberedAttack[];
  selectedId: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedId) return;
    const na = numberedAttacks.find((n) => n.attack.id === selectedId);
    if (na && na.attack.lat != null && na.attack.lng != null) {
      map.flyTo([na.attack.lat, na.attack.lng], Math.max(map.getZoom(), 7), {
        duration: 0.8,
      });
    }
  }, [selectedId, numberedAttacks, map]);

  return null;
}

export default function AttackMap({
  numberedAttacks,
  selectedId,
  onSelectAttack,
  onScrollToCard,
}: AttackMapProps) {
  const mapped = useMemo(
    () =>
      numberedAttacks.filter(
        (na) =>
          na.attack.lat != null &&
          na.attack.lng != null &&
          na.attack.classification?.is_attack
      ),
    [numberedAttacks]
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
      <FlyToSelected numberedAttacks={mapped} selectedId={selectedId} />
      {mapped.map((na) => {
        const { attack, index } = na;
        const severity = attack.classification?.severity ?? "low";
        const isSelected = attack.id === selectedId;
        const icon = createNumberedIcon(index ?? 0, severity, isSelected);
        const color = severityColor[severity] ?? "#6366f1";

        return (
          <Marker
            key={attack.id}
            position={[attack.lat!, attack.lng!]}
            icon={icon}
            zIndexOffset={isSelected ? 1000 : 0}
          >
            <Popup maxWidth={300}>
              <div style={{ fontFamily: "sans-serif", fontSize: 13 }}>
                <div
                  style={{
                    fontWeight: 700,
                    marginBottom: 4,
                    lineHeight: 1.4,
                    display: "flex",
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: color,
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      marginRight: 6,
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {index}
                  </span>
                  <span>
                    {attack.title_en || attack.title_original}
                  </span>
                </div>
                <div style={{ color: "#555", marginBottom: 6, fontSize: 12 }}>
                  📍 {attack.classification?.location} ·{" "}
                  {formatTimeAgo(attack.published)}
                </div>
                {attack.classification?.brief && (
                  <div style={{ lineHeight: 1.5, color: "#333", marginBottom: 6 }}>
                    {attack.classification.brief}
                  </div>
                )}
                <div
                  style={{
                    marginTop: 4,
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onScrollToCard(attack.id);
                    }}
                    style={{
                      marginLeft: "auto",
                      fontSize: 11,
                      padding: "3px 10px",
                      borderRadius: 4,
                      border: `1px solid ${color}60`,
                      background: `${color}10`,
                      color,
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Show in list ↓
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
