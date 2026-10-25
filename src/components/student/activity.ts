import type { PointTransaction } from "@/types";

/** A collapsed run: consecutive same-reason entries from the same day. */
export interface ActivityGroup {
  key: string;
  dayLabel: string;
  entries: CollapsedEntry[];
}

export interface CollapsedEntry {
  id: string;
  reason: string;
  total: number;
  count: number;
  /** Individual transaction timestamps within the run (newest first). */
  timestamps: number[];
  /** Newest transaction id in the run — used for slide-in detection. */
  newestId: string;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dayLabel(ts: number): string {
  const today = startOfDay(Date.now());
  const day = startOfDay(ts);
  const diffDays = Math.round((today - day) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  const d = new Date(ts);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

/**
 * Group transactions by day and collapse consecutive same-reason entries
 * into a single row with a count. Transactions must be newest-first.
 */
export function buildActivityGroups(transactions: PointTransaction[]): ActivityGroup[] {
  const groups: ActivityGroup[] = [];
  let currentDay: string | null = null;
  let currentEntries: CollapsedEntry[] = [];

  const flush = () => {
    if (currentDay !== null && currentEntries.length > 0) {
      groups.push({ key: currentDay, dayLabel: currentDay, entries: currentEntries });
    }
    currentEntries = [];
  };

  for (const t of transactions) {
    const label = dayLabel(t.createdAt);
    if (label !== currentDay) {
      flush();
      currentDay = label;
    }
    const reason = t.reason || (t.amount >= 0 ? "Award" : "Deduction");
    const last = currentEntries[currentEntries.length - 1];
    if (last && last.reason === reason) {
      last.total += t.amount;
      last.count += 1;
      last.timestamps.push(t.createdAt);
      last.newestId = last.newestId || t.id;
    } else {
      currentEntries.push({
        id: t.id,
        reason,
        total: t.amount,
        count: 1,
        timestamps: [t.createdAt],
        newestId: t.id,
      });
    }
  }
  flush();

  return groups;
}

/** Weekly totals for the trend stats, and daily totals for the chart.
 *  Achievement (gems) rows are excluded: the trend tracks the behavior
 *  currency only. */
export function buildTrend(transactions: PointTransaction[]): {
  thisWeek: number;
  lastWeek: number;
  changePct: number | null;
  daily: { label: string; total: number; isToday: boolean }[];
} {
  const now = Date.now();
  const today = startOfDay(now);
  const thisWeekStart = today - 6 * 86_400_000;
  const lastWeekStart = today - 13 * 86_400_000;

  let thisWeek = 0;
  let lastWeek = 0;
  const dailyTotals = new Map<number, number>();
  for (let i = 0; i < 14; i++) dailyTotals.set(today - i * 86_400_000, 0);

  for (const t of transactions) {
    if (t.isUndone || t.amount < 0 || t.type === "achievement") continue;
    const day = startOfDay(t.createdAt);
    if (day >= thisWeekStart) thisWeek += t.amount;
    else if (day >= lastWeekStart) lastWeek += t.amount;
    if (dailyTotals.has(day)) dailyTotals.set(day, (dailyTotals.get(day) ?? 0) + t.amount);
  }

  const daily: { label: string; total: number; isToday: boolean }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = today - i * 86_400_000;
    const d = new Date(day);
    daily.push({
      label: i === 0 ? "Now" : `${d.getDate()}`,
      total: dailyTotals.get(day) ?? 0,
      isToday: i === 0,
    });
  }

  const changePct =
    lastWeek === 0 ? (thisWeek > 0 ? null : 0) : Math.round(((thisWeek - lastWeek) / lastWeek) * 100);

  return { thisWeek, lastWeek, changePct, daily };
}
