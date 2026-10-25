import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, CheckCircle2, Clock, MinusCircle, XCircle } from "lucide-react";
import type { Store } from "@/lib/useStore";
import type { QuizAttempt } from "@/types";
import { getQuizAnswerSheet, getQuizAttempts, getQuizDetail } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { formatDateTime } from "@/lib/time";
import { Monogram } from "@/components/Monogram";
import { Skeleton } from "@/components/Skeleton";
import { useCurrency } from "@/components/CurrencyProvider";
import { sortStudents, loadSortMode } from "@/lib/sortStudents";
import { StatusChip } from "@/components/QuizzesScreen";

interface Props {
  store: Store;
  quizId: string;
  onBack: () => void;
}

export function QuizResults({ store, quizId, onBack }: Props) {
  const { config } = useCurrency();
  const gems = config.achievement;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [answers, setAnswers] = useState<{ attemptId: string; questionId: string; selectedOptionId: string }[]>([]);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getQuizDetail>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadResults = async () => {
      try {
        const [d, att, sheet] = await Promise.all([
          getQuizDetail(quizId),
          getQuizAttempts(quizId),
          getQuizAnswerSheet(quizId),
        ]);
        if (cancelled) return;
        setDetail(d);
        setAttempts(att);
        setAnswers(sheet.answers);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load results");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadResults();

    // Submissions appear live while the results screen is open.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ping = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void loadResults(), 500);
    };
    const channel = supabase
      .channel(`quiz-results-${quizId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quiz_attempts", filter: `quiz_id=eq.${quizId}` },
        ping,
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [quizId]);

  const assignedStudents = useMemo(
    () =>
      sortStudents(
        store.students.filter((s) => detail?.assignedStudentIds.includes(s.id)),
        loadSortMode(),
        store.totals,
        store.transactions,
      ),
    [store.students, store.totals, store.transactions, detail],
  );

  const attemptByStudent = useMemo(() => {
    const m = new Map<string, QuizAttempt>();
    for (const a of attempts) m.set(a.studentId, a);
    return m;
  }, [attempts]);

  const submitted = attempts.filter((a) => a.submittedAt !== null);
  const pastDue = !!detail && detail.quiz.dueAt < Date.now();

  const classAverage =
    submitted.length === 0
      ? null
      : submitted.reduce((sum, a) => sum + (a.correctCount ?? 0) / Math.max(1, a.totalCount ?? 1), 0) /
        submitted.length;

  const perQuestion = useMemo(() => {
    if (!detail) return [];
    const submittedIds = new Set(submitted.map((a) => a.id));
    return detail.questions.map((q) => {
      const correctOptionId = q.options.find((o) => o.isCorrect)?.id ?? null;
      let right = 0;
      for (const ans of answers) {
        if (!submittedIds.has(ans.attemptId) || ans.questionId !== q.id) continue;
        if (correctOptionId && ans.selectedOptionId === correctOptionId) right += 1;
      }
      return { question: q, right, of: submitted.length };
    });
  }, [detail, answers, submitted]);

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-[1400px] px-5 py-6 sm:px-8 sm:py-8">
          <Skeleton className="h-8 w-64" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-card" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm font-medium text-warm-brick">{error ?? "Quiz not found"}</p>
        <button
          onClick={onBack}
          className="rounded-button border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
        >
          Back to quizzes
        </button>
      </div>
    );
  }

  const quiz = detail.quiz;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              aria-label="Back to quizzes"
              className="flex h-10 w-10 items-center justify-center rounded-button border border-ink-200 text-ink-600 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[28px] font-semibold leading-tight text-ink-900 dark:text-warm-ivory">
                  {quiz.title}
                </h1>
                <StatusChip status={quiz.status} />
              </div>
              <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
                Due {formatDateTime(quiz.dueAt)} · {submitted.length} of {assignedStudents.length} submitted
              </p>
            </div>
          </div>
          <div className="rounded-card border border-ink-200/70 bg-warm-ivory px-4 py-3 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
              Class average
            </p>
            <p className="mt-0.5 font-mono text-2xl font-bold tabular-nums text-ink-900 dark:text-warm-ivory">
              {classAverage === null ? "—" : `${Math.round(classAverage * 100)}%`}
            </p>
          </div>
        </div>

        {/* Student roster */}
        <section className="mt-6">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">
            Students
          </h2>
          <div className="mt-3 overflow-hidden rounded-card border border-ink-200/70 shadow-soft dark:border-ink-800/70">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink-200/70 bg-ivory-dim/60 text-left text-[11px] font-bold uppercase tracking-wider text-ink-400 dark:border-ink-800/70 dark:bg-ink-800/40 dark:text-ink-500">
                  <th className="px-4 py-2.5 font-bold">Student</th>
                  <th className="px-4 py-2.5 font-bold">Status</th>
                  <th className="px-4 py-2.5 text-right font-bold">Score</th>
                  <th className="px-4 py-2.5 text-right font-bold">{gems.plural}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 bg-warm-ivory dark:divide-ink-800/70 dark:bg-ink-900">
                {assignedStudents.map((s, i) => {
                  const attempt = attemptByStudent.get(s.id);
                  const isSubmitted = !!attempt?.submittedAt;
                  const missed = !isSubmitted && pastDue;
                  return (
                    <tr key={s.id}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Monogram name={s.displayName} colorIndex={i} size="xs" />
                          <span className="font-medium text-ink-800 dark:text-ink-100">{s.displayName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {isSubmitted ? (
                          <StatusPill icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Submitted" tone="good" />
                        ) : missed ? (
                          <StatusPill icon={<XCircle className="h-3.5 w-3.5" />} label="Missed" tone="bad" />
                        ) : attempt ? (
                          <StatusPill icon={<Clock className="h-3.5 w-3.5" />} label="In progress" tone="neutral" />
                        ) : (
                          <StatusPill icon={<MinusCircle className="h-3.5 w-3.5" />} label="Not started" tone="neutral" />
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {isSubmitted && attempt?.totalCount ? (
                          <span className="font-mono font-semibold tabular-nums text-ink-800 dark:text-ink-100">
                            {attempt.correctCount}/{attempt.totalCount}
                            <span className="ml-1.5 text-ink-400 dark:text-ink-500">
                              {Math.round(((attempt.correctCount ?? 0) / attempt.totalCount) * 100)}%
                            </span>
                          </span>
                        ) : missed ? (
                          <span className="font-mono tabular-nums text-ink-400 dark:text-ink-500">0/{detail.questions.length}</span>
                        ) : (
                          <span className="text-ink-400 dark:text-ink-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-deep-gold dark:text-antique-gold">
                        {isSubmitted || missed ? attempt?.gemsAwarded ?? 0 : "—"}
                      </td>
                    </tr>
                  );
                })}
                {assignedStudents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-ink-400 dark:text-ink-500">
                      No students are assigned to this quiz.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Per-question breakdown */}
        <section className="mt-8 pb-8">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">
            Per question
          </h2>
          <div className="mt-3 space-y-3">
            {perQuestion.map(({ question, right, of }) => {
              const pct = of > 0 ? Math.round((right / of) * 100) : 0;
              return (
                <div
                  key={question.id}
                  className="rounded-card border border-ink-200/70 bg-warm-ivory p-4 shadow-soft dark:border-ink-800/70 dark:bg-ink-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 text-sm font-medium text-ink-800 dark:text-ink-100">
                      <span className="mr-1.5 font-mono text-xs font-bold text-ink-400 dark:text-ink-500">
                        Q{question.position}
                      </span>
                      {question.body}
                    </p>
                    <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-ink-700 dark:text-ink-200">
                      {right} of {of}
                      <span className="ml-1.5 text-ink-400 dark:text-ink-500">{pct}%</span>
                    </span>
                  </div>
                  <div
                    className="mt-2.5 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"
                    role="img"
                    aria-label={`Question ${question.position}: ${right} of ${of} students correct`}
                  >
                    <div
                      className={`h-full rounded-full ${pct >= 50 ? "bg-deep-gold dark:bg-antique-gold" : "bg-warm-brick dark:bg-brick-light"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {perQuestion.length === 0 && (
              <div className="flex items-center justify-center gap-2 rounded-card border-2 border-dashed border-ink-200 py-10 text-sm text-ink-500 dark:border-ink-700 dark:text-ink-400">
                <BarChart3 className="h-4 w-4" />
                This quiz has no questions.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusPill({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "good" | "bad" | "neutral";
}) {
  const styles = {
    good: "bg-deep-gold/10 text-deep-gold dark:bg-antique-gold/10 dark:text-antique-gold",
    bad: "bg-warm-brick/10 text-warm-brick dark:bg-warm-brick/15 dark:text-brick-light",
    neutral: "bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}>
      {icon}
      {label}
    </span>
  );
}
