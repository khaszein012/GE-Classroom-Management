import { useEffect } from "react";
import { ArrowRight, PartyPopper } from "lucide-react";
import { useCountUp } from "@/lib/useCountUp";
import { CurrencyIcon } from "@/components/CurrencyAmount";
import type { CurrencySettings } from "@/types";
import { Confetti } from "@/components/student/Confetti";

/**
 * The celebration between submitting a quiz and the detailed review:
 * animated score count-up, confetti, and the gems earned. Auto-advances to
 * the review after a few seconds; the button skips ahead.
 */
export function ScoreReveal({
  title,
  correctCount,
  totalCount,
  gemsAwarded,
  gems,
  onDone,
}: {
  title: string;
  correctCount: number;
  totalCount: number;
  gemsAwarded: number;
  gems: CurrencySettings;
  onDone: () => void;
}) {
  const animatedCorrect = useCountUp(correctCount, 900);
  const animatedGems = useCountUp(gemsAwarded, 1100);
  const pct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  // Auto-advance so the moment stays a moment, not a dead end.
  useEffect(() => {
    const t = setTimeout(onDone, 4200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden px-5 py-10 text-center">
      <Confetti />
      <div className="relative z-10 flex flex-col items-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ivory-dim text-deep-gold shadow-soft dark:bg-antique-gold/10 dark:text-antique-gold">
          <PartyPopper className="h-8 w-8" aria-hidden />
        </span>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
          Quiz complete
        </p>
        <h1 className="mt-1 max-w-sm truncate font-display text-2xl font-semibold text-ink-900 dark:text-warm-ivory">
          {title}
        </h1>

        <p className="mt-6 font-mono text-7xl font-extrabold tabular-nums leading-none tracking-tight text-ink-900 dark:text-warm-ivory sm:text-8xl">
          {animatedCorrect}
          <span className="text-ink-300 dark:text-ink-600">/{totalCount}</span>
        </p>
        <p className="mt-2 font-mono text-sm font-semibold tabular-nums text-ink-500 dark:text-ink-400">
          {pct}% correct
        </p>

        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-ivory-dim px-5 py-2.5 text-lg font-bold text-deep-gold shadow-soft dark:bg-antique-gold/10 dark:text-antique-gold">
          <CurrencyIcon name={gems.icon} className="h-5 w-5" aria-hidden />
          <span className="font-mono tabular-nums">+{animatedGems}</span>
          <span>{gemsAwarded === 1 ? gems.singular : gems.plural}</span>
        </div>

        <button
          onClick={onDone}
          className="mt-8 flex min-h-11 items-center gap-2 rounded-button bg-obsidian px-5 py-2.5 text-sm font-bold text-warm-ivory transition-colors hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-offset-2 dark:bg-antique-gold dark:text-obsidian dark:hover:bg-deep-gold dark:focus-visible:ring-offset-ink-950"
        >
          See my review
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
