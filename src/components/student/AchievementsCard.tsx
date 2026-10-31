import { Flame } from "lucide-react";
import { ACHIEVEMENTS, type AchievementStats } from "@/lib/achievements";

/**
 * Student achievements: a badge grid where unlocked milestones glow gold
 * and locked ones show their requirement as the next goal. Streak lives in
 * the header — personal pace, never a comparison to classmates.
 */
export function AchievementsCard({
  stats,
  level,
  className = "",
}: {
  stats: AchievementStats;
  level: number;
  className?: string;
}) {
  const evaluated = ACHIEVEMENTS.map((def) => {
    const have = def.levelGate ? level : def.have(stats);
    const need = def.levelGate ?? def.need;
    return { ...def, unlocked: have >= need, progressText: `${def.requirement} (${Math.min(have, need)}/${need})` };
  });
  const unlockedCount = evaluated.filter((a) => a.unlocked).length;

  return (
    <section
      className={`rounded-card border border-ink-200/70 bg-warm-ivory p-5 shadow-soft dark:border-ink-800/70 dark:bg-ink-900 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
          Achievements
        </h2>
        {stats.current_streak > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-warm-brick/10 px-2.5 py-1 text-xs font-bold text-warm-brick dark:bg-warm-brick/15 dark:text-brick-light"
            title="Consecutive days with at least one award"
          >
            <Flame className="h-3.5 w-3.5" aria-hidden />
            {stats.current_streak}-day streak
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs text-ink-400 dark:text-ink-500">
        {unlockedCount} of {evaluated.length} unlocked
      </p>

      <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {evaluated.map((a) => {
          const Icon = a.icon;
          return (
            <li
              key={a.id}
              title={a.progressText}
              className={`flex flex-col items-center gap-1.5 rounded-card border p-2.5 text-center transition-colors ${
                a.unlocked
                  ? "border-deep-gold/30 bg-ivory-dim dark:border-antique-gold/30 dark:bg-antique-gold/10"
                  : "border-dashed border-ink-200 opacity-70 dark:border-ink-700"
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full ${
                  a.unlocked
                    ? "bg-obsidian text-antique-gold dark:bg-antique-gold dark:text-obsidian"
                    : "bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500"
                }`}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span
                className={`text-[10px] font-bold leading-tight ${
                  a.unlocked ? "text-deep-gold dark:text-antique-gold" : "text-ink-400 dark:text-ink-500"
                }`}
              >
                {a.title}
              </span>
              <span className="text-[9px] leading-tight text-ink-400 dark:text-ink-600">
                {a.progressText}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
