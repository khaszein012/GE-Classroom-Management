import { Award, TrendingUp, Users } from "lucide-react";
import { useCountUp } from "@/lib/useCountUp";
import { useCurrency } from "@/components/CurrencyProvider";
import { CurrencyIcon } from "@/components/CurrencyAmount";

/**
 * The teacher's "today" bar: a Cormorant-set greeting and date on the left,
 * today's class numbers inline on the right. One panel instead of four
 * identical boxes — the dashboard's face.
 */
export function StatStrip({
  pointsToday,
  awardsToday,
  classTotal,
  classAverage,
  studentCount,
}: {
  pointsToday: number;
  awardsToday: number;
  classTotal: number;
  classAverage: number;
  studentCount: number;
}) {
  const { config } = useCurrency();
  const behavior = config.behavior;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="overflow-hidden rounded-card border border-ink-200/70 bg-warm-ivory shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-0 sm:p-6">
        {/* Greeting + date */}
        <div className="shrink-0 border-b border-ink-100 pb-4 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-8 dark:border-ink-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
            {greeting}
          </p>
          <p className="mt-1 font-display text-2xl font-semibold leading-tight text-ink-900 dark:text-warm-ivory sm:text-[28px]">
            {dateStr}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-ink-400 dark:text-ink-500">
            <Users className="h-3.5 w-3.5" aria-hidden />
            {studentCount} {studentCount === 1 ? "student" : "students"}
          </p>
        </div>

        {/* Stats */}
        <div className="grid flex-1 grid-cols-2 gap-5 sm:grid-cols-4 sm:pl-8">
          <MiniStat
            icon={<CurrencyIcon name={behavior.icon} className="h-4 w-4" />}
            value={pointsToday}
            label={`${behavior.plural} today`}
          />
          <MiniStat icon={<Award className="h-4 w-4" />} value={awardsToday} label="Awards" />
          <MiniStat
            icon={<TrendingUp className="h-4 w-4" />}
            value={classTotal}
            label="Class total"
          />
          <MiniStat
            icon={<Users className="h-4 w-4" />}
            value={studentCount === 0 ? 0 : classAverage}
            decimals={1}
            label="Average"
          />
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  value,
  label,
  decimals,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  decimals?: number;
}) {
  const scaled = decimals ? Math.round(value * 10 ** decimals) : value;
  const animated = useCountUp(scaled);
  const display = decimals ? animated / 10 ** decimals : animated;

  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ivory-dim text-deep-gold dark:bg-antique-gold/10 dark:text-antique-gold">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="whitespace-nowrap font-mono text-xl font-bold tabular-nums leading-tight text-ink-900 dark:text-warm-ivory">
          {display}
        </div>
        <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
          {label}
        </div>
      </div>
    </div>
  );
}
