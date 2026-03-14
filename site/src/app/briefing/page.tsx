import type { Metadata } from "next";
import BriefingClient from "@/components/BriefingClient";

export const metadata: Metadata = {
  title: "Intelligence Briefing",
  description:
    "AI-generated NATO SITREP-style intelligence briefings covering active conflict zones — operational impacts, escalation risks, and de-escalation pathways.",
  alternates: { canonical: "/briefing" },
};

export default function BriefingPage() {
  return <BriefingClient />;
}
