import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Sparkles, X } from "lucide-react";
import type { Store } from "@/lib/useStore";
import { Monogram } from "@/components/Monogram";
import { useCurrency } from "@/components/CurrencyProvider";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { loadSortMode, sortStudents } from "@/lib/sortStudents";

interface Props {
  open: boolean;
  store: Store;
  selectedCount: number;
  onClose: () => void;
  onAwarded: (label: string, amount: number, count: number) => void;
}

export function AwardModal({ open, store, selectedCount, onClose, onAwarded }: Props) {
  const { behaviors, students } = store;
  const { config } = useCurrency();
  const currency = config.behavior;
  const [customOpen, setCustomOpen] = useState(false);
  const [customReason, setCustomReason] = useState("");
  const [customPoints, setCustomPoints] = useState<string>("1");
  const [customError, setCustomError] = useState("");

  useEffect(() => {
    if (open) {
      setCustomOpen(false);
      setCustomReason("");
      setCustomPoints("1");
      setCustomError("");
    }
  }, [open]);

  const positive = behaviors.filter((b) => b.points > 0);
  const negative = behaviors.filter((b) => b.points < 0);

  const selectedStudents = useMemo(
    () => {
      const sorted = sortStudents(students, loadSortMode(), store.totals, store.transactions);
      return sorted.filter((s) => selectedIdsRef.current.includes(s.id));
    },
    [students, store.totals, store.transactions],
  );
  const colorIndexById = new Map(
    sortStudents(students, loadSortMode(), store.totals, store.transactions).map((s, index) => [s.id, index]),
  );

  const awardBehavior = (behavior: { id: string; label: string; emoji: string; points: number }) => {
    const studentIds = selectedIdsRef.current;
    if (studentIds.length === 0) return;
    store.award(studentIds, {
      type: "behavior",
      amount: behavior.points,
      reason: behavior.label,
      behaviorId: behavior.id,
    });
    onAwarded(behavior.label, behavior.points, studentIds.length);
  };

  const submitCustom = () => {
    const reason = customReason.trim();
    const pts = parseInt(customPoints, 10);
    if (!reason) {
      setCustomError("Reason is required");
      return;
    }
    if (Number.isNaN(pts) || pts === 0) {
      setCustomError(`${currency.plural} cannot be zero`);
      return;
    }
    const studentIds = selectedIdsRef.current;
    store.award(studentIds, { type: "adjustment", amount: pts, reason });
    onAwarded(reason, pts, studentIds.length);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full animate-fade-scale-in flex-col rounded-t-card bg-warm-ivory shadow-soft-lg dark:bg-ink-900 sm:max-w-2xl sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4 dark:border-ink-800">
          <div>
            <h2 className="text-base font-semibold text-ink-900 dark:text-warm-ivory">Award {currency.plural}</h2>
            <p className="text-sm text-ink-500 dark:text-ink-400">
              To {selectedCount} {selectedCount === 1 ? "student" : "students"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-button text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-200"
            aria-label="Close"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* Selected students avatar row */}
        {selectedStudents.length > 0 && (
          <div className="border-b border-ink-100 px-5 py-3 dark:border-ink-800">
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
                {selectedStudents.length}
              </span>
              <div className="flex -space-x-2">
                {selectedStudents.slice(0, 12).map((s) => {
                  const idx = colorIndexById.get(s.id) ?? 0;
                  return (
                    <span key={s.id} title={s.displayName} className="-ml-2 first:ml-0">
                      <Monogram name={s.displayName} colorIndex={idx} size="xs" ring="ring-2 ring-white dark:ring-ink-900" />
                    </span>
                  );
                })}
                {selectedStudents.length > 12 && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-600 ring-2 ring-white dark:bg-ink-800 dark:text-ink-300 dark:ring-ink-900">
                    +{selectedStudents.length - 12}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="overflow-y-auto px-5 py-4">
          {customOpen ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">
                  Reason
                </label>
                <input
                  autoFocus
                  value={customReason}
                  onChange={(e) => {
                    setCustomReason(e.target.value);
                    setCustomError("");
                  }}
                  placeholder="e.g. Helped clean up the lab"
                  className="h-10 w-full rounded-button border border-ink-200 bg-warm-ivory px-3 text-sm outline-none transition-colors placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800 dark:focus:ring-antique-gold/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">
                  {currency.plural} (cannot be zero)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setCustomPoints(String(Math.max(-999, (parseInt(customPoints, 10) || 0) - 1)))
                    }
                    className="flex h-11 w-11 items-center justify-center rounded-button bg-ink-100 text-ink-700 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <input
                    type="number"
                    value={customPoints}
                    onChange={(e) => setCustomPoints(e.target.value)}
                    className="h-11 w-24 rounded-button border border-ink-200 bg-warm-ivory px-3 text-center text-lg font-bold outline-none focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800 dark:focus:ring-antique-gold/20"
                  />
                  <button
                    onClick={() => setCustomPoints(String((parseInt(customPoints, 10) || 0) + 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-button bg-ink-100 text-ink-700 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>
              {customError && <p className="text-xs text-warm-brick">{customError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setCustomOpen(false)}
                  className="rounded-button px-4 py-2.5 text-sm font-semibold text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
                >
                  Back
                </button>
                <button
                  onClick={submitCustom}
                  className="flex items-center gap-1.5 rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-4 py-2.5 text-sm font-semibold text-warm-ivory hover:bg-ink-700 dark:hover:bg-deep-gold"
                >
                  Award
                  <CurrencyAmount
                    amount={parseInt(customPoints, 10) || 0}
                    signed
                    className="rounded-full bg-warm-ivory px-2 py-0.5 text-deep-gold"
                  />
                </button>
              </div>
            </div>
          ) : (
            <>
              {positive.length > 0 && (
                <Section title="Positive">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {positive.map((b) => (
                      <BehaviorButton
                        key={b.id}
                        emoji={b.emoji}
                        label={b.label}
                        points={b.points}
                        tone="positive"
                        onClick={() => awardBehavior(b)}
                      />
                    ))}
                  </div>
                </Section>
              )}
              {negative.length > 0 && (
                <Section title="Negative">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {negative.map((b) => (
                      <BehaviorButton
                        key={b.id}
                        emoji={b.emoji}
                        label={b.label}
                        points={b.points}
                        tone="negative"
                        onClick={() => awardBehavior(b)}
                      />
                    ))}
                  </div>
                </Section>
              )}
              <button
                onClick={() => setCustomOpen(true)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-button border-2 border-dashed border-ink-200 px-4 py-3 text-sm font-semibold text-ink-600 transition-colors hover:border-antique-gold hover:bg-ivory-dim/40 hover:text-deep-gold dark:border-ink-700 dark:text-ink-300 dark:hover:border-antique-gold/40 dark:hover:bg-antique-gold/5 dark:hover:text-antique-gold"
              >
                <Sparkles className="h-4 w-4" />
                Custom award
                <Plus className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

function BehaviorButton({
  emoji,
  label,
  points,
  tone,
  onClick,
}: {
  emoji: string;
  label: string;
  points: number;
  tone: "positive" | "negative";
  onClick: () => void;
}) {
  const toneClasses =
    tone === "positive"
      ? "bg-ivory-dim hover:bg-ivory-dim border-deep-gold/30 dark:bg-antique-gold/10 dark:hover:bg-antique-gold/15 dark:border-antique-gold/20 text-deep-gold dark:text-antique-gold"
      : "bg-warm-brick/10 hover:bg-warm-brick/10 border-warm-brick/30 dark:bg-warm-brick/10 dark:hover:bg-warm-brick/15 dark:border-brick-light/20 text-warm-brick dark:text-brick-light";
  const badge =
    tone === "positive"
      ? "bg-warm-ivory text-deep-gold dark:bg-ink-900 dark:text-antique-gold"
      : "bg-warm-ivory text-warm-brick dark:bg-ink-900 dark:text-brick-light";
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-card border px-3 py-2.5 text-left transition-all active:scale-[0.98] ${toneClasses}`}
    >
      <span className="text-xl">{emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{label}</div>
        <div className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold shadow-soft ${badge}`}>
          <CurrencyAmount amount={points} signed iconClassName="h-3 w-3" />
        </div>
      </div>
    </button>
  );
}

export const selectedIdsRef: { current: string[] } = { current: [] };
