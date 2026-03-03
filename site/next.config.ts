import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // NEXT_PUBLIC_BASE_PATH="/NewFeeds" for GitHub Pages; leave empty for Cloudflare Pages
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
