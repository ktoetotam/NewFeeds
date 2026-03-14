import type { Metadata } from "next";
import AttacksClient from "@/components/AttacksClient";

export const metadata: Metadata = {
  title: "Attack Monitor",
  description:
    "Real-time tracking of military attacks and incidents across the Middle East, Eastern Europe, and South Asia — severity-classified and geocoded on an interactive map.",
  alternates: { canonical: "/attacks" },
};

export default function AttacksPage() {
  return <AttacksClient />;
}
