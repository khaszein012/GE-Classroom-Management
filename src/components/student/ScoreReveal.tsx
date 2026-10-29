import { useEffect, useMemo, useState } from "react";
import { ArrowRight, PartyPopper } from "lucide-react";
import { useCountUp } from "@/lib/useCountUp";
import { CurrencyIcon } from "@/components/CurrencyAmount";
import type { CurrencySettings } from "@/types";

const CONFETTI_COLORS = [
  "bg-antique-gold",
  "bg-deep-gold",
  "bg-warm-brick",
  "bg-brick-light",
  "bg-ink-500",
];

/** Hand-rolled CSS confetti in theme colors — no dependencies, honors
 *  prefers-reduced-motion by not rendering at all. */
function Confetti({ count = 90 }: { count?: number }) {
  const [motionOk] = useState(
    () => typeof window === "undefined" || !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2.2 + Math.random() * 1.8,
        size: 6 + Math.random() * 7,
        rot: `${Math.random() > 0.5 ? "" : "-"}${240 + Math.round(Math.random() * 480)}deg`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: Math.random() > 0.5,
      })),
    [count],
  );
  if (!motionOk) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={`absolute top-0 block ${p.color} ${p.round ? "rounded-full" : "rounded-[1px]"}`}
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.round ? p.size : p.size * 0.55,
              animation: `confetti-fall ${p.duration}s linear ${p.delay}s forwards`,
              "--rot": p.rot,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

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
