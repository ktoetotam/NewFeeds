#!/usr/bin/env python3
"""Helper script to write the 4 component files."""
import os

COMP = "/Users/mariasukhareva/NewFeeds/site/src/components"

# ── FILE 1: AttackMap.tsx ──
with open(os.path.join(COMP, "AttackMap.tsx"), "w") as f:
    f.write('''"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import type { Article } from "@/lib/types";
import { formatTimeAgo } from "@/lib/utils";
import { useEffect, useRef, useCallback } from "react";

interface AttackMapProps {
  attacks: Article[];
  /** Map from article id to its display number (1-based) */
  numberMap?: Record<string, number>;
  /** When set, the map flies to this attack and opens its popup */
  selectedAttackId?: string | null;
}

const severityColor: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

function makeNumberedIcon(num: number | undefined, color: string) {
  if (!num) {
    const size = 18;
    return L.divIcon({
      className: "",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
      html: `<div style="
        width:${size}px;height:${size}px;
        border-radius:50%;
        background:${color};
        border:2px solid #fff;
        box-shadow:0 1px 4px rgba(0,0,0,.45);
        opacity:0.85;
      "></div>`,
    });
  }
  const size = num > 99 ? 28 : 24;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<div style="
      width:${size}px;height:${size}px;
      border-radius:50%;
      background:${color};
      color:#fff;
      font-size:${num > 99 ? 10 : 12}px;
      font-weight:700;
      display:flex;align-items:center;justify-content:center;
      border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.45);
      line-height:1;
    ">${num}</div>`,
  });
}

/** Inner component that reacts to selectedAttackId changes */
function FlyToSelected({
  selectedAttackId,
  markerRefs,
  attacks,
}: {
  selectedAttackId: string | null | undefined;
  markerRefs: React.MutableRefObject<Record<string, L.Marker>>;
  attacks: Article[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedAttackId) return;
    const attack = attacks.find((a) => a.id === selectedAttackId);
    if (!attack || attack.lat == null || attack.lng == null) return;

    map.flyTo([attack.lat, attack.lng], 8, { duration: 0.8 });

    // Open the popup after the fly animation
    setTimeout(() => {
      const marker = markerRefs.current[selectedAttackId];
      if (marker) marker.openPopup();
    }, 900);
  }, [selectedAttackId, map, attacks, markerRefs]);

  return null;
}

export default function AttackMap({ attacks, numberMap, selectedAttackId }: AttackMapProps) {
  const markerRefs = useRef<Record<string, L.Marker>>({});

  const setMarkerRef = useCallback(
    (id: string) => (ref: L.Marker | null) => {
      if (ref) markerRefs.current[id] = ref;
      else delete markerRefs.current[id];
    },
    []
  );

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
      <FlyToSelected
        selectedAttackId={selectedAttackId}
        markerRefs={markerRefs}
        attacks={mapped}
      />
      {mapped.map((attack) => {
        const severity = attack.classification?.severity ?? "low";
        const color = severityColor[severity] ?? "#6366f1";
        const num = numberMap?.[attack.id];
        return (
          <Marker
            key={attack.id}
            position={[attack.lat!, attack.lng!]}
            icon={makeNumberedIcon(num, color)}
            ref={setMarkerRef(attack.id)}
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
                    {num ? `#${num} ` : ""}{attack.title_en || attack.title_original}
                  </a>
                </div>
                <div style={{ color: "#555", marginBottom: 6, fontSize: 12 }}>
                  \u{1F4CD} {attack.classification?.location} \u{00B7}{" "}
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
          </Marker>
        );
      })}
    </MapContainer>
  );
}
''')
print("Written: AttackMap.tsx")

# ── FILE 2: AttackMapClient.tsx ──
with open(os.path.join(COMP, "AttackMapClient.tsx"), "w") as f:
    f.write(""""use client";

import dynamic from "next/dynamic";
import type { Article } from "@/lib/types";

const AttackMap = dynamic(() => import("./AttackMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 420,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--color-text-muted)",
        fontSize: 14,
      }}
    >
      Loading map\u2026
    </div>
  ),
});

interface AttackMapClientProps {
  attacks: Article[];
  numberMap?: Record<string, number>;
  selectedAttackId?: string | null;
}

export default function AttackMapClient({ attacks, numberMap, selectedAttackId }: AttackMapClientProps) {
  return <AttackMap attacks={attacks} numberMap={numberMap} selectedAttackId={selectedAttackId} />;
}
""")
print("Written: AttackMapClient.tsx")

# ── FILE 3: AttackMonitor.tsx ──
with open(os.path.join(COMP, "AttackMonitor.tsx"), "w") as f:
    f.write(""""use client";

import { useState, useMemo, useRef } from "react";
import type { Article, ThreatLevel } from "@/lib/types";
import ThreatLevelDisplay from "./ThreatLevelDisplay";
import AttackCard from "./AttackCard";
import AttackMapClient from "./AttackMapClient";

interface AttackMonitorProps {
  attackArticles: Article[];
  threatLevel: ThreatLevel;
}

type SeverityFilter = "all" | "critical" | "high" | "medium" | "low";

export default function AttackMonitor({
  attackArticles,
  threatLevel,
}: AttackMonitorProps) {
  const [severityFilter, setSeverityFilter] =
    useState<SeverityFilter>("all");
  const [selectedAttackId, setSelectedAttackId] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const filtered =
    severityFilter === "all"
      ? attackArticles
      : attackArticles.filter(
          (a) => a.classification?.severity === severityFilter
        );

  const severityCounts = {
    all: attackArticles.length,
    critical: attackArticles.filter(
      (a) => a.classification?.severity === "critical"
    ).length,
    high: attackArticles.filter(
      (a) => a.classification?.severity === "high"
    ).length,
    medium: attackArticles.filter(
      (a) => a.classification?.severity === "medium"
    ).length,
    low: attackArticles.filter(
      (a) => a.classification?.severity === "low"
    ).length,
  };

  const severityColors: Record<SeverityFilter, string> = {
    all: "#6366f1",
    critical: "#dc2626",
    high: "#ea580c",
    medium: "#ca8a04",
    low: "#16a34a",
  };

  // Build a number map: article id \u2192 1-based index in the filtered list
  const numberMap = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((a, i) => {
      map[a.id] = i + 1;
    });
    return map;
  }, [filtered]);

  const handleSelectAttack = (id: string) => {
    setSelectedAttackId((prev) => {
      const next = prev === id ? null : id;
      if (next && mapRef.current) {
        mapRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return next;
    });
  };

  return (
    <div>
      <ThreatLevelDisplay threatLevel={threatLevel} />

      {/* Map with numbered pins */}
      <section style={{ marginBottom: 20 }} ref={mapRef}>
        <AttackMapClient attacks={filtered} numberMap={numberMap} selectedAttackId={selectedAttackId} />
      </section>

      {/* Severity filter tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {(
          ["all", "critical", "high", "medium", "low"] as SeverityFilter[]
        ).map((sev) => (
          <button
            key={sev}
            onClick={() => setSeverityFilter(sev)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border:
                severityFilter === sev
                  ? `1px solid ${severityColors[sev]}60`
                  : "1px solid var(--color-border)",
              background:
                severityFilter === sev
                  ? `${severityColors[sev]}15`
                  : "transparent",
              color:
                severityFilter === sev
                  ? severityColors[sev]
                  : "var(--color-text-muted)",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: severityFilter === sev ? 600 : 400,
              display: "flex",
              alignItems: "center",
              gap: 6,
              textTransform: "capitalize",
            }}
          >
            {sev}
            <span
              style={{
                fontSize: 11,
                background:
                  severityFilter === sev
                    ? `${severityColors[sev]}30`
                    : "var(--color-border)",
                padding: "2px 6px",
                borderRadius: 10,
              }}
            >
              {severityCounts[sev]}
            </span>
          </button>
        ))}
      </div>

      {/* Attack articles list */}
      <div style={{ display: "grid", gap: 12 }}>
        {filtered.length > 0 ? (
          filtered.map((article, i) => (
            <AttackCard
              key={article.id}
              article={article}
              index={i + 1}
              onSelectOnMap={handleSelectAttack}
              isSelected={selectedAttackId === article.id}
            />
          ))
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: 48,
              color: "var(--color-text-muted)",
            }}
          >
            {attackArticles.length === 0
              ? "No attack-related articles detected. Run the pipeline to fetch and classify news."
              : `No ${severityFilter}-severity incidents found.`}
          </div>
        )}
      </div>
    </div>
  );
}
""")
print("Written: AttackMonitor.tsx")

# ── FILE 4: AttackCard.tsx ──
with open(os.path.join(COMP, "AttackCard.tsx"), "w") as f:
    f.write("""import type { Article } from "@/lib/types";
import { REGIONS, SEVERITY_COLORS } from "@/lib/types";
import { formatTimeAgo } from "@/lib/utils";

interface AttackCardProps {
  article: Article;
  /** 1-based index shown in the list and on the map pin */
  index?: number;
  /** Callback when the user clicks the numbered badge to locate on map */
  onSelectOnMap?: (id: string) => void;
  /** Whether this card is the currently-selected one */
  isSelected?: boolean;
}

export default function AttackCard({ article, index, onSelectOnMap, isSelected }: AttackCardProps) {
  const classification = article.classification;
  if (!classification) return null;

  const regionCfg = REGIONS.find((r) => r.key === article.region);
  const regionColor = regionCfg?.color || "#6366f1";
  const severityColor = SEVERITY_COLORS[classification.severity] || "#16a34a";

  const categoryIcons: Record<string, string> = {
    airstrike: "\U0001f4a5",
    missile_attack: "\U0001f680",
    drone_strike: "\U0001f6e9\ufe0f",
    ground_operation: "\u2694\ufe0f",
    naval_incident: "\U0001f6a2",
    cyber_attack: "\U0001f4bb",
    nuclear_development: "\u2622\ufe0f",
    threat_statement: "\u26a0\ufe0f",
    escalation: "\U0001f4c8",
    military_deployment: "\U0001f3af",
    ceasefire_violation: "\U0001f3f3\ufe0f",
    sanctions: "\U0001f6ab",
    other: "\U0001f4cb",
  };

  const icon = categoryIcons[classification.category] || "\U0001f4cb";

  return (
    <article
      style={{
        background: "var(--color-surface)",
        border: `1px solid ${severityColor}40`,
        borderLeft: `4px solid ${severityColor}`,
        borderRadius: 10,
        padding: 16,
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
      }}
    >
      {/* Numbered badge \u2014 click to show on map */}
      {index != null && (
        <div
          onClick={() => onSelectOnMap?.(article.id)}
          title="Show on map"
          style={{
            minWidth: 32,
            height: 32,
            borderRadius: "50%",
            background: severityColor,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: index > 99 ? 11 : 14,
            flexShrink: 0,
            marginTop: 2,
            boxShadow: isSelected
              ? `0 0 0 3px ${severityColor}`
              : `0 0 0 3px ${severityColor}30`,
            cursor: article.lat != null ? "pointer" : "default",
            transition: "box-shadow 0.2s, transform 0.2s",
            transform: isSelected ? "scale(1.15)" : "scale(1)",
          }}
        >
          {index}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
      {/* Top row: severity + category + source + time */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Severity badge */}
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 4,
              background: `${severityColor}20`,
              color: severityColor,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            {classification.severity}
          </span>

          {/* Category */}
          <span style={{ fontSize: 13 }}>
            {icon}{" "}
            {classification.category.replace(/_/g, " ")}
          </span>

          {/* Region */}
          <span
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 4,
              background: `${regionColor}20`,
              color: regionColor,
              fontWeight: 600,
            }}
          >
            {regionCfg?.label || article.region}
          </span>

          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            {article.source_name}
          </span>
        </div>

        <span
          style={{
            fontSize: 12,
            color: "var(--color-text-muted)",
            whiteSpace: "nowrap",
          }}
        >
          {formatTimeAgo(article.published)}
        </span>
      </div>

      {/* English headline */}
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--color-text)" }}
        >
          {article.title_en || article.title_original}
        </a>
      </h3>

      {/* Brief military significance */}
      {classification.brief && (
        <p
          style={{
            fontSize: 14,
            color: severityColor,
            fontWeight: 500,
            marginBottom: 6,
          }}
        >
          {classification.brief}
        </p>
      )}

      {/* Summary */}
      {article.summary_en && (
        <p
          style={{
            fontSize: 14,
            color: "var(--color-text-muted)",
            lineHeight: 1.6,
            marginBottom: 8,
          }}
        >
          {article.summary_en}
        </p>
      )}

      {/* Tags: parties + location */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {classification.location && classification.location !== "Unknown" && (
          <span
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 4,
              background: "var(--color-border)",
              color: "var(--color-text-muted)",
            }}
          >
            \U0001f4cd {classification.location}
          </span>
        )}
        {classification.parties_involved?.map((party) => (
          <span
            key={party}
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 4,
              background: "var(--color-border)",
              color: "var(--color-text-muted)",
            }}
          >
            {party}
          </span>
        ))}
      </div>      </div>    </article>
  );
}
""")
print("Written: AttackCard.tsx")

print("All 4 files written successfully!")
