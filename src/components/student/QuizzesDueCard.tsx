import { AlarmClock, ChevronRight, Play } from "lucide-react";
import type { CurrencySettings } from "@/types";
import type { MyQuizItem } from "@/lib/storage";
import { relativeUntil } from "@/lib/time";

const URGENT_MS = 24 * 60 * 60 * 1000;

/**
 * Dashboard card: the student's open, unsubmitted quizzes (max three,
 * soonest due first). Rows due within 24h are highlighted with an icon and
 * a bold label as well as colour. Start hops to the Quizzes tab and opens
 * the quiz through the same one-attempt warning as everywhere else.
 */
export function QuizzesDueCard({
  quizzes,
  totalOpen,
  gems,
  className = "",
  onStart,
  onViewAll,
}: {
  /** Pre-sliced to at most three, soonest due first. */
  quizzes: MyQuizItem[];
  totalOpen: number;
  gems: CurrencySettings;
  className?: string;
  onStart: (quiz: MyQuizItem) => void;
  onViewAll: () => void;
}) {
  const now = Date.now();
  return (
    <section
      className={`flex flex-col rounded-card border border-ink-200/70 bg-warm-ivory p-4 shadow-soft dark:border-ink-800/70 dark:bg-ink-900 sm:p-5 ${className}`}
      aria-label="Quizzes due"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
          Quizzes due
        </h2>
        {totalOpen > quizzes.length && (
          <button
            onClick={onViewAll}
            className="flex items-center gap-0.5 text-xs font-semibold text-deep-gold transition-colors hover:text-deep-gold/80 dark:text-antique-gold dark:hover:text-antique-gold/80"
          >
            View all ({totalOpen})
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>

      <ul className="mt-3 space-y-2">
        {quizzes.map((quiz) => {
          const urgent = quiz.dueAt - now < URGENT_MS;
          const started = !!quiz.attemptId;
          return (
            <li
              key={quiz.quizId}
              className={`flex items-center gap-3 rounded-button border px-3 py-2.5 ${
                urgent
                  ? "border-warm-brick/40 bg-warm-brick/5 dark:border-brick-light/30 dark:bg-warm-brick/10"
                  : "border-ink-100 bg-ink-50/60 dark:border-ink-800 dark:bg-ink-800/40"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {urgent && (
                    <AlarmClock
                      className="h-3.5 w-3.5 shrink-0 text-warm-brick dark:text-brick-light"
                      aria-label="Due soon"
                    />
                  )}
                  <span className="truncate text-sm font-semibold text-ink-900 dark:text-warm-ivory">
                    {quiz.title}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
                  <span className="font-mono tabular-nums">{quiz.questionCount}</span>{" "}
                  {quiz.questionCount === 1 ? "question" : "questions"} · up to{" "}
                  <span className="font-mono tabular-nums">{quiz.maxGems}</span>{" "}
                  {quiz.maxGems === 1 ? gems.singular : gems.plural}
                </p>
                <p
                  className={`mt-0.5 text-xs font-medium ${
                    urgent
                      ? "font-bold text-warm-brick dark:text-brick-light"
                      : "text-ink-400 dark:text-ink-500"
                  }`}
                >
                  {urgent ? `Due soon · ${relativeUntil(quiz.dueAt)}` : `due ${relativeUntil(quiz.dueAt)}`}
                </p>
              </div>
              <button
                onClick={() => onStart(quiz)}
                aria-label={`${started ? "Continue" : "Start"} quiz "${quiz.title}"`}
                className="flex h-11 shrink-0 items-center gap-1 rounded-button bg-obsidian px-3 text-xs font-bold text-warm-ivory transition-colors hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-offset-2 dark:bg-antique-gold dark:text-obsidian dark:hover:bg-deep-gold dark:focus-visible:ring-offset-ink-950"
              >
                <Play className="h-3.5 w-3.5" aria-hidden />
                {started ? "Continue" : "Start"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
