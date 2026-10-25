export function relativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(timestamp).toLocaleDateString();
}

/** Consistent date format used everywhere in the app. */
export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Date + time, used for quiz due dates. */
export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${d.toLocaleTimeString(
    [],
    { hour: "2-digit", minute: "2-digit" },
  )}`;
}

/** Relative future hint, e.g. "Due in 2 days" / "Due in 3 hours". */
export function relativeUntil(ts: number): string {
  const ms = ts - Date.now();
  if (ms <= 0) return "past due";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `in ${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `in ${days} ${days === 1 ? "day" : "days"}`;
  return `in ${Math.floor(days / 7)} weeks`;
}
