import Header from "@/components/Header";
import NewsFeed from "@/components/NewsFeed";
import {
  getArticlesByRegion,
  getThreatLevel,
} from "@/lib/data";
import type { RegionKey } from "@/lib/types";

export default function HomePage() {
  const regions: RegionKey[] = ["iran", "russia", "israel", "gulf", "proxies"];
  const articlesByRegion: Record<string, ReturnType<typeof getArticlesByRegion>> = {};

  for (const region of regions) {
    articlesByRegion[region] = getArticlesByRegion(region);
  }

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
          padding: "0 24px 48px",
        }}
      >
        <NewsFeed articlesByRegion={articlesByRegion} />
      </main>
    </>
  );
}
