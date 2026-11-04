import { Check, Minus, Plus } from "lucide-react";
import { Monogram } from "@/components/Monogram";
import { useCountUp } from "@/lib/useCountUp";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { levelProgress } from "@/lib/levels";

interface Props {
  colorIndex: number;
  /** Premium avatar id; null/absent keeps the classic colour monogram. */
  avatarId?: string | null;
  name: string;
  total: number;
  lifetime: number;
  selected: boolean;
  pulsing: boolean;
  onClick: () => void;
  onQuickPlus?: () => void;
  onQuickMinus?: () => void;
}

export function StudentCard({
  colorIndex,
  avatarId,
  name,
  total,
  lifetime,
  selected,
  pulsing,
  onClick,
  onQuickPlus,
  onQuickMinus,
}: Props) {
  const animatedTotal = useCountUp(total);
  const level = levelProgress(lifetime);

  const pillClass =
    total > 0
      ? "bg-ivory-dim text-deep-gold dark:bg-antique-gold/15 dark:text-antique-gold"
      : total < 0
        ? "bg-warm-brick/10 text-warm-brick dark:bg-warm-brick/15 dark:text-brick-light"
        : "bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400";

  return (
    <button
      onClick={onClick}
      style={pulsing ? { animation: "cardPulse 0.8s ease" } : undefined}
      className={`group relative flex items-center gap-3 rounded-card border-2 bg-warm-ivory px-3 py-2.5 text-left shadow-soft transition-all duration-150 hover:-translate-y-0.5 hover:shadow-soft-md dark:bg-ink-900 ${
        selected
          ? "border-antique-gold bg-ivory-dim/40 dark:border-antique-gold dark:bg-antique-gold/5"
          : "border-transparent hover:border-ink-200 dark:hover:border-ink-700"
      }`}
    >
      {/* Avatar + level badge */}
      <div className="relative shrink-0">
        <Monogram name={name} colorIndex={colorIndex} avatarId={avatarId} size="lg" />
        <span
          className="pointer-events-none absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-obsidian px-1 font-mono text-[9px] font-bold tabular-nums text-warm-ivory ring-2 ring-warm-ivory dark:bg-antique-gold dark:text-obsidian dark:ring-ink-900"
          aria-label={`Level ${level.level}`}
        >
          {level.level}
        </span>
      </div>

      {/* Name + total + level progress */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium text-ink-800 dark:text-ink-100">
          {name}
        </div>
        <div className="mt-1">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${pillClass}`}
          >
            <CurrencyAmount amount={animatedTotal} variant="compact" iconClassName="h-3.5 w-3.5" />
          </span>
        </div>
        <div
          className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={level.pct}
          aria-label={`${name}: Level ${level.level} progress`}
          title={`Level ${level.level} · ${level.needed} to Level ${level.level + 1}`}
        >
          <div
            className="h-full rounded-full bg-antique-gold/70 transition-all duration-500"
            style={{ width: `${level.pct}%` }}
          />
        </div>
      </div>

      {/* Hover quick-actions (desktop only, hidden on touch via group-hover) */}
      <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
        {onQuickPlus && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onQuickPlus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onQuickPlus(); }
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-deep-gold text-warm-ivory shadow-soft transition-colors hover:bg-deep-gold dark:bg-antique-gold dark:text-obsidian"
            aria-label="Quick positive award"
          >
            <Plus className="h-4 w-4" />
          </span>
        )}
        {onQuickMinus && (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onQuickMinus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onQuickMinus(); }
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-warm-brick text-warm-ivory shadow-soft transition-colors hover:bg-warm-brick dark:bg-brick-light dark:text-obsidian"
            aria-label="Quick negative award"
          >
            <Minus className="h-4 w-4" />
          </span>
        )}
      </div>

      {/* Selection checkmark badge */}
      {selected && (
        <div className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-obsidian dark:bg-antique-gold dark:text-obsidian text-warm-ivory shadow-soft ring-2 ring-white dark:ring-ink-900">
          <Check className="h-3 w-3" strokeWidth={3} />
        </div>
      )}
    </button>
  );
}
