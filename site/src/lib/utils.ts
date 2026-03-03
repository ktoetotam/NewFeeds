/**
 * Shared utility functions that work in both server and client components.
 * No Node.js-specific imports (fs, path, etc.) here.
 */

export function formatTimeAgo(isoDate: string, fetchedAt?: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const fetchedMs = fetchedAt ? new Date(fetchedAt).getTime() : NaN;

  // Use fetched_at if published is missing/invalid or in the future
  const effectiveMs = (!isNaN(then) && then <= now)
    ? now - then
    : (!isNaN(fetchedMs) ? now - fetchedMs : NaN);

  if (isNaN(effectiveMs)) return "Unknown";

  const minutes = Math.floor(effectiveMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  const base = !isNaN(then) && then <= now ? isoDate : fetchedAt ?? isoDate;
  return new Date(base).toLocaleDateString();
}

export function formatFetchedAt(fetchedAt?: string): string {
  if (!fetchedAt) return "";
  const d = new Date(fetchedAt);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
