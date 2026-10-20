import type { Student, PointTransaction } from "@/types";

export type SortMode =
  | "name-asc"
  | "name-desc"
  | "balance-high"
  | "balance-low"
  | "recent"
  | "needs-pin";

export const SORT_LABELS: Record<SortMode, string> = {
  "name-asc": "Name A–Z",
  "name-desc": "Name Z–A",
  "balance-high": "Balance, highest first",
  "balance-low": "Balance, lowest first",
  "recent": "Recently active",
  "needs-pin": "Needs PIN first",
};

const STORAGE_KEY = "teacher-sort-mode";

export function loadSortMode(): SortMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && v in SORT_LABELS) return v as SortMode;
  } catch {
    // localStorage may be unavailable
  }
  return "name-asc";
}

export function saveSortMode(mode: SortMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

/**
 * Sort students by the chosen mode. `totals` maps studentId → balance.
 * `transactions` is used for the "recently active" sort (most recent
 * transaction first).
 */
export function sortStudents(
  students: Student[],
  mode: SortMode,
  totals: Record<string, number>,
  transactions: PointTransaction[],
): Student[] {
  const sorted = [...students];

  switch (mode) {
    case "name-asc":
      return sorted.sort((a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }),
      );

    case "name-desc":
      return sorted.sort((a, b) =>
        b.displayName.localeCompare(a.displayName, undefined, { sensitivity: "base" }),
      );

    case "balance-high":
      return sorted.sort(
        (a, b) => (totals[b.id] ?? 0) - (totals[a.id] ?? 0),
      );

    case "balance-low":
      return sorted.sort(
        (a, b) => (totals[a.id] ?? 0) - (totals[b.id] ?? 0),
      );

    case "needs-pin":
      return sorted.sort((a, b) => {
        if (a.hasPin !== b.hasPin) return a.hasPin ? 1 : -1;
        return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
      });

    case "recent": {
      const lastTxByStudent = new Map<string, number>();
      for (const t of transactions) {
        const prev = lastTxByStudent.get(t.studentId) ?? 0;
        if (t.createdAt > prev) lastTxByStudent.set(t.studentId, t.createdAt);
      }
      return sorted.sort((a, b) => {
        const ta = lastTxByStudent.get(a.id) ?? 0;
        const tb = lastTxByStudent.get(b.id) ?? 0;
        if (tb !== ta) return tb - ta;
        return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
      });
    }

    default:
      return sorted;
  }
}
