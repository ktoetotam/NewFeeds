/**
 * Shared utility functions that work in both server and client components.
 * No Node.js-specific imports (fs, path, etc.) here.
 */

export function formatTimeAgo(isoDate: string, fetchedAt?: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  if (isNaN(then)) return "Unknown";

  const diffMs = now - then;
  // If published is in the future, fall back to fetched_at
  const effectiveMs = diffMs < 0 && fetchedAt
    ? now - new Date(fetchedAt).getTime()
    : diffMs;
  const minutes = Math.floor(effectiveMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString();
}
