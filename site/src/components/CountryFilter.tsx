"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  available: string[];
  selected: string[];
  onChange: (countries: string[]) => void;
}

export default function CountryFilter({ available, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function toggle(country: string) {
    if (selected.includes(country)) {
      onChange(selected.filter((c) => c !== country));
    } else {
      onChange([...selected, country]);
    }
  }

  const label =
    selected.length === 0
      ? "Countries"
      : selected.length === 1
      ? selected[0]
      : `${selected.length} countries`;

  const isActive = selected.length > 0;
  const noData = available.length === 0;

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      {/* Trigger */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
          Countries:
        </span>
        <button
          onClick={() => !noData && setOpen((o) => !o)}
          disabled={noData}
          style={{
            padding: "4px 12px",
            borderRadius: 99,
            border: "1px solid",
            borderColor: isActive ? "#f68a6b" : "var(--color-border)",
            background: isActive ? "#f68a6b" : "var(--color-surface)",
            color: isActive ? "#fef6f0" : noData ? "var(--color-text-muted)" : "var(--color-text)",
            fontSize: 12,
            fontWeight: isActive ? 700 : 400,
            cursor: noData ? "default" : "pointer",
            opacity: noData ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
          }}
        >
          {noData ? "Countries (no data)" : label}
          {!noData && <span style={{ fontSize: 10, opacity: 0.8 }}>{open ? "▲" : "▼"}</span>}
        </button>
        {isActive && (
          <button
            onClick={() => onChange([])}
            style={{
              padding: "4px 8px",
              borderRadius: 99,
              border: "1px solid var(--color-border)",
              background: "transparent",
              color: "var(--color-text-muted)",
              fontSize: 11,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 100,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            boxShadow: "0 4px 20px rgba(91,66,48,0.12)",
            minWidth: 200,
            maxHeight: 320,
            overflowY: "auto",
            padding: "6px 0",
          }}
        >
          {/* Select / Deselect all */}
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "4px 12px 8px",
              borderBottom: "1px solid var(--color-border)",
              marginBottom: 4,
            }}
          >
            <button
              onClick={() => onChange([...available])}
              style={{
                background: "none",
                border: "none",
                color: "#f68a6b",
                fontSize: 11,
                cursor: "pointer",
                padding: 0,
              }}
            >
              All
            </button>
            <button
              onClick={() => onChange([])}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-text-muted)",
                fontSize: 11,
                cursor: "pointer",
                padding: 0,
              }}
            >
              None
            </button>
          </div>

          {/* Country rows */}
          {available.map((country) => {
            const checked = selected.includes(country);
            return (
              <label
                key={country}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 14px",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "var(--color-text)",
                  background: checked ? "rgba(246,138,107,0.08)" : "transparent",
                  userSelect: "none",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = checked
                    ? "rgba(246,138,107,0.14)"
                    : "rgba(91,66,48,0.04)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background = checked
                    ? "rgba(246,138,107,0.08)"
                    : "transparent")
                }
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(country)}
                  style={{ accentColor: "#f68a6b", width: 14, height: 14, cursor: "pointer" }}
                />
                {country}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
