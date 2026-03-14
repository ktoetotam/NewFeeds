import type { Metadata } from "next";
import SummaryClient from "@/components/SummaryClient";

export const metadata: Metadata = {
  title: "Executive Summary",
  description:
    "AI-powered executive summaries of current conflict developments — threat trends, key events, and regional analysis across all monitored zones.",
  alternates: { canonical: "/summary" },
};

export default function SummaryPage() {
  return <SummaryClient />;
}
