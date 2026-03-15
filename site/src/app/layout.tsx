import type { Metadata, Viewport } from "next";
import "./globals.css";
import AutoRefresh from "@/components/AutoRefresh";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://newfeeds.pages.dev";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "AI Realist Iran Monitor — Live Middle East Conflict Feed and Briefing",
    template: "%s | AI Realist Iran Monitor",
  },
  description:
    "Live Middle East conflict feed and briefing by AI Realist. 120+ sources across Iran, Russia, Israel, Gulf States, China, and proxy actors. AI-translated news, attack tracking, threat levels, and intelligence briefings.",
  keywords: [
    "Iran news", "Russia news", "Israel news", "Middle East conflict",
    "war monitor", "military events", "threat level", "OSINT",
    "state media", "attack tracker", "security monitor", "conflict tracker",
    "Gaza", "Ukraine", "China", "South Asia", "executive briefing",
  ],
  authors: [{ name: "NewFeeds" }],
  openGraph: {
    type: "website",
    siteName: "AI Realist Iran Monitor",
    title: "AI Realist Iran Monitor — Live Middle East Conflict Feed and Briefing",
    description:
      "Live Middle East conflict feed and briefing by AI Realist. AI-translated news, attack tracking, threat levels, and intelligence briefings.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Realist Iran Monitor — Live Middle East Conflict Feed and Briefing",
    description:
      "Live Middle East conflict feed and briefing by AI Realist. AI-translated news, attack tracking, threat levels, and intelligence briefings.",
  },
  verification: {
    google: "y0xlZYjwDHehVW24-AoixCUYaT50XRVX8KUQaKBX_H0",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "NewFeeds",
    url: siteUrl,
    description:
      "Real-time monitoring of 120+ news sources across Iran, Russia, Israel, Gulf States, China, and proxy actors. AI-translated news, attack tracking, DEFCON-style threat levels, and intelligence briefings.",
    potentialAction: {
      "@type": "SearchAction",
      target: siteUrl,
    },
  };

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN && (
          <script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={`{"token": "${process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN}"}`}
          />
        )}
      </head>
      <body>
        <AutoRefresh />
        {children}
      </body>
    </html>
  );
}
