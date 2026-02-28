"use client";

import dynamic from "next/dynamic";
import type { Article } from "@/lib/types";
import type { NumberedAttack } from "./AttackMap";

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

interface AttackMapClientProps {
  numberedAttacks: NumberedAttack[];
  selectedId: string | null;
  onSelectAttack: (id: string) => void;
  onScrollToCard: (id: string) => void;
}

export default function AttackMapClient({
  numberedAttacks,
  selectedId,
  onSelectAttack,
  onScrollToCard,
}: AttackMapClientProps) {
  return (
    <AttackMap
      numberedAttacks={numberedAttacks}
      selectedId={selectedId}
      onSelectAttack={onSelectAttack}
      onScrollToCard={onScrollToCard}
    />
  );
}
