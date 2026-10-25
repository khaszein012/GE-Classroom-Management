import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  BarChart3,
  CalendarClock,
  ClipboardList,
  Lock,
  Pencil,
  Plus,
  Rocket,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Store } from "@/lib/useStore";
import type { QuizSummary } from "@/types";
import { formatDateTime, relativeUntil } from "@/lib/time";
import { useCurrency } from "@/components/CurrencyProvider";
import { useConfirm } from "@/components/ConfirmDialog";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";
import { QuizEditor } from "@/components/QuizEditor";
import { QuizResults } from "@/components/QuizResults";

interface Props {
  store: Store;
}

export function QuizzesScreen({ store }: Props) {
  const [mode, setMode] = useState<{ view: "list" } | { view: "editor"; quizId?: string } | { view: "results"; quizId: string }>({
    view: "list",
  });

  if (mode.view === "editor") {
    return (
      <QuizEditor
        store={store}
        quizId={mode.quizId}
        onDone={() => setMode({ view: "list" })}
      />
    );
  }
  if (mode.view === "results") {
    return <QuizResults store={store} quizId={mode.quizId} onBack={() => setMode({ view: "list" })} />;
  }
  return <QuizList store={store} onEdit={(quizId) => setMode({ view: "editor", quizId })} onResults={(quizId) => setMode({ view: "results", quizId })} onNew={() => setMode({ view: "editor" })} />;
}

/** datetime-local input value for a timestamp (local timezone). */
function toLocalInputValue(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function QuizList({
  store,
  onEdit,
  onResults,
  onNew,
}: {
  store: Store;
  onEdit: (quizId: string) => void;
  onResults: (quizId: string) => void;
  onNew: () => void;
}) {
  const { quizzes, students, loading, quizzesError } = store;
  const { config } = useCurrency();
  const gems = config.achievement;
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [reopenFor, setReopenFor] = useState<QuizSummary | null>(null);
  const [reopenDue, setReopenDue] = useState("");
  const [reopenError, setReopenError] = useState<string | null>(null);

  // Live list: quizzes, attempts and assignments push changes straight in,
  // so submissions and status changes appear without a manual refresh.
  const refreshQuizzes = store.refreshQuizzes;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const ping = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void refreshQuizzes(), 500);
    };
    const channel = supabase
      .channel("teacher-quizzes")
      .on("postgres_changes", { event: "*", schema: "public", table: "quizzes" }, ping)
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_attempts" }, ping)
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_assignments" }, ping)
      .subscribe();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void supabase.removeChannel(channel);
    };
  }, [refreshQuizzes]);

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-[1400px] px-5 py-6 sm:px-8 sm:py-8">
          <Skeleton className="h-8 w-48" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] rounded-card" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (quizzesError) {
    const needsSetup = /schema cache|does not exist/i.test(quizzesError);
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        {needsSetup ? (
          <>
            <p className="max-w-md text-sm font-medium text-warm-brick">
              The quiz tables aren't in your database yet. Run the Phase 6 migration
              (supabase/migrations/20261025060000_20261025_phase6_quizzes.sql) in the Supabase
              dashboard's SQL Editor, then come back and retry.
            </p>
          </>
        ) : (
          <p className="text-sm font-medium text-warm-brick">{quizzesError}</p>
        )}
        <button
          onClick={() => void store.refreshQuizzes()}
          className="rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-4 py-2 text-sm font-semibold text-warm-ivory hover:bg-ink-700 dark:hover:bg-deep-gold"
        >
          Try again
        </button>
      </div>
    );
  }

  const active = quizzes.filter((q) => q.archivedAt === null);
  const archived = quizzes
    .filter((q) => q.archivedAt !== null)
    .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));

  const publish = (quiz: QuizSummary) => {
    confirm({
      title: "Publish quiz?",
      message: (
        <>
          <strong>{quiz.title}</strong> becomes visible to its assigned students immediately.
          They each get one attempt before the due date.
        </>
      ),
      confirmLabel: "Publish",
      onConfirm: () => {
        setBusyId(quiz.id);
        store
          .setQuizStatus(quiz.id, "published")
          .then(() => toast.show(`"${quiz.title}" published`, "positive"))
          .catch(() => toast.show("Could not publish — try again", "negative"))
          .finally(() => setBusyId(null));
      },
    });
  };

  const close = (quiz: QuizSummary) => {
    confirm({
      title: "Close quiz?",
      message: (
        <>
          <strong>{quiz.title}</strong> stops accepting submissions immediately, even before
          the due date. You can reopen it with a new due date at any time.
        </>
      ),
      confirmLabel: "Close quiz",
      onConfirm: () => {
        setBusyId(quiz.id);
        store
          .setQuizStatus(quiz.id, "closed")
          .then(() => toast.show(`"${quiz.title}" closed`, "info"))
          .catch(() => toast.show("Could not close — try again", "negative"))
          .finally(() => setBusyId(null));
      },
    });
  };

  const archive = (quiz: QuizSummary) => {
    confirm({
      title: "Archive quiz?",
      message: (
        <>
          <strong>{quiz.title}</strong> is hidden from students and moved out of your list.
          Results are kept and you can restore it anytime.
        </>
      ),
      confirmLabel: "Archive",
      onConfirm: () => {
        setBusyId(quiz.id);
        store
          .setQuizArchived(quiz.id, true)
          .then(() => toast.show(`"${quiz.title}" archived`, "info"))
          .catch(() => toast.show("Could not archive — try again", "negative"))
          .finally(() => setBusyId(null));
      },
    });
  };

  const restore = (quiz: QuizSummary) => {
    setBusyId(quiz.id);
    store
      .setQuizArchived(quiz.id, false)
      .then(() => toast.show(`"${quiz.title}" restored`, "positive"))
      .catch(() => toast.show("Could not restore — try again", "negative"))
      .finally(() => setBusyId(null));
  };

  const remove = (quiz: QuizSummary) => {
    confirm({
      title: "Delete quiz?",
      message: (
        <>
          This permanently deletes <strong>{quiz.title}</strong>
          {quiz.startedCount > 0
            ? ` along with all ${quiz.startedCount} ${quiz.startedCount === 1 ? "student attempt" : "student attempts"} and answers.`
            : ", its questions and assignments."}{" "}
          This can't be undone.
        </>
      ),
      confirmLabel: "Delete",
      onConfirm: () => {
        setBusyId(quiz.id);
        store
          .deleteQuiz(quiz.id)
          .then(() => toast.show(`"${quiz.title}" deleted`, "info"))
          .catch(() => toast.show("Could not delete — try again", "negative"))
          .finally(() => setBusyId(null));
      },
    });
  };

  const openReopen = (quiz: QuizSummary) => {
    // Default: the original due date if still in the future, otherwise tomorrow.
    const fallback = Date.now() + 24 * 60 * 60 * 1000;
    setReopenDue(toLocalInputValue(quiz.dueAt > Date.now() ? quiz.dueAt : fallback));
    setReopenError(null);
    setReopenFor(quiz);
  };

  const confirmReopen = async () => {
    if (!reopenFor) return;
    const dueMs = new Date(reopenDue).getTime();
    if (Number.isNaN(dueMs)) {
      setReopenError("Pick a due date and time.");
      return;
    }
    if (dueMs <= Date.now()) {
      setReopenError("The new due date must be in the future.");
      return;
    }
    setBusyId(reopenFor.id);
    try {
      await store.reopenQuiz(reopenFor.id, dueMs);
      toast.show(`"${reopenFor.title}" reopened`, "positive");
      setReopenFor(null);
    } catch {
      setReopenError("Could not reopen the quiz — try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-semibold leading-tight text-ink-900 dark:text-warm-ivory">
              Quizzes
            </h1>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
              {active.length === 0 && archived.length === 0
                ? `Build quizzes to award ${gems.plural.toLowerCase()}`
                : `${active.length} ${active.length === 1 ? "quiz" : "quizzes"} · sorted by due date${archived.length > 0 ? ` · ${archived.length} archived` : ""}`}
            </p>
          </div>
          {students.length > 0 && (
            <button
              onClick={onNew}
              className="flex h-10 items-center gap-2 rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-3 text-sm font-semibold text-warm-ivory transition-colors hover:bg-ink-700 dark:hover:bg-deep-gold"
            >
              <Plus className="h-4 w-4" />
              Create quiz
            </button>
          )}
        </header>

        <div className="mt-6 pb-8">
          {active.length === 0 && archived.length === 0 ? (
            students.length === 0 ? (
              <EmptyState
                title="Add students first"
                body={`Quizzes are assigned to students and reward them with ${gems.plural.toLowerCase()}. Add your students, then create your first quiz.`}
                action={undefined}
              />
            ) : (
              <EmptyState
                title="No quizzes yet"
                body={`A quiz is a set of multiple-choice and true/false questions. Students get one attempt, and earn ${gems.plural.toLowerCase()} based on their score.`}
                action={
                  <button
                    onClick={onNew}
                    className="mt-4 flex items-center gap-2 rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-4 py-2.5 text-sm font-semibold text-warm-ivory transition-colors hover:bg-ink-700 dark:hover:bg-deep-gold"
                  >
                    <Plus className="h-4 w-4" />
                    Create quiz
                  </button>
                }
              />
            )
          ) : active.length === 0 ? (
            <p className="rounded-card border-2 border-dashed border-ink-200 py-10 text-center text-sm text-ink-500 dark:border-ink-700 dark:text-ink-400">
              No active quizzes. {archived.length > 0 && "Restore one from the archive below, or create a new quiz."}
            </p>
          ) : (
            <ul className="space-y-3">
              {active.map((quiz) => (
                <QuizRow
                  key={quiz.id}
                  quiz={quiz}
                  busy={busyId === quiz.id}
                  onEdit={() => onEdit(quiz.id)}
                  onResults={() => onResults(quiz.id)}
                  onPublish={() => publish(quiz)}
                  onClose={() => close(quiz)}
                  onReopen={() => openReopen(quiz)}
                  onArchive={() => archive(quiz)}
                  onDelete={() => remove(quiz)}
                />
              ))}
            </ul>
          )}

          {archived.length > 0 && (
            <div className="mt-6 border-t border-ink-100 pt-4 dark:border-ink-800">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-600">
                  Archived — hidden from students, history kept
                </h2>
                <button
                  onClick={() => setShowArchived((v) => !v)}
                  className="flex h-9 items-center gap-1.5 rounded-button border border-ink-200 px-2.5 text-xs font-semibold text-ink-600 transition-colors hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
                >
                  <Archive className="h-3.5 w-3.5" />
                  {showArchived ? "Hide archived" : `Show archived (${archived.length})`}
                </button>
              </div>
              {showArchived && (
                <ul className="space-y-2">
                  {archived.map((quiz) => (
                    <li
                      key={quiz.id}
                      className={`flex flex-wrap items-center gap-3 rounded-button border border-ink-100 bg-ink-50/50 px-3 py-2.5 dark:border-ink-800 dark:bg-ink-800/30 ${
                        busyId === quiz.id ? "opacity-50" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-ink-700 dark:text-ink-300">
                            {quiz.title}
                          </span>
                          <StatusChip status={quiz.status} />
                        </div>
                        <div className="text-xs text-ink-400 dark:text-ink-500">
                          {quiz.submittedCount} of {quiz.assignedCount} submitted
                          {quiz.submittedCount > 0 && " · results kept"}
                        </div>
                      </div>
                      {quiz.status !== "draft" && (
                        <ActionButton
                          label="Results"
                          icon={<BarChart3 className="h-4 w-4" />}
                          onClick={() => onResults(quiz.id)}
                          disabled={busyId === quiz.id}
                        />
                      )}
                      <ActionButton
                        label="Restore"
                        icon={<ArchiveRestore className="h-4 w-4" />}
                        onClick={() => restore(quiz)}
                        disabled={busyId === quiz.id}
                      />
                      <ActionButton
                        label="Delete"
                        icon={<Trash2 className="h-4 w-4" />}
                        onClick={() => remove(quiz)}
                        danger
                        disabled={busyId === quiz.id}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reopen a closed quiz with a fresh due date */}
      <Modal
        open={reopenFor !== null}
        title="Reopen quiz"
        onClose={() => setReopenFor(null)}
        onConfirm={() => void confirmReopen()}
        confirmLabel="Reopen"
      >
        {reopenFor && (
          <div className="space-y-3">
            <p className="text-sm text-ink-600 dark:text-ink-300">
              <strong>{reopenFor.title}</strong> becomes available to its assigned students
              again. Students who already attempted keep their result — the new due date only
              opens the door for everyone else.
            </p>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">
                New due date and time
              </label>
              <input
                type="datetime-local"
                value={reopenDue}
                onChange={(e) => {
                  setReopenDue(e.target.value);
                  setReopenError(null);
                }}
                className="h-11 w-full rounded-button border border-ink-200 bg-warm-ivory px-3 text-sm outline-none transition-colors focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800 dark:[color-scheme:dark]"
              />
              {reopenError && <p className="mt-1 text-xs text-warm-brick">{reopenError}</p>}
            </div>
          </div>
        )}
      </Modal>

      {dialog}
    </div>
  );
}

function QuizRow({
  quiz,
  busy,
  onEdit,
  onResults,
  onPublish,
  onClose,
  onReopen,
  onArchive,
  onDelete,
}: {
  quiz: QuizSummary;
  busy: boolean;
  onEdit: () => void;
  onResults: () => void;
  onPublish: () => void;
  onClose: () => void;
  onReopen: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const overdue = quiz.dueAt < Date.now();
  return (
    <li className="rounded-card border border-ink-200/70 bg-warm-ivory p-4 shadow-soft dark:border-ink-800/70 dark:bg-ink-900 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-ink-900 dark:text-warm-ivory">
              {quiz.title}
            </h2>
            <StatusChip status={quiz.status} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-ink-500 dark:text-ink-400">
            <span className="tabular-nums">
              {quiz.questionCount} {quiz.questionCount === 1 ? "question" : "questions"}
            </span>
            <span className="tabular-nums">
              Up to {quiz.maxGems} gems
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" />
              {formatDateTime(quiz.dueAt)}
              {quiz.status === "published" && (
                <span className={overdue ? "text-warm-brick dark:text-brick-light" : ""}>
                  ({overdue ? "past due" : relativeUntil(quiz.dueAt)})
                </span>
              )}
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold tabular-nums text-deep-gold dark:text-antique-gold">
            {quiz.submittedCount} of {quiz.assignedCount} submitted
            {quiz.startedCount > quiz.submittedCount && (
              <span className="font-medium text-ink-400 dark:text-ink-500">
                {" "}
                · {quiz.startedCount - quiz.submittedCount} in progress
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {quiz.status === "draft" && (
            <ActionButton label="Publish" icon={<Rocket className="h-4 w-4" />} onClick={onPublish} primary disabled={busy} />
          )}
          {quiz.status === "published" && (
            <ActionButton label="Close" icon={<Lock className="h-4 w-4" />} onClick={onClose} disabled={busy} />
          )}
          {quiz.status === "closed" && (
            <ActionButton label="Reopen" icon={<RotateCcw className="h-4 w-4" />} onClick={onReopen} disabled={busy} />
          )}
          {quiz.status !== "draft" && (
            <ActionButton label="Results" icon={<BarChart3 className="h-4 w-4" />} onClick={onResults} disabled={busy} />
          )}
          <ActionButton label="Edit" icon={<Pencil className="h-4 w-4" />} onClick={onEdit} disabled={busy} />
          <ActionButton label="Archive" icon={<Archive className="h-4 w-4" />} onClick={onArchive} disabled={busy} />
          <ActionButton label="Delete" icon={<Trash2 className="h-4 w-4" />} onClick={onDelete} danger disabled={busy} />
        </div>
      </div>
    </li>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  primary,
  danger,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-10 min-w-[40px] items-center justify-center gap-1.5 rounded-button border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-ink-900 ${
        primary
          ? "border-transparent bg-obsidian text-warm-ivory hover:bg-ink-700 dark:bg-antique-gold dark:text-obsidian dark:hover:bg-deep-gold"
          : danger
            ? "border-ink-200 text-warm-brick hover:bg-warm-brick/10 dark:border-ink-700 dark:text-brick-light dark:hover:bg-warm-brick/15"
            : "border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
      }`}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

export function StatusChip({ status }: { status: QuizSummary["status"] }) {
  const styles: Record<QuizSummary["status"], string> = {
    draft: "bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400",
    published: "bg-antique-gold/15 text-deep-gold dark:bg-antique-gold/10 dark:text-antique-gold",
    closed: "bg-warm-brick/10 text-warm-brick dark:bg-warm-brick/15 dark:text-brick-light",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border-2 border-dashed border-ink-200 bg-warm-ivory/50 py-16 text-center dark:border-ink-700 dark:bg-ink-900/40">
      <div className="flex h-16 w-16 items-center justify-center rounded-card bg-ivory-dim dark:bg-antique-gold/10">
        <ClipboardList className="h-8 w-8 text-deep-gold" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-ink-900 dark:text-warm-ivory">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-ink-500 dark:text-ink-400">{body}</p>
      {action}
    </div>
  );
}
