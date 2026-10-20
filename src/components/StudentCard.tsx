import { Check, Minus, Plus } from "lucide-react";
import { Monogram } from "@/components/Monogram";
import { useCountUp } from "@/lib/useCountUp";
import { CurrencyAmount } from "@/components/CurrencyAmount";

interface Props {
  colorIndex: number;
  name: string;
  total: number;
  selected: boolean;
  pulsing: boolean;
  onClick: () => void;
  onQuickPlus?: () => void;
  onQuickMinus?: () => void;
}

export function StudentCard({
  colorIndex,
  name,
  total,
  selected,
  pulsing,
  onClick,
  onQuickPlus,
  onQuickMinus,
}: Props) {
  const animatedTotal = useCountUp(total);

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
      {/* Avatar */}
      <Monogram name={name} colorIndex={colorIndex} size="lg" />

      {/* Name + total */}
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
