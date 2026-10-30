import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogOut, Palette, PartyPopper, X } from "lucide-react";
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
import { GoalPanel, type Goal, type GoalRewardPreset } from "@/components/student/GoalPanel";
import { ShopTab } from "@/components/student/ShopTab";
import { QuizzesTab } from "@/components/student/QuizzesTab";
import { QuizzesDueCard } from "@/components/student/QuizzesDueCard";
import type { MyQuizItem, RewardRow } from "@/lib/storage";
import { getMyQuizList, getShopRewards } from "@/lib/storage";
import { applyColorTheme, isColorTheme, type ColorTheme } from "@/lib/themes";
import { ThemePicker } from "@/components/ThemePicker";
import { levelProgress, levelForXp } from "@/lib/levels";
import { Confetti } from "@/components/student/Confetti";
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
  const [tab, setTab] = useState<"rewards" | "shop" | "quizzes">("rewards");
  const [quizzes, setQuizzes] = useState<MyQuizItem[]>([]);
  const [quizzesError, setQuizzesError] = useState<string | null>(null);
  const [autoStartId, setAutoStartId] = useState<string | null>(null);
  const [shopRewards, setShopRewards] = useState<GoalRewardPreset[]>([]);
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
      const [safeRow, txns, quizRes, shopRes] = await Promise.all([
        storage.getMyStudentRow(),
        storage.getMyTransactions(),
        // Quiz + shop failures never take down the rest of the page.
        getMyQuizList().catch(() => null),
        getShopRewards().catch(() => null as RewardRow[] | null),
      ]);
      const mapped = txns.map(storage.mapTransactionRow);
      if (markNew && prevIds) {
        const fresh = mapped.filter((t) => !prevIds.has(t.id)).map((t) => t.id);
        if (fresh.length > 0) newIdsRef.current = new Set(fresh);
      }
      setRow(safeRow);
      setTransactions(mapped);
      setQuizzes(quizRes ?? []);
      setQuizzesError(quizRes === null ? "Couldn't load your quizzes." : null);
      if (shopRes) {
        setShopRewards(
          shopRes.map((r) => ({
            id: r.id,
            name: r.name,
            cost: r.cost,
            currency: r.currency ?? "dollars",
          })),
        );
      }
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

  // Quizzes update live: a newly published quiz or an attempt decision
  // appears without waiting for the next poll.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ping = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(false), 500);
    };
    const channel = supabase
      .channel("student-quizzes")
      .on("postgres_changes", { event: "*", schema: "public", table: "quizzes" }, ping)
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_attempts" }, ping)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  // This student's own colour theme — never affects anyone else's view.
  const myTheme: ColorTheme = isColorTheme(row?.theme) ? row.theme : "genji";
  useEffect(() => {
    if (!loading && row) applyColorTheme(myTheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTheme, loading, row === null]);
  const saveTheme = useCallback(
    async (theme: ColorTheme) => {
      applyColorTheme(theme);
      setRow((prev) => (prev ? { ...prev, theme } : prev));
      try {
        await storage.saveMyTheme(theme);
      } catch {
        quietNote("Couldn't save your theme — it will reset next time you sign in.");
      }
    },
    [quietNote],
  );

  // Browser/tab title follows the active tab.
  useEffect(() => {
    const label = tab === "rewards" ? "My rewards" : tab === "shop" ? "Shop" : "Quizzes";
    document.title = `${label} · Genji Educator`;
  }, [tab]);

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

  // Achievement currency (gems) — display-only, separate from the balance.
  const gemsCurrency: CurrencySettings = row?.achievement_currency
    ? {
        singular: row.achievement_currency.singular,
        plural: row.achievement_currency.plural,
        icon: row.achievement_currency.icon as CurrencySettings["icon"],
        color: row.achievement_currency.color as CurrencySettings["color"],
      }
    : { singular: "Gem", plural: "Gems", icon: "Gem", color: "violet" };

  const animatedBalance = useCountUp(row?.balance ?? 0, 900);

  // Gold shine-sweep across the balance whenever it increases — the reward
  // moment for earning. Skipped on first load and on decreases (spending).
  const [shineKey, setShineKey] = useState(0);
  const prevBalanceRef = useRef<number | null>(null);
  const balance = row?.balance ?? 0;
  useEffect(() => {
    const prev = prevBalanceRef.current;
    prevBalanceRef.current = balance;
    if (prev !== null && balance > prev) setShineKey((k) => k + 1);
  }, [balance]);

  // Levels are derived from lifetime earned (see lib/levels.ts): nothing
  // stored, nothing student-writable. A live crossing fires the full-screen
  // celebration; a level gained while away shows a quiet welcome-back note.
  const lifetime = row?.lifetime_earned ?? 0;
  const level = levelProgress(lifetime);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const prevLifetimeRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevLifetimeRef.current;
    prevLifetimeRef.current = lifetime;
    if (prev !== null && row) {
      const newLevel = levelForXp(lifetime);
      if (newLevel > levelForXp(prev)) {
        setLevelUp(newLevel);
        localStorage.setItem(`cr_level_seen_${row.id}`, String(newLevel));
      }
    }
  }, [lifetime, row]);

  const [welcomeLevel, setWelcomeLevel] = useState<number | null>(null);
  useEffect(() => {
    if (loading || !row) return;
    const key = `cr_level_seen_${row.id}`;
    const lvl = levelForXp(row.lifetime_earned ?? 0);
    const seen = Number(localStorage.getItem(key) ?? "0");
    if (seen === 0) {
      // First visit since levels shipped: record silently, no retroactive fanfare.
      localStorage.setItem(key, String(lvl));
    } else if (lvl > seen) {
      setWelcomeLevel(lvl);
      localStorage.setItem(key, String(lvl));
    }
  }, [loading, row]);

  // Auto-advance the live level-up celebration.
  useEffect(() => {
    if (levelUp === null) return;
    const t = setTimeout(() => setLevelUp(null), 4500);
    return () => clearTimeout(t);
  }, [levelUp]);

  const goal: Goal = {
    target: row?.goal_target ?? null,
    label: row?.goal_label ?? null,
    currency: row?.goal_currency ?? null,
  };

  const saveGoal = useCallback(
    async (next: Goal | { target: null; label: null; currency: null }) => {
      setSavingGoal(true);
      setGoalError(null);
      try {
        await storage.saveMyGoal(next);
        setRow((prev) =>
          prev
            ? {
                ...prev,
                goal_target: next.target,
                goal_label: next.label,
                goal_currency: next.target === null ? null : next.currency ?? "dollars",
              }
            : prev,
        );
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

  // Open, unsubmitted quizzes power the dashboard card and the tab badge.
  const now = Date.now();
  const openQuizzes = quizzes.filter(
    (q) => q.status === "published" && !q.submitted && q.dueAt > now,
  );
  const dueCount = openQuizzes.length;
  const dueQuizzes = [...openQuizzes].sort((a, b) => a.dueAt - b.dueAt).slice(0, 3);
  const dueVisible = dueQuizzes.length > 0;

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
    <div className="flex min-h-screen flex-col bg-ink-50 dark:bg-ink-950">
      <ReconnectBanner />

      {/* Level-up: live crossing of a threshold — full celebration */}
      {levelUp !== null && (
        <div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden bg-ink-50 px-5 text-center dark:bg-ink-950"
          role="alertdialog"
          aria-label={`Level ${levelUp} reached`}
        >
          <Confetti />
          <div className="relative z-10 flex flex-col items-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ivory-dim text-deep-gold shadow-soft dark:bg-antique-gold/10 dark:text-antique-gold">
              <PartyPopper className="h-8 w-8" aria-hidden />
            </span>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
              Level up
            </p>
            <p className="mt-1 font-mono text-7xl font-extrabold tabular-nums tracking-tight text-ink-900 dark:text-warm-ivory sm:text-8xl">
              {levelUp}
            </p>
            <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
              Keep earning to reach Level {levelUp + 1}
            </p>
            <button
              onClick={() => setLevelUp(null)}
              className="mt-7 min-h-11 rounded-button bg-obsidian px-5 py-2.5 text-sm font-bold text-warm-ivory transition-colors hover:bg-ink-700 dark:bg-antique-gold dark:text-obsidian dark:hover:bg-deep-gold"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Quiet note when a level was gained while away */}
      {welcomeLevel !== null && (
        <div className="fixed inset-x-4 top-20 z-40 mx-auto flex max-w-sm animate-slide-up items-center gap-2.5 rounded-card border border-deep-gold/30 bg-ivory-dim px-4 py-3 shadow-soft-lg dark:border-antique-gold/30 dark:bg-ink-800">
          <PartyPopper className="h-4 w-4 shrink-0 text-deep-gold dark:text-antique-gold" aria-hidden />
          <p className="flex-1 text-left text-xs font-medium text-ink-700 dark:text-ink-200">
            While you were away you reached <strong>Level {welcomeLevel}</strong>!
          </p>
          <button
            onClick={() => setWelcomeLevel(null)}
            aria-label="Dismiss"
            className="shrink-0 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
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
            <span
              className="pointer-events-none absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-obsidian px-1 font-mono text-[9px] font-bold tabular-nums text-warm-ivory ring-2 ring-ink-50 dark:bg-antique-gold dark:text-obsidian dark:ring-ink-950"
              aria-label={`Level ${level.level}`}
            >
              {level.level}
            </span>
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
            <div className="flex items-center gap-1.5">
              <h1 className="max-w-[140px] truncate text-[15px] font-bold leading-tight text-ink-900 dark:text-warm-ivory sm:max-w-[220px]">{row.display_name}</h1>
              <span
                className="shrink-0 rounded-full bg-ivory-dim px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-deep-gold dark:bg-antique-gold/15 dark:text-antique-gold"
                title="Your level — grows as you earn"
              >
                LV {level.level}
              </span>
            </div>
            <p className="text-[11px] text-ink-400 dark:text-ink-500">
              {tab === "rewards" ? "My rewards" : tab === "shop" ? "Shop" : "Quizzes"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-button border border-ink-200 bg-warm-ivory p-0.5 dark:border-ink-700 dark:bg-ink-900">
            {(["rewards", "shop", "quizzes"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                aria-pressed={tab === t}
                title={t === "quizzes" && dueCount > 0 ? `${dueCount} quizzes due` : undefined}
                className={`flex items-center rounded-button px-3 py-1.5 text-xs font-semibold transition-colors ${
                  tab === t
                    ? "bg-obsidian dark:bg-antique-gold dark:text-obsidian text-warm-ivory"
                    : "text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200"
                }`}
              >
                {t === "rewards" ? "My rewards" : t === "shop" ? "Shop" : "Quizzes"}
                {t === "quizzes" && dueCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-warm-brick px-1.5 py-px font-mono text-[10px] font-bold tabular-nums text-warm-ivory">
                    {dueCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={onSignOut}
            aria-label="Sign out"
            className="flex h-10 items-center gap-2 rounded-button border border-ink-200 px-3 text-sm font-semibold text-ink-600 transition-colors hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Mobile: single column (page scrolls). Tablet: 2 columns. Desktop: 12-col grid, page fixed. */}
      {/* The page itself is the only scroll context: content grows it. */}
      <main className="min-w-0 flex-1">
        {tab === "shop" ? (
          <div className="mx-auto w-full max-w-[1200px] p-5 md:p-6 lg:p-8">
            <ShopTab
              balance={row.balance}
              currency={currency}
              gemsBalance={row.gems_balance ?? 0}
              gemsCurrency={gemsCurrency}
              onQuietNote={quietNote}
            />
          </div>
        ) : tab === "quizzes" ? (
          <div className="mx-auto w-full max-w-[1200px] p-5 md:p-6 lg:p-8">
            <QuizzesTab
              quizzes={quizzes}
              quizzesError={quizzesError}
              gems={gemsCurrency}
              gemsEarned={row.gems_lifetime ?? 0}
              onRetry={() => void load(false)}
              onGemsChanged={() => void load(false)}
              autoStartId={autoStartId}
              onAutoStartConsumed={() => setAutoStartId(null)}
            />
          </div>
        ) : (
        <div className="mx-auto w-full max-w-[1200px] p-5 md:p-6 lg:p-8">
          {/* Mobile order = importance: balance/gems, quizzes due, goal,
              activity, trend, theme. Desktop places explicitly below. */}
          <div className="grid gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-12">
            {/* Row 1: balance (left) + quizzes due (right) */}
            <section className="rounded-card border border-ink-200/70 bg-warm-ivory p-6 shadow-soft dark:border-ink-800/70 dark:bg-ink-900 lg:col-span-8 lg:col-start-1 lg:row-start-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
                Current balance
              </p>
              <div className="mt-2 flex items-baseline gap-3">
                <CurrencyIcon name={currency.icon} className={`h-9 w-9 md:h-11 md:w-11 ${iconClass}`} strokeWidth={2.25} />
                <span
                  key={shineKey}
                  className={`${shineKey > 0 ? "shine-sweep " : ""}text-5xl font-extrabold tracking-tight text-ink-900 dark:text-warm-ivory sm:text-6xl md:text-7xl`}
                >
                  <span className="tabular-nums">{animatedBalance}</span>
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-ink-400 dark:text-ink-500">
                {row.balance === 1 ? currency.singular : currency.plural}
              </p>
              {/* Level progress — personal pace against the curve, never vs classmates */}
              <div className="mt-4">
                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
                  <span className="normal-case">Level {level.level}</span>
                  <span className="font-mono normal-case tabular-nums">
                    {level.needed} to Level {level.level + 1}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={level.pct}
                  aria-label={`Level ${level.level} progress`}
                >
                  <div
                    className="h-full rounded-full bg-antique-gold transition-all duration-500"
                    style={{ width: `${level.pct}%` }}
                  />
                </div>
              </div>
              <div className="mt-5 border-t border-ink-100 pt-4 dark:border-ink-800">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400 dark:text-ink-500">
                  Lifetime earned
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xl font-bold tabular-nums text-ink-800 dark:text-ink-100">
                  <CurrencyIcon name={currency.icon} className={`h-4 w-4 ${iconClass}`} />
                  {row.lifetime_earned}
                </p>
              </div>
              <div className="mt-3 border-t border-ink-100 pt-3 dark:border-ink-800">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400 dark:text-ink-500">
                  {gemsCurrency.plural} to spend
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 font-mono text-lg font-bold tabular-nums text-ink-600 dark:text-ink-300">
                  <CurrencyIcon
                    name={gemsCurrency.icon}
                    className="h-4 w-4 text-deep-gold dark:text-antique-gold"
                    aria-hidden
                  />
                  {row.gems_balance ?? 0}
                  <span className="font-sans text-[11px] font-normal text-ink-400 dark:text-ink-500">
                    from quizzes — separate from your {currency.plural.toLowerCase()}
                  </span>
                </p>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-ink-400 dark:text-ink-500">
                  Lifetime {gemsCurrency.plural.toLowerCase()} earned
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 font-mono text-sm font-bold tabular-nums text-ink-500 dark:text-ink-400">
                  <CurrencyIcon
                    name={gemsCurrency.icon}
                    className="h-3.5 w-3.5 text-ink-400 dark:text-ink-500"
                    aria-hidden
                  />
                  {row.gems_lifetime ?? 0}
                  <span className="font-sans text-[11px] font-normal text-ink-400 dark:text-ink-500">
                    your achievement score — spending never reduces it
                  </span>
                </p>
              </div>
            </section>

            {dueVisible && (
              <QuizzesDueCard
                quizzes={dueQuizzes}
                totalOpen={dueCount}
                gems={gemsCurrency}
                className="animate-slide-up lg:col-span-4 lg:col-start-9 lg:row-start-1"
                onStart={(quiz) => {
                  setTab("quizzes");
                  setAutoStartId(quiz.quizId);
                }}
                onViewAll={() => setTab("quizzes")}
              />
            )}

            {/* My goal — third on mobile, bottom-left on desktop */}
            <section className="rounded-card border border-ink-200/70 bg-warm-ivory p-5 shadow-soft dark:border-ink-800/70 dark:bg-ink-900 lg:col-span-4 lg:col-start-1 lg:row-start-3">
              <GoalPanel
                goal={goal}
                dollarBalance={row.balance}
                gemsBalance={row.gems_balance ?? 0}
                dollarCurrency={currency}
                gemsCurrency={gemsCurrency}
                presets={shopRewards}
                onSave={(g) => void saveGoal(g)}
                saving={savingGoal}
                error={goalError}
              />
            </section>

            {/* Activity grows with its content — no inner scrollbar; the
                list is capped by pagination ("Load more") instead. */}
            <section className="rounded-card border border-ink-200/70 bg-warm-ivory p-5 shadow-soft dark:border-ink-800/70 dark:bg-ink-900 lg:col-span-8 lg:col-start-1 lg:row-start-2">
              <ActivityList
                groups={groups}
                hasMore={hasMore}
                loadingMore={loadingMore}
                onLoadMore={() => void loadMore()}
              />
            </section>

            <section
              className={`rounded-card border border-ink-200/70 bg-warm-ivory p-6 shadow-soft dark:border-ink-800/70 dark:bg-ink-900 lg:col-span-4 lg:col-start-9 ${
                dueVisible ? "lg:row-start-2" : "lg:row-start-1"
              }`}
            >
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
                Last 14 days
              </h2>
              <div className="mt-4">
                <TrendChart trend={trend} currency={currency} />
              </div>
            </section>

            {/* My theme — last on mobile; on desktop it sits beside the goal */}
            <section className="rounded-card border border-ink-200/70 bg-warm-ivory p-5 shadow-soft dark:border-ink-800/70 dark:bg-ink-900 lg:col-span-4 lg:col-start-5 lg:row-start-3">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
                My theme
              </h2>
              <ThemePicker current={myTheme} onSelect={(t) => void saveTheme(t)} />
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
