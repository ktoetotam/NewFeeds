import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

// Serves all feed articles from data/feeds/*.json
// Used as a local fallback when Supabase is unavailable.

const DATA_DIR = path.resolve(process.cwd(), "../data/feeds");

export async function GET() {
  try {
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
    const all: unknown[] = [];
    for (const file of files) {
      const region = file.replace(".json", "");
      const raw = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
      let articles: Record<string, unknown>[] = [];
      try {
        articles = JSON.parse(raw);
      } catch {
        continue;
      }
      for (const a of articles) {
        all.push({ ...a, region });
      }
    }
    return NextResponse.json(all);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
