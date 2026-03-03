import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

const FILE = path.resolve(process.cwd(), "../data/executive_summary.json");

export async function GET() {
  try {
    const raw = fs.readFileSync(FILE, "utf-8");
    // Wrap to match the Supabase row shape { data: ... }
    return NextResponse.json({ data: JSON.parse(raw) });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
