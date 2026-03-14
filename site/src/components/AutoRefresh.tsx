"use client";

import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export default function AutoRefresh() {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.reload();
    }, REFRESH_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
