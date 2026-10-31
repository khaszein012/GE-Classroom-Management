import { useCallback, useEffect, useState } from "react";
import type { Behavior, PointTransaction, Redemption, RewardCurrency, Student, TransactionType } from "@/types";
import type { CurrencyConfig, QuizStatus, QuizSummary, Reward } from "@/types";
import type { QuizQuestionDraft } from "@/lib/storage";
import * as storage from "@/lib/storage";
import { DEFAULT_CURRENCY_CONFIG } from "@/lib/currency";
import type { ColorTheme } from "@/lib/themes";
import { applyColorTheme } from "@/lib/themes";

/**
 * Single source of truth for app state in React. The UI calls these
 * actions and re-reads derived maps. All persistence goes through the
 * storage layer (Supabase); this hook's public shape matches the
 * previous localStorage implementation, so components are unchanged.
 */
export function useStore() {
  const [students, setStudents] = useState<Student[]>([]);
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [lifetime, setLifetime] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizzesError, setQuizzesError] = useState<string | null>(null);
  const [currencyConfig, setCurrencyConfig] = useState<CurrencyConfig>(DEFAULT_CURRENCY_CONFIG);
  const [colorTheme, setColorTheme] = useState<ColorTheme>("genji");
  const [classes, setClasses] = useState<storage.ClassInfo[]>([]);
  const [activeClassId, setActiveClassId] = useState<number>(() => {
    const stored = Number(localStorage.getItem("cr_active_class"));
    return Number.isFinite(stored) && stored > 0 ? stored : 1;
  });
  const [classGoal, setClassGoal] = useState<{ target: number | null; label: string | null }>({
    target: null,
    label: null,
  });

  const applyDerived = useCallback((txns: PointTransaction[]) => {
    const totalsMap: Record<string, number> = {};
    const lifetimeMap: Record<string, number> = {};
    for (const t of txns) {
      if (t.isUndone) continue;
      // Achievement (gems) rows are a separate score: they never count
      // toward the behavior-currency balance or lifetime totals.
      if (t.type === "achievement") continue;
      totalsMap[t.studentId] = (totalsMap[t.studentId] ?? 0) + t.amount;
      if (t.amount > 0) lifetimeMap[t.studentId] = (lifetimeMap[t.studentId] ?? 0) + t.amount;
    }
    setTotals(totalsMap);
    setLifetime(lifetimeMap);
  }, []);

  const refresh = useCallback(
    async (activeClassId: number) => {
    try {
      const [s, b, t, settings, r, rd] = await Promise.all([
        storage.getStudents(activeClassId),
        storage.getBehaviors(activeClassId),
        storage.getTransactions(activeClassId),
        storage.getClassSettings(),
        storage.getRewards(activeClassId),
        storage.getRedemptions(activeClassId),
      ]);
      // Classes load fail-soft: before the multi-class migration the table
      // doesn't exist and the console keeps working on the default class.
      storage
        .getClasses()
        .then(setClasses)
        .catch(() => setClasses([]));
      setStudents(s);
      setBehaviors(b);
      setTransactions(t);
      applyDerived(t);
      setRewards(r);
      setRedemptions(rd);
      if (settings) setCurrencyConfig(settings.currencyConfig);
      setColorTheme(settings?.teacherTheme ?? "genji");
      const active = classes.find((c) => c.id === activeClassId);
      setClassGoal({
        target: active?.class_goal_target ?? null,
        label: active?.class_goal_label ?? null,
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
    },
    [applyDerived],
  );

  /** Switch the active class: persisted + everything reloads scoped. */
  const switchClass = useCallback((classId: number) => {
    setActiveClassId(classId);
    setQuizzesError(null);
    setError(null);
    try {
      localStorage.setItem("cr_active_class", String(classId));
    } catch {
      /* ignore */
    }
    setLoading(true);
  }, []);

  // Quizzes load independently so a quiz-table problem can never take down
  // the awarding/shop screens (and vice versa).
  const refreshQuizzes = useCallback(async () => {
    try {
      setQuizzes(await storage.getQuizzes(activeClassId));
      setQuizzesError(null);
    } catch (e) {
      setQuizzesError(e instanceof Error ? e.message : "Failed to load quizzes");
    }
  }, [activeClassId]);

  useEffect(() => {
    void refresh(activeClassId);
    void refreshQuizzes();
  }, [refresh, refreshQuizzes, activeClassId]);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      try {
        await fn();
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Operation failed");
        throw e;
      } finally {
        await refresh(activeClassId);
      }
    },
    [refresh, activeClassId],
  );

  const addStudent = useCallback(
    (displayName: string, avatarColor: number) =>
      run(async () => {
        await storage.addStudent({
          displayName,
          avatarColor,
          classId: activeClassId,
        });
      }),
    [run, activeClassId],
  );

  const addStudentWithPin = useCallback(
    (input: { displayName: string; avatarColor: number; username: string; pin: string }) =>
      run(async () => {
        await storage.addStudent({
          displayName: input.displayName,
          avatarColor: input.avatarColor,
          username: input.username,
          pin: input.pin,
          classId: activeClassId,
        });
      }).then(() => undefined),
    [run, activeClassId],
  );

  const updateStudent = useCallback(
    (id: string, patch: Partial<Pick<Student, "displayName" | "avatarColor" | "username">>) =>
      run(() => storage.updateStudent(id, patch)),
    [run],
  );

  const setStudentPin = useCallback(
    (id: string, pin: string) => run(() => storage.setStudentPin(id, pin)),
    [run],
  );

  const deleteStudent = useCallback(
    (id: string) => run(() => storage.deleteStudent(id)),
    [run],
  );

  const addBehavior = useCallback(
    (label: string, emoji: string, points: number) =>
      run(() => storage.addBehavior(label, emoji, points, activeClassId).then(() => undefined)),
    [run, activeClassId],
  );

  const updateBehavior = useCallback(
    (id: string, patch: Partial<Pick<Behavior, "label" | "emoji" | "points">>) =>
      run(() => storage.updateBehavior(id, patch)),
    [run],
  );

  const deleteBehavior = useCallback(
    (id: string) => run(() => storage.deleteBehavior(id)),
    [run],
  );

  const award = useCallback(
    (
      studentIds: string[],
      input: { type: TransactionType; amount: number; reason: string; behaviorId?: string },
    ) =>
      run(async () => {
        await storage.addTransactions(
          activeClassId,
          studentIds.map((studentId) => ({ studentId, ...input })),
        );
      }),
    [run, activeClassId],
  );

  const setTransactionUndone = useCallback(
    (id: string, isUndone: boolean) => run(() => storage.setTransactionUndone(id, isUndone)),
    [run],
  );

  const saveCurrency = useCallback(
    (config: CurrencyConfig) =>
      run(async () => {
        await storage.saveCurrencyConfig(config);
        setCurrencyConfig(config);
      }),
    [run],
  );

  /** Teacher's console theme: applied instantly, persisted in the background. */
  const saveColorTheme = useCallback(async (theme: ColorTheme) => {
    applyColorTheme(theme);
    setColorTheme(theme);
    await storage.saveTeacherTheme(theme);
  }, []);

  /** Shared class goal for the ACTIVE class. */
  const saveClassGoal = useCallback(
    async (goal: { target: number | null; label: string | null }) => {
      await storage.saveClassGoal(activeClassId, goal);
      setClassGoal(goal);
    },
    [activeClassId],
  );

  // ----- Reward shop -----

  const addReward = useCallback(
    (input: { name: string; description?: string | null; cost: number; currency?: RewardCurrency; stock: number | null; imageUrl?: string | null }) =>
      run(() => storage.addReward({ ...input, classId: activeClassId })).then(() => undefined),
    [run, activeClassId],
  );

  const updateReward = useCallback(
    (id: string, patch: Parameters<typeof storage.updateReward>[1]) =>
      run(() => storage.updateReward(id, patch)),
    [run],
  );

  const deleteReward = useCallback(
    (id: string) => run(() => storage.deleteReward(id)),
    [run],
  );

  const reorderRewards = useCallback(
    (ids: string[]) => run(() => storage.reorderRewards(ids)),
    [run],
  );

  const setRewardStock = useCallback(
    (id: string, stock: number | null) => run(() => storage.setRewardStock(id, stock)),
    [run],
  );

  const decideRedemption = useCallback(
    (id: string, decision: "approve" | "decline", note?: string | null) =>
      run(async () => {
        if (decision === "approve") await storage.approveRedemption(id, note);
        else await storage.declineRedemption(id, note);
      }),
    [run],
  );

  const undoRedemptionApproval = useCallback(
    (id: string) => run(() => storage.undoRedemption(id)),
    [run],
  );

  // ----- Quizzes -----

  const saveQuiz = useCallback(
    (input: {
      id?: string;
      title: string;
      description: string | null;
      maxGems: number;
      dueAt: number;
      /** null/undefined = leave the question set untouched (locked quizzes). */
      questions?: QuizQuestionDraft[] | null;
      assignedStudentIds: string[];
    }) =>
      (async () => {
        const quizId = await storage.saveQuizMeta({
          classId: activeClassId,
          id: input.id,
          title: input.title,
          description: input.description,
          maxGems: input.maxGems,
          dueAt: input.dueAt,
        });
        if (input.questions !== null && input.questions !== undefined) {
          await storage.saveQuizQuestions(quizId, input.questions);
        }
        await storage.saveQuizAssignments(quizId, input.assignedStudentIds);
        await refreshQuizzes();
        return quizId;
      })(),
    [refreshQuizzes],
  );

  const setQuizStatus = useCallback(
    async (id: string, status: QuizStatus) => {
      await storage.setQuizStatus(id, status);
      await refreshQuizzes();
    },
    [refreshQuizzes],
  );

  const deleteQuiz = useCallback(
    async (id: string) => {
      await storage.deleteQuiz(id);
      await refreshQuizzes();
    },
    [refreshQuizzes],
  );

  const setQuizArchived = useCallback(
    async (id: string, archived: boolean) => {
      await storage.setQuizArchived(id, archived);
      await refreshQuizzes();
    },
    [refreshQuizzes],
  );

  const reopenQuiz = useCallback(
    async (id: string, dueAt: number) => {
      await storage.reopenQuiz(id, dueAt);
      await refreshQuizzes();
    },
    [refreshQuizzes, activeClassId],
  );

  /** Create a class and switch to it immediately. */
  const createClass = useCallback(
    async (name: string, emoji: string) => {
      const created = await storage.createClass(name, emoji);
      setClasses((prev) => [...prev, created]);
      switchClass(created.id);
      return created;
    },
    [switchClass],
  );

  return {
    classes,
    activeClassId,
    switchClass,
    createClass,
    students,
    behaviors,
    transactions,
    rewards,
    redemptions,
    quizzes,
    quizzesError,
    totals,
    lifetime,
    loading,
    error,
    currencyConfig,
    colorTheme,
    classGoal,
    addStudent,
    addStudentWithPin,
    updateStudent,
    setStudentPin,
    deleteStudent,
    addBehavior,
    updateBehavior,
    deleteBehavior,
    award,
    setTransactionUndone,
    saveCurrency,
    saveColorTheme,
    saveClassGoal,
    addReward,
    updateReward,
    deleteReward,
    reorderRewards,
    setRewardStock,
    decideRedemption,
    undoRedemptionApproval,
    saveQuiz,
    setQuizStatus,
    deleteQuiz,
    setQuizArchived,
    reopenQuiz,
    refreshQuizzes,
    refresh,
  };
}

export type Store = ReturnType<typeof useStore>;
