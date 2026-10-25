import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Lock,
  Plus,
  Rocket,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { QUIZ_CSV_TEMPLATE, downloadText, parseQuizCsv } from "@/lib/csv";
import type { Store } from "@/lib/useStore";
import type { QuizQuestionType } from "@/types";
import type { QuizQuestionDraft } from "@/lib/storage";
import { getQuizDetail, getQuizAttempts } from "@/lib/storage";
import { Monogram } from "@/components/Monogram";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { loadSortMode, sortStudents } from "@/lib/sortStudents";
import { useCurrency } from "@/components/CurrencyProvider";

interface Props {
  store: Store;
  quizId?: string;
  onDone: () => void;
}

interface DraftOption {
  key: string;
  body: string;
  isCorrect: boolean;
}

interface DraftQuestion {
  key: string;
  type: QuizQuestionType;
  body: string;
  options: DraftOption[];
}

let keySeq = 0;
const nextKey = () => `q${++keySeq}`;

function newMultipleChoice(): DraftQuestion {
  return {
    key: nextKey(),
    type: "multiple_choice",
    body: "",
    options: [
      { key: nextKey(), body: "", isCorrect: true },
      { key: nextKey(), body: "", isCorrect: false },
    ],
  };
}

function newTrueFalse(): DraftQuestion {
  return {
    key: nextKey(),
    type: "true_false",
    body: "",
    options: [
      { key: nextKey(), body: "True", isCorrect: true },
      { key: nextKey(), body: "False", isCorrect: false },
    ],
  };
}

function toLocalInputValue(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function QuizEditor({ store, quizId, onDone }: Props) {
  const toast = useToast();
  const { config } = useCurrency();
  const gems = config.achievement;
  const [loading, setLoading] = useState(quizId !== undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxGems, setMaxGems] = useState(10);
  const [dueInput, setDueInput] = useState(() => toLocalInputValue(Date.now() + 7 * 86_400_000));
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [validation, setValidation] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [attemptsExist, setAttemptsExist] = useState(false);
  const [loadedMaxGems, setLoadedMaxGems] = useState<number | null>(null);
  const [importReport, setImportReport] = useState<{ added: number; errors: string[] } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  /** Bulk-import questions from a CSV file (template available in the UI). */
  const handleCsvFile = async (file: File) => {
    try {
      const text = await file.text();
      const { questions: parsed, errors } = parseQuizCsv(text);
      if (parsed.length > 0) {
        setQuestions((prev) => [
          ...prev,
          ...parsed.map((q) => ({
            key: nextKey(),
            type: q.type,
            body: q.body,
            options: q.options.map((o) => ({ key: nextKey(), body: o.body, isCorrect: o.isCorrect })),
          })),
        ]);
      }
      setImportReport({ added: parsed.length, errors });
      if (parsed.length > 0) {
        toast.show(`Imported ${parsed.length} ${parsed.length === 1 ? "question" : "questions"}`, "positive");
      }
    } catch {
      setImportReport({ added: 0, errors: ["Couldn't read the file — make sure it is a .csv text file."] });
    }
  };

  const summary = quizId ? store.quizzes.find((q) => q.id === quizId) : undefined;
  // Once any attempt exists, scoring is frozen: questions, options and max
  // gems cannot change. Title, description and due date stay editable.
  // Checked against the database on load, not just the cached list.
  const locked = attemptsExist || (!!summary && summary.startedCount > 0);

  const activeStudents = useMemo(
    () =>
      sortStudents(
        store.students.filter((s) => s.isActive),
        loadSortMode(),
        store.totals,
        store.transactions,
      ),
    [store.students, store.totals, store.transactions],
  );
  const everyone = activeStudents.length > 0 && selectedStudents.size === activeStudents.length;

  // New quizzes are assigned to everyone by default (the spec's picker
  // default). Runs once the roster is available; never re-applies after the
  // teacher has made any selection.
  const defaultedRef = useRef(false);
  useEffect(() => {
    if (quizId || defaultedRef.current || activeStudents.length === 0) return;
    defaultedRef.current = true;
    setSelectedStudents((prev) =>
      prev.size === 0 ? new Set(activeStudents.map((s) => s.id)) : prev,
    );
  }, [quizId, activeStudents]);

  useEffect(() => {
    if (!quizId) return;
    Promise.all([getQuizDetail(quizId), getQuizAttempts(quizId)])
      .then(([detail, attempts]) => {
        setTitle(detail.quiz.title);
        setDescription(detail.quiz.description ?? "");
        setMaxGems(detail.quiz.maxGems);
        setLoadedMaxGems(detail.quiz.maxGems);
        setDueInput(toLocalInputValue(detail.quiz.dueAt));
        setAttemptsExist(attempts.length > 0);
        setQuestions(
          detail.questions.map((q) => ({
            key: nextKey(),
            type: q.type,
            body: q.body,
            options: q.options.map((o) => ({
              key: nextKey(),
              body: o.body,
              isCorrect: o.isCorrect,
            })),
          })),
        );
        setSelectedStudents(new Set(detail.assignedStudentIds));
      })
      .catch(() => setLoadError("Couldn't load this quiz. Go back and try again."))
      .finally(() => setLoading(false));
  }, [quizId]);

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-[1400px] px-5 py-6 sm:px-8 sm:py-8">
          <Skeleton className="h-8 w-56" />
          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-96 rounded-card lg:col-span-2" />
            <Skeleton className="h-96 rounded-card" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm font-medium text-warm-brick">{loadError}</p>
        <button
          onClick={onDone}
          className="rounded-button border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
        >
          Back to quizzes
        </button>
      </div>
    );
  }

  const patchQuestion = (key: string, patch: Partial<DraftQuestion>) =>
    setQuestions((prev) => prev.map((q) => (q.key === key ? { ...q, ...patch } : q)));

  const moveQuestion = (index: number, dir: -1 | 1) =>
    setQuestions((prev) => {
      const to = index + dir;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });

  const markCorrect = (q: DraftQuestion, optionKey: string) =>
    patchQuestion(q.key, {
      options: q.options.map((o) => ({ ...o, isCorrect: o.key === optionKey })),
    });

  const setQuestionType = (q: DraftQuestion, type: QuizQuestionType) => {
    if (q.type === type) return;
    patchQuestion(q.key, type === "true_false" ? { ...newTrueFalse(), body: q.body, key: q.key } : { ...newMultipleChoice(), body: q.body, key: q.key });
  };

  const toggleStudent = (id: string) =>
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleEveryone = () => {
    if (everyone) setSelectedStudents(new Set());
    else setSelectedStudents(new Set(activeStudents.map((s) => s.id)));
  };

  const validate = (forPublish: boolean): string[] => {
    const issues: string[] = [];
    if (!title.trim()) issues.push("Title is required");
    const dueMs = new Date(dueInput).getTime();
    if (Number.isNaN(dueMs)) issues.push("Due date is invalid");
    else if (forPublish && dueMs <= Date.now()) issues.push("Due date must be in the future");
    if (forPublish) {
      if (!locked) {
        if (questions.length === 0) issues.push("Add at least one question");
        questions.forEach((q, i) => {
          const n = i + 1;
          if (!q.body.trim()) issues.push(`Question ${n} is empty`);
          if (q.type === "multiple_choice" && q.options.length < 2)
            issues.push(`Question ${n} needs at least 2 options`);
          if (q.options.some((o) => !o.body.trim())) issues.push(`Question ${n} has an empty option`);
          if (q.options.filter((o) => o.isCorrect).length !== 1)
            issues.push(`Question ${n} must have exactly one correct answer`);
        });
      }
      if (selectedStudents.size === 0) issues.push("Assign at least one student");
    }
    return issues;
  };

  const buildDraft = (): QuizQuestionDraft[] =>
    questions.map((q, i) => ({
      body: q.body,
      type: q.type,
      position: i + 1,
      options: q.options.map((o, j) => ({ body: o.body, isCorrect: o.isCorrect, position: j + 1 })),
    }));

  const save = async (publish: boolean) => {
    const issues = validate(publish);
    setValidation(issues);
    if (issues.length > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setBusy(true);
    try {
      const savedId = await store.saveQuiz({
        id: quizId,
        title,
        description,
        maxGems: locked ? (loadedMaxGems ?? maxGems) : maxGems,
        dueAt: new Date(dueInput).getTime(),
        questions: locked ? null : buildDraft(),
        assignedStudentIds: Array.from(selectedStudents),
      });
      if (publish) {
        await store.setQuizStatus(savedId, "published");
        toast.show(`"${title.trim()}" published`, "positive");
      } else {
        toast.show("Quiz saved", "positive");
      }
      onDone();
    } catch {
      toast.show("Could not save — try again", "negative");
    } finally {
      setBusy(false);
    }
  };

  const isNew = !quizId;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onDone}
              aria-label="Back to quizzes"
              className="flex h-10 w-10 items-center justify-center rounded-button border border-ink-200 text-ink-600 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-[28px] font-semibold leading-tight text-ink-900 dark:text-warm-ivory">
                {isNew ? "New quiz" : "Edit quiz"}
              </h1>
              <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">
                {locked
                  ? "Has student attempts — questions and max gems are locked"
                  : summary?.status === "published"
                    ? "Published — no attempts yet, still fully editable"
                    : `Students earn up to ${maxGems} ${gems.plural.toLowerCase()}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void save(false)}
              disabled={busy}
              className="flex h-10 items-center gap-2 rounded-button border border-ink-200 px-3 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-60 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
            >
              <Save className="h-4 w-4" />
              {summary?.status === "published" || summary?.status === "closed" ? "Save changes" : "Save draft"}
            </button>
            {summary?.status !== "published" && summary?.status !== "closed" && (
              <button
                onClick={() => void save(true)}
                disabled={busy}
                className="flex h-10 items-center gap-2 rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-3 text-sm font-semibold text-warm-ivory transition-colors hover:bg-ink-700 disabled:opacity-60 dark:hover:bg-deep-gold"
              >
                <Rocket className="h-4 w-4" />
                Publish
              </button>
            )}
          </div>
        </div>

        {validation.length > 0 && (
          <div
            role="alert"
            className="mt-5 rounded-card border border-warm-brick/40 bg-warm-brick/5 px-4 py-3 dark:border-brick-light/30 dark:bg-warm-brick/10"
          >
            <p className="text-sm font-semibold text-warm-brick dark:text-brick-light">
              Before this quiz can be published:
            </p>
            <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-sm text-warm-brick dark:text-brick-light">
              {validation.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          </div>
        )}

        {locked && (
          <div className="mt-5 flex items-start gap-3 rounded-card border border-antique-gold bg-ivory-dim px-4 py-3 dark:border-antique-gold/30 dark:bg-antique-gold/10">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-deep-gold dark:text-antique-gold" />
            <p className="text-sm text-deep-gold dark:text-antique-gold">
              {summary!.startedCount} {summary!.startedCount === 1 ? "student has" : "students have"} already
              attempted this quiz, so questions, options and max {gems.plural.toLowerCase()} are locked to keep
              scoring fair. You can still change the title, description and due date.
            </p>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Left column: details + questions */}
          <div className="space-y-6 lg:col-span-2">
            <section className="rounded-card border border-ink-200/70 bg-warm-ivory p-5 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Title" full>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Fractions review"
                    className="h-10 w-full rounded-button border border-ink-200 bg-warm-ivory px-3 text-sm outline-none transition-colors placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800"
                  />
                </Field>
                <Field label="Description (optional)" full>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What this quiz covers"
                    className="h-10 w-full rounded-button border border-ink-200 bg-warm-ivory px-3 text-sm outline-none transition-colors placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800"
                  />
                </Field>
                <Field label={`Max ${gems.plural.toLowerCase()}`}>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMaxGems(Math.max(1, maxGems - 1))}
                      disabled={locked}
                      aria-label={`Decrease max ${gems.plural.toLowerCase()}`}
                      className="h-11 w-11 shrink-0 rounded-button bg-ink-100 text-ink-700 transition-colors hover:bg-ink-200 disabled:opacity-40 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={maxGems}
                      disabled={locked}
                      onChange={(e) => setMaxGems(Math.min(1000, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                      className="h-11 w-24 rounded-button border border-ink-200 bg-warm-ivory px-3 text-center font-mono text-sm font-bold outline-none focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 disabled:opacity-40 dark:border-ink-700 dark:bg-ink-800"
                    />
                    <button
                      onClick={() => setMaxGems(Math.min(1000, maxGems + 1))}
                      disabled={locked}
                      aria-label={`Increase max ${gems.plural.toLowerCase()}`}
                      className="h-11 w-11 shrink-0 rounded-button bg-ink-100 text-ink-700 transition-colors hover:bg-ink-200 disabled:opacity-40 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700"
                    >
                      +
                    </button>
                  </div>
                </Field>
                <Field label="Due date and time">
                  <input
                    type="datetime-local"
                    value={dueInput}
                    onChange={(e) => setDueInput(e.target.value)}
                    className="h-11 w-full rounded-button border border-ink-200 bg-warm-ivory px-3 text-sm outline-none transition-colors focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800 dark:[color-scheme:dark]"
                  />
                </Field>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">
                  Questions ({questions.length})
                </h2>
              </div>
              <div className="mt-3 space-y-4">
                {questions.length === 0 && (
                  <div className="rounded-card border-2 border-dashed border-ink-200 py-10 text-center text-sm text-ink-500 dark:border-ink-700 dark:text-ink-400">
                    No questions yet. Add the first one below.
                  </div>
                )}
                {questions.map((q, i) => (
                  <QuestionCard
                    key={q.key}
                    index={i}
                    total={questions.length}
                    question={q}
                    locked={locked}
                    onPatch={(patch) => patchQuestion(q.key, patch)}
                    onMove={(dir) => moveQuestion(i, dir)}
                    onMarkCorrect={(optionKey) => markCorrect(q, optionKey)}
                    onType={(type) => setQuestionType(q, type)}
                    onDelete={() => setQuestions((prev) => prev.filter((x) => x.key !== q.key))}
                  />
                ))}
              </div>
              {!locked && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => setQuestions((prev) => [...prev, newMultipleChoice()])}
                    className="flex h-10 items-center gap-2 rounded-button border border-ink-200 px-3 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
                  >
                    <Plus className="h-4 w-4" />
                    Multiple choice
                  </button>
                  <button
                    onClick={() => setQuestions((prev) => [...prev, newTrueFalse()])}
                    className="flex h-10 items-center gap-2 rounded-button border border-ink-200 px-3 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
                  >
                    <Plus className="h-4 w-4" />
                    True / false
                  </button>
                  <button
                    onClick={() => csvInputRef.current?.click()}
                    className="flex h-10 items-center gap-2 rounded-button border border-ink-200 px-3 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
                  >
                    <Upload className="h-4 w-4" />
                    Import CSV
                  </button>
                  <button
                    onClick={() => downloadText("quiz-template.csv", QUIZ_CSV_TEMPLATE)}
                    className="flex h-10 items-center gap-2 rounded-button px-3 text-sm font-semibold text-deep-gold transition-colors hover:bg-ink-50 dark:text-antique-gold dark:hover:bg-ink-800/60"
                  >
                    <Download className="h-4 w-4" />
                    Template
                  </button>
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    className="hidden"
                    aria-label="Import questions from CSV"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleCsvFile(file);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}

              {importReport && (
                <div
                  role="status"
                  className={`mt-4 rounded-card border px-4 py-3 text-sm ${
                    importReport.errors.length > 0
                      ? "border-warm-brick/40 bg-warm-brick/5 dark:border-brick-light/30 dark:bg-warm-brick/10"
                      : "border-deep-gold/40 bg-ivory-dim dark:border-antique-gold/30 dark:bg-antique-gold/10"
                  }`}
                >
                  <p className="font-semibold text-ink-800 dark:text-ink-100">
                    Imported {importReport.added} {importReport.added === 1 ? "question" : "questions"}
                    {importReport.errors.length > 0 && ` · ${importReport.errors.length} ${importReport.errors.length === 1 ? "row" : "rows"} skipped`}
                  </p>
                  {importReport.errors.length > 0 && (
                    <ul className="mt-1.5 max-h-32 list-inside list-disc space-y-0.5 overflow-y-auto text-xs text-warm-brick dark:text-brick-light">
                      {importReport.errors.map((err) => (
                        <li key={err}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* Right column: assignment */}
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <section className="rounded-card border border-ink-200/70 bg-warm-ivory p-5 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">
                Assign to
              </h2>
              <button
                onClick={toggleEveryone}
                aria-pressed={everyone}
                className={`mt-3 flex min-h-11 w-full items-center justify-between rounded-button border px-3 py-2 text-sm font-semibold transition-colors ${
                  everyone
                    ? "border-antique-gold bg-ivory-dim text-deep-gold dark:bg-antique-gold/10 dark:text-antique-gold"
                    : "border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
                }`}
              >
                Everyone
                <span className="flex items-center gap-2">
                  <span className="text-xs font-medium text-ink-400 dark:text-ink-500">
                    {selectedStudents.size} of {activeStudents.length}
                  </span>
                  {everyone ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <span className="h-5 w-5 rounded-full border-2 border-ink-300 dark:border-ink-600" />
                  )}
                </span>
              </button>
              <div className="mt-3 max-h-[420px] space-y-1 overflow-y-auto pr-1">
                {activeStudents.map((s, i) => {
                  const checked = selectedStudents.has(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleStudent(s.id)}
                      aria-pressed={checked}
                      className={`flex min-h-11 w-full items-center gap-2.5 rounded-button px-2.5 py-1.5 text-left text-sm transition-colors ${
                        checked
                          ? "bg-ivory-dim dark:bg-antique-gold/10"
                          : "hover:bg-ink-50 dark:hover:bg-ink-800/60"
                      }`}
                    >
                      <Monogram name={s.displayName} colorIndex={i} size="xs" />
                      <span
                        className={`min-w-0 flex-1 truncate font-medium ${
                          checked
                            ? "text-deep-gold dark:text-antique-gold"
                            : "text-ink-700 dark:text-ink-200"
                        }`}
                      >
                        {s.displayName}
                      </span>
                      {checked ? (
                        <Check className="h-4 w-4 text-deep-gold dark:text-antique-gold" />
                      ) : (
                        <span className="h-4 w-4 rounded-sm border-2 border-ink-300 dark:border-ink-600" />
                      )}
                    </button>
                  );
                })}
                {activeStudents.length === 0 && (
                  <p className="py-4 text-center text-sm text-ink-400 dark:text-ink-500">
                    No active students yet.
                  </p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">
        {label}
      </label>
      {children}
    </div>
  );
}

function QuestionCard({
  index,
  total,
  question,
  locked,
  onPatch,
  onMove,
  onMarkCorrect,
  onType,
  onDelete,
}: {
  index: number;
  total: number;
  question: DraftQuestion;
  locked: boolean;
  onPatch: (patch: Partial<DraftQuestion>) => void;
  onMove: (dir: -1 | 1) => void;
  onMarkCorrect: (optionKey: string) => void;
  onType: (type: QuizQuestionType) => void;
  onDelete: () => void;
}) {
  const q = question;
  return (
    <div className="rounded-card border border-ink-200/70 bg-warm-ivory p-4 shadow-soft dark:border-ink-800/70 dark:bg-ink-900 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="font-mono text-xs font-bold text-ink-400 dark:text-ink-500">
            Q{index + 1}
          </span>
          <div className="flex rounded-button border border-ink-200 bg-warm-ivory p-0.5 dark:border-ink-700 dark:bg-ink-800">
            <button
              onClick={() => onType("multiple_choice")}
              disabled={locked}
              aria-pressed={q.type === "multiple_choice"}
              className={`rounded-button px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                q.type === "multiple_choice"
                  ? "bg-obsidian text-warm-ivory dark:bg-antique-gold dark:text-obsidian"
                  : "text-ink-500 dark:text-ink-400"
              }`}
            >
              Multiple choice
            </button>
            <button
              onClick={() => onType("true_false")}
              disabled={locked}
              aria-pressed={q.type === "true_false"}
              className={`rounded-button px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                q.type === "true_false"
                  ? "bg-obsidian text-warm-ivory dark:bg-antique-gold dark:text-obsidian"
                  : "text-ink-500 dark:text-ink-400"
              }`}
            >
              True / false
            </button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconAction label={`Move question ${index + 1} up`} disabled={index === 0 || locked} onClick={() => onMove(-1)}>
            <ChevronUp className="h-4 w-4" />
          </IconAction>
          <IconAction
            label={`Move question ${index + 1} down`}
            disabled={index === total - 1 || locked}
            onClick={() => onMove(1)}
          >
            <ChevronDown className="h-4 w-4" />
          </IconAction>
          <IconAction label={`Delete question ${index + 1}`} disabled={locked} onClick={onDelete} danger>
            <Trash2 className="h-4 w-4" />
          </IconAction>
        </div>
      </div>

      <textarea
        value={q.body}
        disabled={locked}
        onChange={(e) => onPatch({ body: e.target.value })}
        placeholder="Type the question…"
        rows={2}
        className="mt-3 w-full resize-y rounded-button border border-ink-200 bg-warm-ivory px-3 py-2 text-sm outline-none transition-colors placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 disabled:opacity-60 dark:border-ink-700 dark:bg-ink-800"
      />

      <div className="mt-3 space-y-2" role="group" aria-label={`Correct answer for question ${index + 1}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
          Options — mark the correct one
        </p>
        {q.options.map((o, oi) => (
          <div key={o.key} className="flex items-center gap-2">
            <button
              onClick={() => onMarkCorrect(o.key)}
              disabled={locked}
              aria-pressed={o.isCorrect}
              aria-label={`Mark option ${oi + 1} as the correct answer`}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
                o.isCorrect
                  ? "bg-deep-gold text-warm-ivory dark:bg-antique-gold dark:text-obsidian"
                  : "border-2 border-ink-300 text-ink-400 hover:border-antique-gold dark:border-ink-600"
              }`}
            >
              {o.isCorrect ? <Check className="h-4 w-4" strokeWidth={3} /> : <span className="text-xs font-bold">{oi + 1}</span>}
            </button>
            <input
              value={o.body}
              disabled={locked || q.type === "true_false"}
              onChange={(e) =>
                onPatch({
                  options: q.options.map((x) => (x.key === o.key ? { ...x, body: e.target.value } : x)),
                })
              }
              placeholder={q.type === "true_false" ? o.body : `Option ${oi + 1}`}
              aria-label={`Option ${oi + 1} text`}
              className="h-11 min-w-0 flex-1 rounded-button border border-ink-200 bg-warm-ivory px-3 text-sm outline-none transition-colors placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 disabled:opacity-60 dark:border-ink-700 dark:bg-ink-800"
            />
            {q.type === "multiple_choice" && q.options.length > 2 && !locked && (
              <IconAction
                label={`Remove option ${oi + 1}`}
                onClick={() =>
                  onPatch({ options: q.options.filter((x) => x.key !== o.key) })
                }
                danger
              >
                <X className="h-4 w-4" />
              </IconAction>
            )}
          </div>
        ))}
        {q.type === "multiple_choice" && q.options.length < 5 && !locked && (
          <button
            onClick={() =>
              onPatch({
                options: [...q.options, { key: nextKey(), body: "", isCorrect: false }],
              })
            }
            className="flex min-h-11 items-center gap-1.5 rounded-button border-2 border-dashed border-ink-200 px-3 text-xs font-semibold text-ink-500 transition-colors hover:border-antique-gold hover:text-deep-gold dark:border-ink-700 dark:text-ink-400 dark:hover:border-antique-gold/40 dark:hover:text-antique-gold"
          >
            <Plus className="h-3.5 w-3.5" />
            Add option
          </button>
        )}
      </div>
    </div>
  );
}

function IconAction({
  label,
  children,
  onClick,
  disabled,
  danger,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-10 w-10 items-center justify-center rounded-button transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-antique-gold disabled:opacity-30 ${
        danger
          ? "text-warm-brick hover:bg-warm-brick/10 dark:text-brick-light dark:hover:bg-warm-brick/15"
          : "text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-200"
      }`}
    >
      {children}
    </button>
  );
}
