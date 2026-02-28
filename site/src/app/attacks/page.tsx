import Header from "@/components/Header";
import AttackMonitor from "@/components/AttackMonitor";
import { getAttackArticles, getThreatLevel } from "@/lib/data";

export default function AttacksPage() {
  const attackArticles = getAttackArticles();
  const threatLevel = getThreatLevel();

  return (
    <>
      <Header
        threatLevel={threatLevel}
        updatedAt={threatLevel.updated_at}
      />
      <main
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "24px 24px 48px",
        }}
      >
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            marginBottom: 20,
          }}
        >
          Attack Monitor
        </h2>
        <AttackMonitor
          attackArticles={attackArticles}
          threatLevel={threatLevel}
        />
      </main>
    </>
  );
}
