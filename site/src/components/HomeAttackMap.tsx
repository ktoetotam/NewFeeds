"use client";

import { useMemo, useState, useCallback } from "react";
import AttackMapClient from "./AttackMapClient";
import type { Article } from "@/lib/types";
import type { NumberedAttack } from "./AttackMap";

/**
 * Lightweight wrapper for the homepage map.
 * Shows numbered markers but without the list interaction.
 */
export default function HomeAttackMap({ attacks }: { attacks: Article[] }) {
  const numberedAttacks: NumberedAttack[] = useMemo(() => {
    let mapNum = 0;
    return attacks
      .filter((a) => a.lat != null && a.lng != null && a.classification?.is_attack)
      .map((a) => ({ attack: a, index: ++mapNum }));
  }, [attacks]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const handleSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const noop = useCallback(() => {}, []);

  return (
    <AttackMapClient
      numberedAttacks={numberedAttacks}
      selectedId={selectedId}
      onSelectAttack={handleSelect}
      onScrollToCard={noop}
    />
  );
}
