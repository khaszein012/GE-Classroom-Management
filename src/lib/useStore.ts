import { useCallback, useEffect, useState } from "react";
import type { Behavior, PointTransaction, Redemption, Student, TransactionType } from "@/types";
import type { CurrencyConfig, Reward } from "@/types";
import * as storage from "@/lib/storage";
import { DEFAULT_CURRENCY_CONFIG } from "@/lib/currency";

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
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [lifetime, setLifetime] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currencyConfig, setCurrencyConfig] = useState<CurrencyConfig>(DEFAULT_CURRENCY_CONFIG);

  const applyDerived = useCallback((txns: PointTransaction[]) => {
    const totalsMap: Record<string, number> = {};
    const lifetimeMap: Record<string, number> = {};
    for (const t of txns) {
      if (t.isUndone) continue;
      totalsMap[t.studentId] = (totalsMap[t.studentId] ?? 0) + t.amount;
      if (t.amount > 0) lifetimeMap[t.studentId] = (lifetimeMap[t.studentId] ?? 0) + t.amount;
    }
    setTotals(totalsMap);
    setLifetime(lifetimeMap);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [s, b, t, settings, r, rd] = await Promise.all([
        storage.getStudents(),
        storage.getBehaviors(),
        storage.getTransactions(),
        storage.getClassSettings(),
        storage.getRewards(),
        storage.getRedemptions(),
      ]);
      setStudents(s);
      setBehaviors(b);
      setTransactions(t);
      applyDerived(t);
      setRewards(r);
      setRedemptions(rd);
      if (settings) setCurrencyConfig(settings.currencyConfig);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [applyDerived]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      try {
        await fn();
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Operation failed");
        throw e;
      } finally {
        await refresh();
      }
    },
    [refresh],
  );

  const addStudent = useCallback(
    (displayName: string, avatarColor: number) =>
      run(async () => {
        await storage.addStudent({
          displayName,
          avatarColor,
        });
      }),
    [run],
  );

  const addStudentWithPin = useCallback(
    (input: { displayName: string; avatarColor: number; username: string; pin: string }) =>
      run(async () => {
        await storage.addStudent({
          displayName: input.displayName,
          avatarColor: input.avatarColor,
          username: input.username,
          pin: input.pin,
        });
      }).then(() => undefined),
    [run],
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
      run(() => storage.addBehavior(label, emoji, points).then(() => undefined)),
    [run],
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
        await storage.addTransactions(studentIds.map((studentId) => ({ studentId, ...input })));
      }),
    [run],
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

  // ----- Reward shop -----

  const addReward = useCallback(
    (input: { name: string; description?: string | null; cost: number; stock: number | null; imageUrl?: string | null }) =>
      run(() => storage.addReward(input)).then(() => undefined),
    [run],
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

  return {
    students,
    behaviors,
    transactions,
    rewards,
    redemptions,
    totals,
    lifetime,
    loading,
    error,
    currencyConfig,
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
    addReward,
    updateReward,
    deleteReward,
    reorderRewards,
    setRewardStock,
    decideRedemption,
    undoRedemptionApproval,
    refresh,
  };
}

export type Store = ReturnType<typeof useStore>;
