import { getArchivedSummary, getArchiveIndex } from "@/lib/data";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const decoded = decodeURIComponent(filename);

  const summary = getArchivedSummary(decoded);
  if (!summary) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(JSON.stringify(summary, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${decoded}"`,
    },
  });
}

export function generateStaticParams() {
  const archives = getArchiveIndex();
  return archives.map((entry) => ({
    filename: entry.filename,
  }));
}
