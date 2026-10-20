import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogOut, Palette } from "lucide-react";
import { supabase } from "@/lib/supabase";
import * as storage from "@/lib/storage";
import type { StudentSafeRow } from "@/lib/storage";
import { useCountUp } from "@/lib/useCountUp";
import { Monogram } from "@/components/Monogram";
import { AVATAR_PALETTE, initialsOf } from "@/lib/avatarColor";
import { CurrencyIcon } from "@/components/CurrencyAmount";
import { Skeleton } from "@/components/Skeleton";
import { buildActivityGroups, buildTrend } from "@/components/student/activity";
import { TrendChart } from "@/components/student/TrendChart";
import { ActivityList } from "@/components/student/ActivityList";
import { GoalPanel, type Goal } from "@/components/student/GoalPanel";
import { ShopTab } from "@/components/student/ShopTab";
import { ReconnectBanner } from "@/components/ReconnectBanner";
import type { CurrencySettings, PointTransaction } from "@/types";

const PAGE_SIZE = 20;

/**
 * The entire student-facing app. Reads only the signed-in student's own row
 * (students_safe view) and own transactions (RLS-scoped). The only write is
 * the personal goal (own row, database-enforced).
 *
 * Layout: single column on mobile; two columns on tablet; a non-scrolling
 * dashboard grid (max-w 1200px) on desktop where the activity panel scrolls
 * internally.
 */
export function StudentView({ onSignOut }: { onSignOut: () => void }) {
  const [row, setRow] = useState<StudentSafeRow | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState<string | null>(null);
  const [tab, setTab] = useState<"rewards" | "shop">("rewards");
  const [notes, setNotes] = useState<{ id: number; message: string }[]>([]);
  const [colorOpen, setColorOpen] = useState(false);
  const [savingColor, setSavingColor] = useState(false);
  const newIdsRef = useRef<Set<string>>(new Set());

  const quietNote = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setNotes((prev) => [...prev.slice(-2), { id, message }]);
    setTimeout(() => setNotes((prev) => prev.filter((n) => n.id !== id)), 4000);
  }, []);

  const load = useCallback(async (markNew: boolean) => {
    try {
      const prevIds = markNew ? new Set(transactions.map((t) => t.id)) : null;
      const [safeRow, txns] = await Promise.all([storage.getMyStudentRow(), storage.getMyTransactions()]);
      const mapped = txns.map(storage.mapTransactionRow);
      if (markNew && prevIds) {
        const fresh = mapped.filter((t) => !prevIds.has(t.id)).map((t) => t.id);
        if (fresh.length > 0) newIdsRef.current = new Set(fresh);
      }
      setRow(safeRow);
      setTransactions(mapped);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load(false);

    const channel = supabase
      .channel("student-transactions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "point_transactions", filter: "is_undone=eq.false" },
        () => void load(true),
      )
      .subscribe();

    const poll = setInterval(() => void load(true), 15_000);
    return () => {
      void supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const more = await storage.getMyTransactions(transactions.length, PAGE_SIZE);
      const mapped = more.map(storage.mapTransactionRow);
      setTransactions((prev) => {
        const seen = new Set(prev.map((t) => t.id));
        return [...prev, ...mapped.filter((t) => !seen.has(t.id))];
      });
    } catch {
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [transactions.length, loadingMore]);

  const currency: CurrencySettings | null = row?.behavior_currency
    ? {
        singular: row.behavior_currency.singular,
        plural: row.behavior_currency.plural,
        icon: row.behavior_currency.icon as CurrencySettings["icon"],
        color: row.behavior_currency.color as CurrencySettings["color"],
      }
    : null;

  const animatedBalance = useCountUp(row?.balance ?? 0, 900);

  const goal: Goal = { target: row?.goal_target ?? null, label: row?.goal_label ?? null };

  const saveGoal = useCallback(
    async (next: Goal) => {
      setSavingGoal(true);
      setGoalError(null);
      try {
        await storage.saveMyGoal(next);
        setRow((prev) => (prev ? { ...prev, goal_target: next.target, goal_label: next.label } : prev));
      } catch (e) {
        // Surface the database's own message so failures are diagnosable.
        setGoalError(e instanceof Error ? e.message : "Could not save your goal. Try again.");
      } finally {
        setSavingGoal(false);
      }
    },
    [],
  );

  const changeColor = useCallback(
    async (color: number) => {
      setSavingColor(true);
      try {
        await storage.updateMyAvatarColor(color);
        setRow((prev) => (prev ? { ...prev, avatar_color: color } : prev));
        setColorOpen(false);
      } catch {
        quietNote("Could not change colour. Try again.");
      } finally {
        setSavingColor(false);
      }
    },
    [quietNote],
  );

  const groups = useMemo(() => buildActivityGroups(transactions), [transactions]);
  const trend = useMemo(() => buildTrend(transactions), [transactions]);
  const hasMore = transactions.length >= PAGE_SIZE && transactions.length % PAGE_SIZE === 0;
  if (loading) return <StudentSkeleton />;

  if (loadError || !row || !currency) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm font-medium text-warm-brick">Couldn't load your page.</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-4 py-2 text-sm font-semibold text-warm-ivory hover:bg-ink-700 dark:hover:bg-deep-gold"
        >
          Try again
        </button>
      </div>
    );
  }

  const iconClass = ICON_COLORS[currency.color] ?? "text-deep-gold";

  return (
    <div className="h-screen overflow-hidden bg-ink-50 dark:bg-ink-950">
      <ReconnectBanner />
      {/* Quiet notifications (bottom-right, auto-dismiss) */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2">
        {notes.map((n) => (
          <div
            key={n.id}
            className="animate-slide-in-right rounded-card bg-warm-ivory px-3.5 py-2.5 shadow-soft-lg dark:bg-ink-800"
          >
            <p className="text-sm font-medium text-ink-800 dark:text-ink-100">{n.message}</p>
          </div>
        ))}
      </div>

      {/* Top bar */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-ink-200/60 px-5 dark:border-ink-800/60 md:px-8">
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setColorOpen((v) => !v)}
              className="rounded-full transition-transform hover:scale-105"
              aria-label="Change avatar colour"
            >
              <Monogram name={row.display_name} colorIndex={row.avatar_color} size="md" />
            </button>
            {colorOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setColorOpen(false)} />
                <div className="absolute left-0 top-12 z-50 w-64 rounded-card border border-ink-200 bg-warm-ivory p-3 shadow-soft-lg dark:border-ink-700 dark:bg-ink-900">
                  <div className="mb-2 flex items-center gap-2">
                    <Palette className="h-3.5 w-3.5 text-ink-400" />
                    <span className="text-xs font-semibold text-ink-600 dark:text-ink-300">Pick your colour</span>
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {AVATAR_PALETTE.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => { void changeColor(i); }}
                        disabled={savingColor}
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold transition-all ${c.bg} ${c.text} ${
                          row.avatar_color === i
                            ? "ring-2 ring-offset-2 ring-antique-gold dark:ring-offset-ink-900"
                            : "hover:scale-110"
                        }`}
                        aria-label={`Colour ${i + 1}`}
                      >
                        {initialsOf(row.display_name)}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <div>
            <h1 className="max-w-[140px] truncate text-[15px] font-bold leading-tight text-ink-900 dark:text-warm-ivory sm:max-w-[220px]">{row.display_name}</h1>
            <p className="text-[11px] text-ink-400 dark:text-ink-500">My rewards</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-button border border-ink-200 bg-warm-ivory p-0.5 dark:border-ink-700 dark:bg-ink-900">
            {(["rewards", "shop"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-button px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  tab === t
                    ? "bg-obsidian dark:bg-antique-gold dark:text-obsidian text-warm-ivory"
                    : "text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200"
                }`}
              >
                {t === "rewards" ? "My rewards" : "Shop"}
              </button>
            ))}
          </div>
          <button
            onClick={onSignOut}
            className="flex h-10 items-center gap-2 rounded-button border border-ink-200 px-3 text-sm font-semibold text-ink-600 transition-colors hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Mobile: single column (page scrolls). Tablet: 2 columns. Desktop: 12-col grid, page fixed. */}
      <main className="h-[calc(100vh-4rem)] overflow-y-auto md:overflow-hidden">
        {tab === "shop" ? (
          <div className="mx-auto h-full w-full max-w-[1200px] overflow-y-auto p-5 md:p-6 lg:p-8">
            <ShopTab balance={row.balance} currency={currency} onQuietNote={quietNote} />
          </div>
        ) : (
        <div className="mx-auto h-full w-full max-w-[1200px] p-5 md:p-6 lg:p-8">
          <div className="flex h-full flex-col gap-5 md:grid md:h-full md:grid-cols-2 md:gap-6 lg:grid-cols-12">
            {/* Row 1: balance (8 cols) + trend (4 cols) */}
            <section className="rounded-card border border-ink-200/70 bg-warm-ivory p-6 shadow-soft dark:border-ink-800/70 dark:bg-ink-900 lg:col-span-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
                Current balance
              </p>
              <div className="mt-2 flex items-baseline gap-3">
                <CurrencyIcon name={currency.icon} className={`h-9 w-9 md:h-11 md:w-11 ${iconClass}`} strokeWidth={2.25} />
                <span className="text-5xl font-extrabold tabular-nums tracking-tight text-ink-900 dark:text-warm-ivory sm:text-6xl md:text-7xl">
                  {animatedBalance}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-ink-400 dark:text-ink-500">
                {row.balance === 1 ? currency.singular : currency.plural}
              </p>
              <div className="mt-5 border-t border-ink-100 pt-4 dark:border-ink-800">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400 dark:text-ink-500">
                  Lifetime earned
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xl font-bold tabular-nums text-ink-800 dark:text-ink-100">
                  <CurrencyIcon name={currency.icon} className={`h-4 w-4 ${iconClass}`} />
                  {row.lifetime_earned}
                </p>
              </div>
            </section>

            <section className="rounded-card border border-ink-200/70 bg-warm-ivory p-6 shadow-soft dark:border-ink-800/70 dark:bg-ink-900 lg:col-span-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
                Last 14 days
              </h2>
              <div className="mt-4">
                <TrendChart trend={trend} currency={currency} />
              </div>
            </section>

            {/* Row 2: activity (8 cols) + right column (goal above summary, 4 cols) */}
            <section className="flex min-h-[280px] flex-col rounded-card border border-ink-200/70 bg-warm-ivory p-5 shadow-soft dark:border-ink-800/70 dark:bg-ink-900 md:min-h-0 lg:col-span-8 lg:col-start-1 lg:row-start-2">
              <ActivityList
                groups={groups}
                hasMore={hasMore}
                loadingMore={loadingMore}
                onLoadMore={() => void loadMore()}
              />
            </section>

            <section className="flex flex-col gap-6 lg:col-span-4 lg:col-start-9 lg:row-start-2">
              <div className="rounded-card border border-ink-200/70 bg-warm-ivory p-5 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
                <GoalPanel
                  goal={goal}
                  balance={row.balance}
                  currency={currency}
                  onSave={(g) => void saveGoal(g)}
                  saving={savingGoal}
                  error={goalError}
                />
              </div>
            </section>
          </div>
        </div>
        )}
      </main>
    </div>
  );
}

function StudentSkeleton() {
  return (
    <div className="min-h-screen bg-ink-50 dark:bg-ink-950">
      <div className="mx-auto h-full w-full max-w-[1200px] p-5 md:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-52 rounded-card lg:col-span-2" />
          <Skeleton className="h-52 rounded-card" />
          <Skeleton className="h-64 rounded-card lg:col-span-2" />
          <Skeleton className="h-64 rounded-card" />
        </div>
      </div>
    </div>
  );
}

const ICON_COLORS: Record<string, string> = {
  amber: "text-deep-gold dark:text-antique-gold",
  violet: "text-deep-gold dark:text-antique-gold",
  emerald: "text-deep-gold dark:text-antique-gold",
  sky: "text-deep-gold dark:text-antique-gold",
  rose: "text-warm-brick dark:text-brick-light",
  orange: "text-deep-gold dark:text-antique-gold",
  teal: "text-deep-gold dark:text-antique-gold",
  slate: "text-obsidian dark:text-warm-ivory",
};
