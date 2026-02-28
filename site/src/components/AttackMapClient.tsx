"use client";

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
      Loading map…
    </div>
  ),
});

export default function AttackMapClient({ attacks }: { attacks: Article[] }) {
  return <AttackMap attacks={attacks} />;
}
