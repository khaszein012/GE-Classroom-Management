import { useMemo } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { CurrencyIcon } from "@/components/CurrencyAmount";
import type { buildTrend } from "@/components/student/activity";
import type { CurrencySettings } from "@/types";

/**
 * Minimal bar chart of points earned per day, last 14 days. No deps.
 * Uses background classes (bg-), not SVG fill utilities (fill-), so the
 * bars actually render. Always keeps a sensible baseline when all
 * activity is on one day (max falls back to a non-zero divisor).
 */
export function TrendChart({
  trend,
  currency,
}: {
  trend: ReturnType<typeof buildTrend>;
  currency: CurrencySettings;
}) {
  const bars = useMemo(() => {
    const max = Math.max(...trend.daily.map((d) => d.total), 1);
    return trend.daily.map((d) => ({ ...d, height: (d.total / max) * 100 }));
  }, [trend.daily]);

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        <TrendStat label="This week" value={trend.thisWeek} currency={currency} />
        <TrendStat label="Last week" value={trend.lastWeek} currency={currency} />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400 dark:text-ink-500">Change</p>
          <p
            className={`mt-0.5 flex items-center gap-1 text-sm font-bold tabular-nums ${
              trend.changePct === null
                ? "text-ink-500 dark:text-ink-400"
                : trend.changePct >= 0
                  ? "text-deep-gold dark:text-antique-gold"
                  : "text-warm-brick dark:text-brick-light"
            }`}
          >
            {trend.changePct === null ? (
              "—"
            ) : (
              <>
                {trend.changePct >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                {Math.abs(trend.changePct)}%
              </>
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 flex h-24 items-end gap-[3px] pr-2" role="img" aria-label="Points earned per day, last 14 days">
        {bars.map((b, i) => (
          <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <div
              className={`w-full rounded-sm transition-all ${
                b.total > 0 ? "bg-antique-gold dark:bg-antique-gold" : "bg-ink-200 dark:bg-ink-800"
              }`}
              style={{ height: `${Math.max(b.total > 0 ? b.height : 4, 4)}%` }}
              title={`${b.total > 0 ? `${b.total} earned` : "No points"} — ${b.label}`}
            />
            {/* Sparse axis: "Now" plus every other date, so labels never
                crowd or clip at any breakpoint. */}
            <span
              className={`whitespace-nowrap text-[9px] leading-none ${
                i % 2 === 0 || b.isToday
                  ? b.isToday
                    ? "font-bold text-deep-gold dark:text-antique-gold"
                    : "text-ink-400 dark:text-ink-600"
                  : "invisible"
              }`}
            >
              {b.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendStat({
  label,
  value,
  currency,
}: {
  label: string;
  value: number;
  currency: CurrencySettings;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400 dark:text-ink-500">{label}</p>
      <p className="mt-0.5 flex items-center gap-1 text-sm font-bold tabular-nums text-ink-800 dark:text-ink-100">
        <CurrencyIcon name={currency.icon} className={`h-3.5 w-3.5 ${ICON_COLORS[currency.color] ?? "text-deep-gold"}`} />
        {value}
      </p>
    </div>
  );
}

const ICON_COLORS: Record<string, string> = {
  amber: "text-deep-gold",
  violet: "text-deep-gold",
  emerald: "text-deep-gold",
  sky: "text-deep-gold",
  rose: "text-warm-brick",
  orange: "text-deep-gold",
  teal: "text-deep-gold",
  slate: "text-obsidian dark:text-warm-ivory",
};
