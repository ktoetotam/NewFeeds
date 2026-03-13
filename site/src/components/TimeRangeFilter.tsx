"use client";

import { useState, useCallback } from "react";

export type Preset = "1h" | "6h" | "24h" | "48h" | "7d" | "all" | "custom";

export interface TimeRange {
  from: Date | null; // null = no lower bound
  to: Date | null;   // null = now (open upper)
}

interface Props {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

const PRESETS: { label: string; key: Preset; hours?: number }[] = [
  { label: "1h",  key: "1h",  hours: 1 },
  { label: "6h",  key: "6h",  hours: 6 },
  { label: "24h", key: "24h", hours: 24 },
  { label: "48h", key: "48h", hours: 48 },
  { label: "7d",  key: "7d",  hours: 168 },
  { label: "All", key: "all" },
  { label: "Custom…", key: "custom" },
];

function toLocalInput(d: Date | null): string {
  if (!d) return "";
  // datetime-local value needs "YYYY-MM-DDTHH:mm"
  const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  return iso;
}

function fromLocalInput(s: string): Date | null {
  if (!s) return null;
  return new Date(s);
}

export function resolveRange(range: TimeRange): { from: Date | null; to: Date | null } {
  return { from: range.from, to: range.to };
}

/** Returns the active preset key based on current range, or 'custom' */
function detectPreset(range: TimeRange): Preset {
  if (range.from === null && range.to === null) return "all";
  if (range.to !== null) return "custom";
  if (range.from === null) return "all";
  const diffH = (Date.now() - range.from.getTime()) / 3600000;
  for (const p of PRESETS) {
    if (p.hours && Math.abs(diffH - p.hours) < 0.1) return p.key;
  }
  return "custom";
}

export default function TimeRangeFilter({ value, onChange }: Props) {
  const [showCustom, setShowCustom] = useState(false);
  const active = detectPreset(value);

  const applyPreset = useCallback(
    (p: typeof PRESETS[number]) => {
      if (p.key === "custom") {
        setShowCustom(true);
        return;
      }
      setShowCustom(false);
      if (p.key === "all") {
        onChange({ from: null, to: null });
      } else {
        const from = new Date(Date.now() - (p.hours! * 3600000));
        onChange({ from, to: null });
      }
    },
    [onChange]
  );

  function handleFromChange(s: string) {
    onChange({ from: fromLocalInput(s), to: value.to });
  }
  function handleToChange(s: string) {
    onChange({ from: value.from, to: fromLocalInput(s) });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
      {/* Preset pills */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--color-text-muted)", marginRight: 4, whiteSpace: "nowrap" }}>
          Time range:
        </span>
        {PRESETS.map((p) => {
          const isActive = p.key === "custom" ? showCustom : (active === p.key && !showCustom);
          return (
            <button
              key={p.key}
              onClick={() => applyPreset(p)}
              style={{
                padding: "4px 12px",
                borderRadius: 99,
                border: "1px solid",
                borderColor: isActive ? "#f68a6b" : "var(--color-border)",
                background: isActive ? "#f68a6b" : "var(--color-surface)",
                color: isActive ? "#fef6f0" : "var(--color-text)",
                fontSize: 12,
                fontWeight: isActive ? 700 : 400,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Custom pickers */}
      {showCustom && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 12, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>From:</label>
            <input
              type="datetime-local"
              value={toLocalInput(value.from)}
              onChange={(e) => handleFromChange(e.target.value)}
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                fontSize: 12,
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <label style={{ fontSize: 12, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>To:</label>
            <input
              type="datetime-local"
              value={toLocalInput(value.to)}
              onChange={(e) => handleToChange(e.target.value)}
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                fontSize: 12,
              }}
            />
          </div>
          {(value.from || value.to) && (
            <button
              onClick={() => { onChange({ from: null, to: null }); setShowCustom(false); }}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid var(--color-border)",
                background: "transparent",
                color: "var(--color-text-muted)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
