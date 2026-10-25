import { CheckCircle2, XCircle } from "lucide-react";
import type { MyAttemptReview } from "@/lib/storage";
import type { CurrencySettings } from "@/types";
import { CurrencyIcon } from "@/components/CurrencyAmount";

/**
 * Post-submit quiz review: score, gems earned, and a per-question breakdown.
 * The data comes from my_attempt_review(), which only ever returns the
 * signed-in student's own submitted attempt. Right/wrong is shown with an
 * icon AND a label, never colour alone.
 */
export function QuizReview({
  review,
  gems,
  onCloseLabel,
  onClose,
}: {
  review: MyAttemptReview;
  gems: CurrencySettings;
  onCloseLabel: string;
  onClose: () => void;
}) {
  const pct =
    review.totalCount > 0 ? Math.round((review.correctCount / review.totalCount) * 100) : 0;

  return (
    <div className="flex min-h-full flex-col bg-ink-50 dark:bg-ink-950">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[720px] px-5 py-6 sm:py-8">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
                Your result
              </p>
              <h1 className="mt-0.5 truncate text-2xl font-bold text-ink-900 dark:text-warm-ivory">
                {review.title}
              </h1>
            </div>
            <button
              onClick={onClose}
              className="flex h-11 shrink-0 items-center gap-2 rounded-button border border-ink-200 px-4 text-sm font-semibold text-ink-600 transition-colors hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
            >
              {onCloseLabel}
            </button>
          </div>

          {/* Score hero */}
          <div className="mt-5 rounded-card border border-ink-200/70 bg-warm-ivory p-6 text-center shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
            <p className="font-mono text-5xl font-bold tabular-nums text-ink-900 dark:text-warm-ivory">
              {review.correctCount}
              <span className="text-ink-400 dark:text-ink-500">/{review.totalCount}</span>
            </p>
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-ink-500 dark:text-ink-400">
              {pct}% correct
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ivory-dim px-3.5 py-1.5 text-sm font-bold text-deep-gold dark:bg-antique-gold/10 dark:text-antique-gold">
              <CurrencyIcon name={gems.icon} className="h-4 w-4" />
              <span className="font-mono tabular-nums">+{review.gemsAwarded}</span>
              {review.gemsAwarded === 1 ? gems.singular : gems.plural} earned
            </div>
          </div>

          {/* Per-question review */}
          <div className="mt-6 space-y-3 pb-8">
            {review.questions.map((q, i) => (
              <div
                key={q.id}
                className="rounded-card border border-ink-200/70 bg-warm-ivory p-4 shadow-soft dark:border-ink-800/70 dark:bg-ink-900 sm:p-5"
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 font-mono text-xs font-bold text-ink-400 dark:text-ink-500">
                    Q{i + 1}
                  </span>
                  <p className="min-w-0 flex-1 text-sm font-semibold leading-relaxed text-ink-900 dark:text-warm-ivory">
                    {q.body}
                  </p>
                </div>
                <div className="mt-3 space-y-2 pl-7">
                  <div className="flex items-start gap-2 text-sm">
                    {q.isCorrect ? (
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-deep-gold dark:text-antique-gold"
                        aria-hidden
                      />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-warm-brick dark:text-brick-light" aria-hidden />
                    )}
                    <span className="min-w-0">
                      <span className="font-semibold text-ink-400 dark:text-ink-500">Your answer: </span>
                      {q.myOptionBody ? (
                        <span className="text-ink-800 dark:text-ink-100">{q.myOptionBody}</span>
                      ) : (
                        <span className="italic text-ink-400 dark:text-ink-500">no answer</span>
                      )}
                      <span className="ml-2 text-xs font-bold uppercase tracking-wide text-ink-400 dark:text-ink-500">
                        {q.isCorrect ? "Correct" : "Incorrect"}
                      </span>
                    </span>
                  </div>
                  {!q.isCorrect && (
                    <p className="text-sm">
                      <span className="font-semibold text-ink-400 dark:text-ink-500">Correct answer: </span>
                      <span className="text-ink-800 dark:text-ink-100">{q.correctOptionBody}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
