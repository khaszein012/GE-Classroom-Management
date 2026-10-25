import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, X } from "lucide-react";
import type { CurrencySettings } from "@/types";
import type { MyAttemptReview, MyQuizItem, MyQuizQuestion } from "@/lib/storage";
import {
  getMyAttemptForQuiz,
  getMyAttemptReview,
  getMyQuizAnswers,
  getMyQuizQuestions,
  saveMyQuizAnswer,
  startMyQuizAttempt,
  submitMyQuizAttempt,
} from "@/lib/storage";
import type { QuizAttempt } from "@/types";
import { seededShuffle } from "@/lib/quizShuffle";
import { Skeleton } from "@/components/Skeleton";
import { QuizReview } from "@/components/student/QuizReview";

interface ShuffledQuestion extends MyQuizQuestion {
  shuffledOptions: MyQuizQuestion["options"];
}

const optionRefs: { current: (HTMLButtonElement | null)[] } = { current: [] };

/**
 * The full take-a-quiz flow: load-or-start the single attempt, show one
 * question at a time in a per-student shuffled order, save every answer to
 * the server the moment it is selected (so any reload resumes exactly here),
 * and submit with an explicit confirmation. Scoring happens server-side.
 */
export function QuizRunner({
  quiz,
  gems,
  onClose,
  onSubmitted,
}: {
  quiz: MyQuizItem;
  gems: CurrencySettings;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [phase, setPhase] = useState<"loading" | "taking" | "confirm" | "review">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [questions, setQuestions] = useState<ShuffledQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [saveError, setSaveError] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [review, setReview] = useState<MyAttemptReview | null>(null);
  /** Question ids whose latest answer has not been confirmed saved. */
  const dirtyRef = useRef<Set<string>>(new Set());
  const answersRef = useRef<Record<string, string>>({});
  answersRef.current = answers;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Resume the existing attempt, or start the single allowed one.
        let att: QuizAttempt | null = null;
        try {
          att = await getMyAttemptForQuiz(quiz.quizId);
        } catch {
          att = null;
        }
        if (!att) att = await startMyQuizAttempt(quiz.quizId);
        if (cancelled) return;
        setAttempt(att);

        if (att.submittedAt) {
          const r = await getMyAttemptReview(att.id);
          if (cancelled) return;
          setReview(r);
          setPhase("review");
          return;
        }

        const [qs, saved] = await Promise.all([
          getMyQuizQuestions(quiz.quizId),
          getMyQuizAnswers(att.id),
        ]);
        if (cancelled) return;
        // Shuffle from the attempt seed: stable across reloads, different
        // between students.
        setQuestions(
          seededShuffle(qs, att.id).map((q) => ({
            ...q,
            shuffledOptions: seededShuffle(q.options, `${att!.id}:${q.id}`),
          })),
        );
        setAnswers(saved);
        setPhase("taking");
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Couldn't open this quiz.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quiz.quizId]);

  const select = useCallback(
    (questionId: string, optionId: string) => {
      setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
      dirtyRef.current.add(questionId);
      saveMyQuizAnswer(attempt?.id ?? "", questionId, optionId)
        .then(() => {
          dirtyRef.current.delete(questionId);
          setSaveError(false);
        })
        .catch(() => setSaveError(true));
    },
    [attempt],
  );

  /** Re-send every answer that hasn't been confirmed saved. */
  const flushDirty = useCallback(async () => {
    const dirty = Array.from(dirtyRef.current);
    let failed = 0;
    for (const questionId of dirty) {
      const optionId = answersRef.current[questionId];
      if (!optionId) {
        dirtyRef.current.delete(questionId);
        continue;
      }
      try {
        await saveMyQuizAnswer(attempt?.id ?? "", questionId, optionId);
        dirtyRef.current.delete(questionId);
      } catch {
        failed += 1;
      }
    }
    return failed;
  }, [attempt]);

  const submit = useCallback(async () => {
    if (submitting) return; // double-tap guard (the RPC is idempotent too)
    setSubmitting(true);
    setSubmitError(null);
    try {
      const failed = await flushDirty();
      if (failed > 0) {
        setSubmitError(
          `${failed} ${failed === 1 ? "answer" : "answers"} couldn't be saved. Check your connection and try again — nothing you entered was lost.`,
        );
        return;
      }
      await submitMyQuizAttempt(attempt!.id);
      const r = await getMyAttemptReview(attempt!.id);
      setReview(r);
      setPhase("review");
      onSubmitted();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Couldn't submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  }, [attempt, flushDirty, onSubmitted, submitting]);

  if (phase === "loading") {
    return (
      <Overlay>
        <div className="mx-auto w-full max-w-[640px] px-5 py-8">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-6 h-6 w-full" />
          <div className="mt-5 space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-button" />
            ))}
          </div>
        </div>
      </Overlay>
    );
  }

  if (loadError || !attempt) {
    return (
      <Overlay>
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="max-w-sm text-sm font-medium text-warm-brick">{loadError ?? "Couldn't open this quiz."}</p>
          <button
            onClick={onClose}
            className="rounded-button border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
          >
            Back to quizzes
          </button>
        </div>
      </Overlay>
    );
  }

  if (phase === "review" && review) {
    return (
      <Overlay>
        <QuizReview review={review} gems={gems} onCloseLabel="Back to quizzes" onClose={onClose} />
      </Overlay>
    );
  }

  const total = questions.length;
  const current = questions[index];
  const answeredCount = questions.filter((q) => answers[q.id]).length;
  const unanswered = total - answeredCount;
  const progressPct = total > 0 ? ((index + 1) / total) * 100 : 100;

  return (
    <Overlay>
      {/* Header */}
      <header className="shrink-0 border-b border-ink-200/60 bg-warm-ivory px-4 py-3 dark:border-ink-800/60 dark:bg-ink-900 sm:px-6">
        <div className="mx-auto flex w-full max-w-[640px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <ClipboardCheck className="h-5 w-5 shrink-0 text-deep-gold dark:text-antique-gold" aria-hidden />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold leading-tight text-ink-900 dark:text-warm-ivory">
                {quiz.title}
              </h1>
              <p className="font-mono text-[11px] font-semibold tabular-nums text-ink-400 dark:text-ink-500">
                Question {index + 1} of {total}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Save and exit — your answers are kept and you can come back"
            className="flex h-11 w-11 items-center justify-center rounded-button text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold dark:hover:bg-ink-800 dark:hover:text-ink-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mx-auto mt-2.5 w-full max-w-[640px]">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={index + 1}
          >
            <div
              className="h-full rounded-full bg-deep-gold transition-all dark:bg-antique-gold"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[640px] px-4 py-5 sm:px-6 sm:py-7">
          {phase === "taking" && current && (
            <div role="radiogroup" aria-label={current.body}>
              <h2 className="text-lg font-semibold leading-relaxed text-ink-900 dark:text-warm-ivory">
                {current.body}
              </h2>
              <div className="mt-5 space-y-2.5">
                {current.shuffledOptions.map((o, i) => {
                  const selected = answers[current.id] === o.id;
                  return (
                    <button
                      key={o.id}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => select(current.id, o.id)}
                      ref={(el) => {
                        optionRefs.current[i] = el;
                      }}
                      onKeyDown={(e) => onOptionKeyDown(e, i, current.shuffledOptions.length)}
                      className={`flex min-h-11 w-full items-center gap-3 rounded-button border px-4 py-3 text-left text-sm font-medium leading-relaxed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-offset-2 dark:focus-visible:ring-offset-ink-950 ${
                        selected
                          ? "border-deep-gold bg-ivory-dim text-deep-gold dark:border-antique-gold dark:bg-antique-gold/10 dark:text-antique-gold"
                          : "border-ink-200 bg-warm-ivory text-ink-800 hover:border-antique-gold/60 hover:bg-ivory-dim/40 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:hover:bg-ink-800/60"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          selected
                            ? "border-deep-gold bg-deep-gold dark:border-antique-gold dark:bg-antique-gold"
                            : "border-ink-300 dark:border-ink-600"
                        }`}
                      >
                        {selected && <CheckCircle2 className="h-3.5 w-3.5 text-warm-ivory dark:text-obsidian" />}
                      </span>
                      <span className="min-w-0 flex-1 break-words">{o.body}</span>
                    </button>
                  );
                })}
              </div>
              {saveError && (
                <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-warm-brick dark:text-brick-light">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Couldn't save your last answer — it will be sent again when you submit.
                </p>
              )}
            </div>
          )}

          {phase === "confirm" && (
            <div className="rounded-card border border-ink-200/70 bg-warm-ivory p-5 shadow-soft dark:border-ink-800/70 dark:bg-ink-900 sm:p-6">
              <h2 className="text-lg font-bold text-ink-900 dark:text-warm-ivory">Ready to submit?</h2>
              <p className="mt-1.5 text-sm text-ink-500 dark:text-ink-400">
                You answered{" "}
                <span className="font-mono font-bold tabular-nums text-ink-800 dark:text-ink-100">
                  {answeredCount} of {total}
                </span>{" "}
                {total === 1 ? "question" : "questions"}.
              </p>
              {unanswered > 0 && (
                <div
                  role="alert"
                  className="mt-4 flex items-start gap-2.5 rounded-button border border-warm-brick/40 bg-warm-brick/5 px-3.5 py-3 dark:border-brick-light/30 dark:bg-warm-brick/10"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warm-brick dark:text-brick-light" aria-hidden />
                  <p className="text-sm text-warm-brick dark:text-brick-light">
                    {unanswered} {unanswered === 1 ? "question is" : "questions are"} unanswered —{" "}
                    {unanswered === 1 ? "it" : "they"} will count as incorrect. You can go back and answer
                    {" "}{unanswered === 1 ? "it" : "them"} first.
                  </p>
                </div>
              )}
              {submitError && (
                <div
                  role="alert"
                  className="mt-4 rounded-button border border-warm-brick/40 bg-warm-brick/5 px-3.5 py-3 text-sm text-warm-brick dark:border-brick-light/30 dark:bg-warm-brick/10 dark:text-brick-light"
                >
                  {submitError}
                </div>
              )}
              <p className="mt-4 text-xs text-ink-400 dark:text-ink-500">
                Submitting is final — you get one attempt and cannot change answers afterwards.
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
                <button
                  onClick={() => void submit()}
                  disabled={submitting}
                  className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-button bg-obsidian px-4 py-2.5 text-sm font-bold text-warm-ivory transition-colors hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-offset-2 disabled:opacity-60 dark:bg-antique-gold dark:text-obsidian dark:hover:bg-deep-gold dark:focus-visible:ring-offset-ink-950 sm:flex-none"
                >
                  {submitting ? "Submitting…" : "Submit quiz"}
                </button>
                <button
                  onClick={() => {
                    setSubmitError(null);
                    setPhase("taking");
                  }}
                  disabled={submitting}
                  className="min-h-11 flex-1 rounded-button border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-600 transition-colors hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-offset-2 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800 dark:focus-visible:ring-offset-ink-950 sm:flex-none sm:px-6"
                >
                  Not yet — go back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer navigation (only while taking) */}
      {phase === "taking" && (
        <footer className="shrink-0 border-t border-ink-200/60 bg-warm-ivory px-4 py-3 dark:border-ink-800/60 dark:bg-ink-900 sm:px-6">
          <div className="mx-auto flex w-full max-w-[640px] items-center justify-between gap-3">
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="flex h-11 items-center gap-1.5 rounded-button border border-ink-200 px-4 text-sm font-semibold text-ink-600 transition-colors hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold disabled:opacity-40 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            {index < total - 1 ? (
              <button
                onClick={() => setIndex((i) => i + 1)}
                className="flex h-11 items-center gap-1.5 rounded-button bg-obsidian px-5 text-sm font-bold text-warm-ivory transition-colors hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-offset-2 dark:bg-antique-gold dark:text-obsidian dark:hover:bg-deep-gold dark:focus-visible:ring-offset-ink-950"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => setPhase("confirm")}
                className="flex h-11 items-center gap-1.5 rounded-button bg-deep-gold px-5 text-sm font-bold text-warm-ivory transition-colors hover:bg-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-offset-2 dark:bg-antique-gold dark:text-obsidian dark:hover:bg-deep-gold dark:focus-visible:ring-offset-ink-950"
              >
                Review & submit
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </footer>
      )}
    </Overlay>
  );

  function onOptionKeyDown(e: React.KeyboardEvent, i: number, count: number) {
    let to = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") to = (i + 1) % count;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") to = (i - 1 + count) % count;
    if (to >= 0) {
      e.preventDefault();
      optionRefs.current[to]?.focus();
    }
  }
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-50 dark:bg-ink-950">{children}</div>
  );
}
