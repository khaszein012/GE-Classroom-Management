import { useState } from "react";
import { Check, Pencil, Target, X } from "lucide-react";
import { CurrencyIcon } from "@/components/CurrencyAmount";
import type { CurrencySettings } from "@/types";

export interface Goal {
  target: number | null;
  label: string | null;
}

/**
 * Personal goal panel — the only thing a student can write (own row, two
 * columns, validated). Quiet progress bar; dismissible reached banner.
 */
export function GoalPanel({
  goal,
  balance,
  currency,
  onSave,
  saving,
  error,
}: {
  goal: Goal;
  balance: number;
  currency: CurrencySettings;
  onSave: (goal: Goal) => void;
  saving: boolean;
  error: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(goal.target?.toString() ?? "");
  const [label, setLabel] = useState(goal.label ?? "");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const reached = goal.target !== null && balance >= goal.target;
  const progress =
    goal.target && goal.target > 0 ? Math.min(100, Math.max(0, (balance / goal.target) * 100)) : 0;
  const remaining = goal.target !== null ? Math.max(0, goal.target - balance) : 0;

  const startEdit = () => {
    setTarget(goal.target?.toString() ?? "");
    setLabel(goal.label ?? "");
    setEditing(true);
  };

  const submit = () => {
    const t = parseInt(target, 10);
    const cleanTarget = Number.isFinite(t) && t >= 1 && t <= 1_000_000 ? t : null;
    const cleanLabel = label.trim().slice(0, 40) || null;
    if (target.trim() !== "" && cleanTarget === null) {
      setLocalError("Target must be a positive whole number.");
      return;
    }
    if (label.trim().length > 40) {
      setLocalError("Label must be 40 characters or fewer.");
      return;
    }
    if (cleanTarget === null && cleanLabel !== null) {
      setLocalError("Add a target number for your goal.");
      return;
    }
    setLocalError(null);
    onSave({ target: cleanTarget, label: cleanTarget !== null ? cleanLabel : null });
    setEditing(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
          <Target className="h-4 w-4" />
          My goal
        </h2>
        {!editing && (goal.target !== null || goal.label !== null) && (
          <button
            onClick={startEdit}
            className="text-xs font-semibold text-deep-gold hover:text-deep-gold dark:text-antique-gold"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-3 space-y-2.5">
          <input
            inputMode="numeric"
            value={target}
            onChange={(e) => setTarget(e.target.value.replace(/\D/g, "").slice(0, 7))}
            placeholder={`Target (${currency.plural.toLowerCase()})`}
            className="h-10 w-full rounded-button border border-ink-200 bg-warm-ivory px-3 text-sm outline-none transition-colors placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800 dark:focus:ring-antique-gold/20"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value.slice(0, 40))}
            placeholder="What's it for? (e.g. canteen voucher)"
            className="h-10 w-full rounded-button border border-ink-200 bg-warm-ivory px-3 text-sm outline-none transition-colors placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800 dark:focus:ring-antique-gold/20"
          />
          {(error ?? localError) && <p className="text-xs text-warm-brick">{error ?? localError}</p>}
          <div className="flex justify-end gap-2">
            {goal.target !== null && (
              <button
                onClick={() => {
                  onSave({ target: null, label: null });
                  setEditing(false);
                }}
                className="rounded-button px-3 py-2 text-xs font-semibold text-warm-brick hover:bg-warm-brick/10 dark:hover:bg-warm-brick/10"
              >
                Clear goal
              </button>
            )}
            <button
              onClick={() => setEditing(false)}
              className="rounded-button px-3 py-2 text-xs font-semibold text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving}
              className="flex items-center gap-1 rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-3 py-2 text-xs font-semibold text-warm-ivory hover:bg-ink-700 dark:hover:bg-deep-gold disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : goal.target === null ? (
        <button
          onClick={startEdit}
          className="mt-3 w-full rounded-card border-2 border-dashed border-ink-200 py-6 text-sm text-ink-400 transition-colors hover:border-antique-gold hover:text-deep-gold dark:border-ink-700 dark:hover:border-antique-gold/40 dark:hover:text-antique-gold"
        >
          Set a personal goal
        </button>
      ) : (
        <div className="mt-3 rounded-card border border-ink-200/70 bg-warm-ivory p-4 dark:border-ink-800/70 dark:bg-ink-900">
          <div className="flex items-baseline justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-semibold text-ink-800 dark:text-ink-100">
              {goal.label || "My goal"}
            </p>
            <button
              onClick={startEdit}
              className="shrink-0 text-ink-400 transition-colors hover:text-deep-gold"
              aria-label="Edit goal"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1 flex items-center gap-1 text-2xl font-bold tabular-nums text-ink-900 dark:text-warm-ivory">
            <CurrencyIcon name={currency.icon} className={`h-5 w-5 ${ICON_COLORS[currency.color] ?? "text-deep-gold"}`} />
            {balance}
            <span className="text-sm font-medium text-ink-400 dark:text-ink-500">of {goal.target}</span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
            <div
              className="h-full rounded-full bg-antique-gold transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {!reached && (
            <p className="mt-1.5 text-xs text-ink-400 dark:text-ink-500">
              {remaining} {remaining === 1 ? currency.singular.toLowerCase() : currency.plural.toLowerCase()} to go
            </p>
          )}
        </div>
      )}

      {reached && !bannerDismissed && !editing && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-card border border-deep-gold/30 bg-ivory-dim px-3.5 py-2.5 dark:border-antique-gold/30 dark:bg-antique-gold/10">
          <p className="text-xs font-medium text-deep-gold dark:text-antique-gold">
            Goal reached — {goal.label || "nice work"}.
          </p>
          <button
            onClick={() => setBannerDismissed(true)}
            className="shrink-0 text-deep-gold hover:text-deep-gold dark:text-antique-gold"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
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
