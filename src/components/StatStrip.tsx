import { Award, TrendingUp, Users } from "lucide-react";
import { useCountUp } from "@/lib/useCountUp";
import { useCurrency } from "@/components/CurrencyProvider";
import { CurrencyAmount, CurrencyIcon } from "@/components/CurrencyAmount";

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
  // Keep the currency name on the first label only when it comfortably fits.
  const todayLabel = behavior.plural.length <= 8 ? `${behavior.plural} today` : "Today";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
      <StatCard
        label={todayLabel}
        icon={<CurrencyIcon name={behavior.icon} className="h-4 w-4" />}
        value={pointsToday}
        currency
      />
      <StatCard label="Awards" icon={<Award className="h-4 w-4" />} value={awardsToday} />
      <StatCard label="Class total" icon={<TrendingUp className="h-4 w-4" />} value={classTotal} currency />
      <StatCard
        label="Average"
        icon={<Users className="h-4 w-4" />}
        value={studentCount === 0 ? 0 : classAverage}
        decimals={1}
        currency
      />
    </div>
  );
}

function StatCard({
  label,
  icon,
  value,
  decimals,
  currency = false,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  decimals?: number;
  currency?: boolean;
}) {
  const scaled = decimals ? Math.round(value * 10 ** decimals) : value;
  const animated = useCountUp(scaled);
  const display = decimals ? animated / 10 ** decimals : animated;

  return (
    <div className="relative rounded-card border border-ink-200/70 bg-warm-ivory px-4 py-3 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
      {/* Decorative icon pinned to the top-right corner, out of the text flow */}
      <div className="pointer-events-none absolute right-3 top-3 text-ink-300/60 dark:text-ink-600/60">
        {icon}
      </div>
      <div className="pr-7">
        <div className="text-[11px] font-semibold uppercase leading-tight tracking-tight text-ink-400 dark:text-ink-500">
          {label}
        </div>
        <div className="mt-1 whitespace-nowrap text-2xl font-bold tabular-nums text-ink-900 dark:text-warm-ivory">
          {currency ? (
            <CurrencyAmount amount={display} variant="compact" iconClassName="h-5 w-5" />
          ) : (
            display
          )}
        </div>
      </div>
    </div>
  );
}
