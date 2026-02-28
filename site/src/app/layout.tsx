import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Iran & Region Monitor",
  description:
    "Real-time monitoring of state media from Iran, Russia, Israel, Gulf States, and proxy actors with English translations and attack tracking.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Auto-refresh every 5 minutes to pick up new data */}
        <meta httpEquiv="refresh" content="300" />
      </head>
      <body>{children}</body>
    </html>
  );
}
