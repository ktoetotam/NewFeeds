import Header from "@/components/Header";
import NewsFeed from "@/components/NewsFeed";
import {
  getArticlesByRegion,
  getAttackArticles,
  getThreatLevel,
} from "@/lib/data";
import type { RegionKey } from "@/lib/types";
import HomeAttackMap from "@/components/HomeAttackMap";

export default function HomePage() {
  const regions: RegionKey[] = ["iran", "russia", "israel", "gulf", "proxies"];
  const articlesByRegion: Record<string, ReturnType<typeof getArticlesByRegion>> = {};

  for (const region of regions) {
    articlesByRegion[region] = getArticlesByRegion(region);
  }

  const threatLevel = getThreatLevel();
  const attacks = getAttackArticles();

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
          padding: "0 24px 48px",
        }}
      >
        {/* Attack Map */}
        <section style={{ marginBottom: 40 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            🗺️ Attack Events Map
            <span
              style={{
                fontSize: 13,
                fontWeight: 400,
                color: "var(--color-text-muted)",
              }}
            >
              — last {attacks.length} classified incidents
            </span>
          </h2>
          <HomeAttackMap attacks={attacks} />
          {/* Legend */}
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 10,
              flexWrap: "wrap",
              fontSize: 12,
              color: "var(--color-text-muted)",
            }}
          >
            {[
              { label: "Major", color: "#ef4444" },
              { label: "High", color: "#f97316" },
              { label: "Medium", color: "#eab308" },
              { label: "Low", color: "#22c55e" },
            ].map(({ label, color }) => (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: color,
                    display: "inline-block",
                  }}
                />
                {label}
              </span>
            ))}
          </div>
        </section>

        <NewsFeed articlesByRegion={articlesByRegion} />
      </main>
    </>
  );
}
