import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ActivityGroup } from "@/components/student/activity";
import { relativeTime } from "@/lib/time";

type Filter = "all" | "earned" | "spent";

/**
 * Day-grouped, run-collapsed activity list. Pure presentation; receives
 * already-paginated transactions. The list grows with its content and the
 * page scrolls it — length is capped by pagination ("Load more"), never by
 * a fixed height with an inner scrollbar.
 */
export function ActivityList({ groups, hasMore, loadingMore, onLoadMore }: {
  groups: ActivityGroup[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const visible = groups
    .map((g) => ({
      ...g,
      entries: g.entries.filter((e) =>
        filter === "all" ? true : filter === "earned" ? e.total >= 0 : e.total < 0,
      ),
    }))
    .filter((g) => g.entries.length > 0);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
          Activity
        </h2>
        <div className="flex gap-1">
          {(["all", "earned", "spent"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-button px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                filter === f
                  ? "bg-obsidian dark:bg-antique-gold dark:text-obsidian text-warm-ivory"
                  : "bg-ink-100 text-ink-500 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-400 dark:hover:bg-ink-700"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div>
        {visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-400 dark:text-ink-500">
            No activity yet. Awards and deductions will appear here.
          </p>
        ) : (
          visible.map((g) => (
            <div key={g.key} className="mt-4 first:mt-2">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-600">
                {g.dayLabel}
              </p>
              <ul className="divide-y divide-ink-100 overflow-hidden rounded-card border border-ink-200/70 bg-warm-ivory dark:divide-ink-800 dark:border-ink-800/70 dark:bg-ink-900">
                {g.entries.map((e) => (
                  <ActivityRow key={e.id} entry={e} />
                ))}
              </ul>
            </div>
          ))
        )}

        {hasMore && visible.length > 0 && (
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="mt-4 w-full rounded-button border border-ink-200 py-2.5 text-sm font-semibold text-ink-600 transition-colors hover:bg-ink-50 disabled:opacity-60 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        )}
      </div>
    </div>
  );
}

function ActivityRow({ entry }: { entry: ActivityGroup["entries"][number] }) {
  const [expanded, setExpanded] = useState(false);
  const positive = entry.total >= 0;

  return (
    <li
      style={{ animation: "rowSlideIn 0.3s ease" }}
      className="px-4 py-3"
      data-newest={entry.newestId}
    >
      <button
        onClick={() => entry.count > 1 && setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
        aria-expanded={entry.count > 1 ? expanded : undefined}
      >
        <span
          className={`shrink-0 text-sm font-bold tabular-nums ${
            positive
              ? "text-deep-gold dark:text-antique-gold"
              : "text-warm-brick/80 dark:text-brick-light/80"
          }`}
        >
          {positive ? "+" : ""}
          {entry.total}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-ink-700 dark:text-ink-200">
          {entry.reason}
          {entry.count > 1 && <span className="ml-1.5 text-xs font-semibold text-ink-400 dark:text-ink-500">×{entry.count}</span>}
        </span>
        <span className="shrink-0 text-xs text-ink-400 dark:text-ink-500">
          {relativeTime(entry.timestamps[0])}
        </span>
        {entry.count > 1 && (
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-ink-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {expanded && entry.count > 1 && (
        <ul className="mt-2 space-y-1 border-l-2 border-ink-100 pl-3 dark:border-ink-800">
          {entry.timestamps.map((ts, i) => (
            <li key={i} className="text-xs text-ink-400 dark:text-ink-500">
              {new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
