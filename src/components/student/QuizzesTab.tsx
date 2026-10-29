import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Eye,
  Play,
  XCircle,
} from "lucide-react";
import type { CurrencySettings } from "@/types";
import type { MyAttemptReview, MyQuizItem } from "@/lib/storage";
import { getMyAttemptReview } from "@/lib/storage";
import { relativeUntil } from "@/lib/time";
import { CurrencyIcon } from "@/components/CurrencyAmount";
import { QuizReview } from "@/components/student/QuizReview";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { Skeleton } from "@/components/Skeleton";

// The quiz-taking flow is code-split — it loads the moment a student
// starts, not on every dashboard visit.
const QuizRunner = lazy(() =>
  import("@/components/student/QuizRunner").then((m) => ({ default: m.QuizRunner })),
);

/**
 * The student's Quizzes tab. The quiz list lives in the parent (StudentView)
 * so the dashboard card and the tab badge share one source of truth; this
 * component renders it, handles the one-attempt warning, the runner overlay
 * and post-submit review.
 */
export function QuizzesTab({
  quizzes,
  quizzesError,
  gems,
  gemsEarned,
  onRetry,
  onGemsChanged,
  autoStartId,
  onAutoStartConsumed,
}: {
  quizzes: MyQuizItem[];
  quizzesError: string | null;
  gems: CurrencySettings;
  gemsEarned: number;
  onRetry: () => void;
  /** Parent reload — refreshes gems, balance and the quiz list together. */
  onGemsChanged: () => void;
  /** Quiz to auto-open (set by the dashboard due card). Consumed once. */
  autoStartId: string | null;
  onAutoStartConsumed: () => void;
}) {
  const [startCandidate, setStartCandidate] = useState<MyQuizItem | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<MyQuizItem | null>(null);
  const [reviewing, setReviewing] = useState<MyAttemptReview | null>(null);
  const reviewTrapRef = useFocusTrap<HTMLDivElement>(reviewing !== null);

  // The dashboard's Start button hops to this tab and asks us to open the
  // quiz: continue silently if already started, warn first otherwise.
  useEffect(() => {
    if (!autoStartId) return;
    const quiz = quizzes.find((q) => q.quizId === autoStartId);
    if (quiz && !quiz.submitted) {
      if (quiz.attemptId) setActiveQuiz(quiz);
      else setStartCandidate(quiz);
    }
    onAutoStartConsumed();
  }, [autoStartId, quizzes, onAutoStartConsumed]);

  const now = Date.now();
  const sorted = useMemo(
    () =>
      [...quizzes].sort((a, b) => {
        // Soonest due first; submitted drift to the bottom.
        const aDone = a.submitted ? 1 : 0;
        const bDone = b.submitted ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        return a.dueAt - b.dueAt;
      }),
    [quizzes],
  );

  if (activeQuiz) {
    return (
      <Suspense fallback={<RunnerFallback />}>
        <QuizRunner
          quiz={activeQuiz}
          gems={gems}
          onClose={() => {
            setActiveQuiz(null);
            onGemsChanged();
          }}
          onSubmitted={onGemsChanged}
        />
      </Suspense>
    );
  }

  if (reviewing) {
    return (
      <div
        ref={reviewTrapRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Quiz review: ${reviewing.title}`}
        tabIndex={-1}
        className="fixed inset-0 z-50 bg-ink-50 outline-none dark:bg-ink-950"
      >
        <QuizReview
          review={reviewing}
          gems={gems}
          onCloseLabel="Back to quizzes"
          onClose={() => setReviewing(null)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[720px]">
      {/* Gems summary — lifetime achievement score from quizzes */}
      <div className="flex items-center justify-between rounded-card border border-ink-200/70 bg-warm-ivory px-5 py-4 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
            {gems.plural} earned from quizzes
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 font-mono text-3xl font-bold tabular-nums text-ink-900 dark:text-warm-ivory">
            <CurrencyIcon name={gems.icon} className="h-6 w-6 text-deep-gold dark:text-antique-gold" strokeWidth={2.25} />
            {gemsEarned}
          </p>
        </div>
        <p className="max-w-[200px] text-right text-xs leading-snug text-ink-400 dark:text-ink-500">
          Spend your {gems.plural.toLowerCase()} on {gems.singular.toLowerCase()}-priced rewards in the
          shop — this lifetime total never goes down.
        </p>
      </div>

      <div className="mt-5 pb-8">
        {quizzesError ? (
          <div className="flex flex-col items-center gap-3 rounded-card border border-warm-brick/30 bg-warm-brick/5 px-6 py-10 text-center dark:border-brick-light/20 dark:bg-warm-brick/10">
            <p className="text-sm font-medium text-warm-brick dark:text-brick-light">{quizzesError}</p>
            <button
              onClick={onRetry}
              className="rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-4 py-2 text-sm font-semibold text-warm-ivory hover:bg-ink-700 dark:hover:bg-deep-gold"
            >
              Try again
            </button>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-card border-2 border-dashed border-ink-200 py-14 text-center dark:border-ink-700">
            <div className="flex h-14 w-14 items-center justify-center rounded-card bg-ivory-dim dark:bg-antique-gold/10">
              <ClipboardList className="h-7 w-7 text-deep-gold" />
            </div>
            <h2 className="mt-3 text-base font-semibold text-ink-900 dark:text-warm-ivory">No quizzes yet</h2>
            <p className="mt-1 max-w-xs text-sm text-ink-500 dark:text-ink-400">
              When your teacher assigns a quiz, it will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {sorted.map((quiz) => (
              <QuizCard
                key={quiz.quizId}
                quiz={quiz}
                now={now}
                gems={gems}
                onStart={() => setStartCandidate(quiz)}
                onContinue={() => setActiveQuiz(quiz)}
                onReview={async () => {
                  try {
                    const r = await getMyAttemptReview(quiz.attemptId!);
                    if (r) setReviewing(r);
                  } catch {
                    /* review stays closed on failure */
                  }
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {/* One-attempt warning before starting */}
      {startCandidate && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setStartCandidate(null)}
        >
          <div
            className="w-full max-w-md animate-fade-scale-in rounded-t-card bg-warm-ivory p-6 shadow-soft-lg dark:bg-ink-900 sm:rounded-card"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-labelledby="quiz-start-warning"
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-card bg-warm-brick/10 dark:bg-warm-brick/15">
              <AlertTriangle className="h-5 w-5 text-warm-brick dark:text-brick-light" />
            </div>
            <h2 id="quiz-start-warning" className="text-base font-semibold text-ink-900 dark:text-warm-ivory">
              Start “{startCandidate.title}”?
            </h2>
            <p className="mt-1.5 text-sm text-ink-600 dark:text-ink-300">
              You get <strong>one attempt only</strong> — it cannot be restarted or retaken. Your
              answers save as you go, so you can leave and come back until you submit. Due{" "}
              {relativeUntil(startCandidate.dueAt)}.
            </p>
            <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
              Score up to{" "}
              <strong className="font-mono tabular-nums">
                {startCandidate.maxGems} {startCandidate.maxGems === 1 ? gems.singular : gems.plural}
              </strong>
              .
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setStartCandidate(null)}
                className="min-h-11 rounded-button px-4 py-2.5 text-sm font-semibold text-ink-600 transition-colors hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const q = startCandidate;
                  setStartCandidate(null);
                  setActiveQuiz(q);
                }}
                autoFocus
                className="min-h-11 rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-4 py-2.5 text-sm font-bold text-warm-ivory transition-colors hover:bg-ink-700 dark:hover:bg-deep-gold"
              >
                Start quiz
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QuizCard({
  quiz,
  now,
  gems,
  onStart,
  onContinue,
  onReview,
}: {
  quiz: MyQuizItem;
  now: number;
  gems: CurrencySettings;
  onStart: () => void;
  onContinue: () => void;
  onReview: () => void;
}) {
  const overdue = quiz.dueAt < now;
  const closed = quiz.status === "closed";

  let status: React.ReactNode;
  let action: React.ReactNode;

  if (quiz.submitted) {
    status = (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-deep-gold/10 px-2.5 py-1 text-xs font-bold text-deep-gold dark:bg-antique-gold/10 dark:text-antique-gold">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        {quiz.correctCount}/{quiz.totalCount} · {quiz.gemsAwarded}{" "}
        {quiz.gemsAwarded === 1 ? gems.singular : gems.plural}
      </span>
    );
    action = (
      <ActionButton onClick={onReview} icon={<Eye className="h-4 w-4" />} label="Review" />
    );
  } else if (quiz.attemptId) {
    if (closed) {
      status = (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 px-2.5 py-1 text-xs font-bold text-ink-500 dark:bg-ink-800 dark:text-ink-400">
          <XCircle className="h-3.5 w-3.5" aria-hidden />
          Closed by your teacher
        </span>
      );
      action = null;
    } else {
      status = (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-antique-gold/15 px-2.5 py-1 text-xs font-bold text-deep-gold dark:bg-antique-gold/10 dark:text-antique-gold">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          In progress · due {relativeUntil(quiz.dueAt)}
        </span>
      );
      action = (
        <ActionButton onClick={onContinue} icon={<Play className="h-4 w-4" />} label="Continue" primary />
      );
    }
  } else if (closed || overdue) {
    status = (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warm-brick/10 px-2.5 py-1 text-xs font-bold text-warm-brick dark:bg-warm-brick/15 dark:text-brick-light">
        <XCircle className="h-3.5 w-3.5" aria-hidden />
        {closed ? "Ended" : "Missed"}
      </span>
    );
    action = null;
  } else {
    status = (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-antique-gold/15 px-2.5 py-1 text-xs font-bold text-deep-gold dark:bg-antique-gold/10 dark:text-antique-gold">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        Due {relativeUntil(quiz.dueAt)}
      </span>
    );
    action = (
      <ActionButton onClick={onStart} icon={<Play className="h-4 w-4" />} label="Start" primary />
    );
  }

  return (
    <li className="rounded-card border border-ink-200/70 bg-warm-ivory p-4 shadow-soft dark:border-ink-800/70 dark:bg-ink-900 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-ink-900 dark:text-warm-ivory">
            {quiz.title}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {status}
            <span className="text-xs font-medium text-ink-400 dark:text-ink-500">
              <span className="font-mono tabular-nums">{quiz.questionCount}</span>{" "}
              {quiz.questionCount === 1 ? "question" : "questions"}
              <span className="mx-1.5" aria-hidden>·</span>
              up to <span className="font-mono tabular-nums">{quiz.maxGems}</span>{" "}
              {quiz.maxGems === 1 ? gems.singular : gems.plural}
            </span>
          </div>
        </div>
        {action}
      </div>
    </li>
  );
}

function ActionButton({
  onClick,
  icon,
  label,
  primary,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-11 shrink-0 items-center gap-1.5 rounded-button px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-950 ${
        primary
          ? "bg-obsidian text-warm-ivory hover:bg-ink-700 dark:bg-antique-gold dark:text-obsidian dark:hover:bg-deep-gold"
          : "border border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
      }`}
    >
      {icon}
      {label}
      {primary && <ChevronRight className="h-4 w-4" aria-hidden />}
    </button>
  );
}

function RunnerFallback() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-50 dark:bg-ink-950">
      <div className="mx-auto w-full max-w-[640px] px-5 pt-8">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-6 h-6 w-full" />
        <div className="mt-5 space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-button" />
          ))}
        </div>
      </div>
    </div>
  );
}
