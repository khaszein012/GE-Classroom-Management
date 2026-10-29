import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  Award,
  ClipboardList,
  LineChart,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react";
import type { Store } from "@/lib/useStore";
import { Skeleton } from "@/components/Skeleton";
import { Monogram } from "@/components/Monogram";
import { useCurrency } from "@/components/CurrencyProvider";
import { CurrencyIcon } from "@/components/CurrencyAmount";

/**
 * Teacher insights — read-only analytics computed from data the teacher app
 * already has. No new data, no new permissions: everything derives from the
 * transaction ledger, the roster and the quiz summaries. Quiz gems are
 * excluded from all dollar figures (sealed currencies).
 */

const DAY = 86_400_000;

interface WeekBucket {
  label: string;
  count: number;
  sum: number;
}

interface BehaviorStat {
  id: string;
  label: string;
  emoji: string;
  count: number;
  net: number;
}

interface QuietStudent {
  id: string;
  name: string;
  colorIndex: number;
  days: number | null;
  net14: number;
  noPin: boolean;
}

function computeInsights(store: Store) {
  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const dollarTxns = store.transactions.filter((t) => !t.isUndone && t.type !== "achievement");

  // --- weekly buckets (8 weeks, oldest first) ---
  const weeks: WeekBucket[] = [];
  for (let i = 7; i >= 0; i--) {
    const start = todayMs - (i * 7 + 6) * DAY;
    const end = todayMs - i * 7 * DAY + DAY - 1;
    const inWeek = dollarTxns.filter((t) => t.createdAt >= start && t.createdAt <= end);
    const fmt = (ts: number) => new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    weeks.push({
      label: `${fmt(start)} – ${fmt(Math.min(end, now))}`,
      count: inWeek.length,
      sum: inWeek.reduce((s, t) => s + t.amount, 0),
    });
  }

  // --- overview ---
  const weekAgo = now - 7 * DAY;
  const activeIds = new Set(dollarTxns.filter((t) => t.createdAt >= weekAgo).map((t) => t.studentId));
  const circulation = Object.values(store.totals).reduce((s, v) => s + v, 0);
  const totalStudents = store.students.length;

  // --- behaviour usage ---
  const byBehavior = new Map<string, { count: number; net: number }>();
  for (const t of dollarTxns) {
    if (!t.behaviorId) continue;
    const entry = byBehavior.get(t.behaviorId) ?? { count: 0, net: 0 };
    entry.count += 1;
    entry.net += t.amount;
    byBehavior.set(t.behaviorId, entry);
  }
  const topBehaviors: BehaviorStat[] = Array.from(byBehavior.entries())
    .map(([id, stat]) => {
      const b = store.behaviors.find((x) => x.id === id);
      return b ? { id, label: b.label, emoji: b.emoji, ...stat } : null;
    })
    .filter((x): x is BehaviorStat => x !== null)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // --- needs attention ---
  const lastActivity = new Map<string, number>();
  for (const t of dollarTxns) {
    const prev = lastActivity.get(t.studentId);
    if (prev === undefined || t.createdAt > prev) lastActivity.set(t.studentId, t.createdAt);
  }
  const net14 = new Map<string, number>();
  for (const t of dollarTxns) {
    if (t.createdAt < now - 14 * DAY) continue;
    net14.set(t.studentId, (net14.get(t.studentId) ?? 0) + t.amount);
  }
  const quiet: QuietStudent[] = store.students
    .filter((s) => s.isActive)
    .map((s, i) => {
      const last = lastActivity.get(s.id);
      return {
        id: s.id,
        name: s.displayName,
        colorIndex: i,
        days: last === undefined ? null : Math.floor((now - last) / DAY),
        net14: net14.get(s.id) ?? 0,
        noPin: !s.hasPin,
      };
    })
    .filter((s) => s.days === null || s.days >= 7 || s.net14 < 0 || s.noPin)
    .sort((a, b) => (b.days ?? 999) - (a.days ?? 999));

  // --- quiz participation ---
  const live = store.quizzes.filter((q) => q.status !== "draft");
  const assigned = live.reduce((s, q) => s + q.assignedCount, 0);
  const submitted = live.reduce((s, q) => s + q.submittedCount, 0);

  return {
    totalStudents,
    activeThisWeek: activeIds.size,
    circulation,
    avgBalance: totalStudents === 0 ? 0 : circulation / totalStudents,
    weeks,
    topBehaviors,
    maxBehaviorCount: Math.max(1, ...topBehaviors.map((b) => b.count)),
    quiet,
    quizAssigned: assigned,
    quizSubmitted: submitted,
    quizCount: live.length,
  };
}

export function InsightsScreen({ store }: { store: Store }) {
  const { config } = useCurrency();
  const dollars = config.behavior;
  const gems = config.achievement;

  // Recomputed whenever the underlying store data changes (store identity
  // is stable between refreshes, so the deps below are the real triggers).
  const data = useMemo(
    () => computeInsights(store),
    [store.students, store.transactions, store.behaviors, store.quizzes, store.totals], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (store.loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-[1400px] space-y-4 px-5 py-6 sm:px-8 sm:py-8">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-24 rounded-card" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-64 rounded-card" />
            <Skeleton className="h-64 rounded-card" />
          </div>
        </div>
      </div>
    );
  }

  const maxWeekCount = Math.max(1, ...data.weeks.map((w) => w.count));

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-6 sm:px-8 sm:py-8">
        <header>
          <h1 className="text-[28px] font-semibold leading-tight text-ink-900 dark:text-warm-ivory">
            Insights
          </h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            How your classroom economy is flowing — {dollars.plural.toLowerCase()} figures only, quiz{" "}
            {gems.plural.toLowerCase()} excluded
          </p>
        </header>

        {/* Overview strip */}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <OverviewCard
            icon={<Users className="h-4 w-4" />}
            value={`${data.activeThisWeek}/${data.totalStudents}`}
            label="Active this week"
          />
          <OverviewCard
            icon={<CurrencyIcon name={dollars.icon} className="h-4 w-4" />}
            value={data.circulation}
            label={`${dollars.plural} in circulation`}
          />
          <OverviewCard
            icon={<TrendingUp className="h-4 w-4" />}
            value={Math.round(data.avgBalance * 10) / 10}
            label={`Average balance`}
          />
          <OverviewCard
            icon={<ClipboardList className="h-4 w-4" />}
            value={
              data.quizAssigned === 0
                ? "—"
                : `${Math.round((data.quizSubmitted / data.quizAssigned) * 100)}%`
            }
            label="Quiz participation"
          />
        </div>

        <div className="mt-6 grid gap-4 pb-8 lg:grid-cols-2">
          {/* Weekly flow */}
          <section className="rounded-card border border-ink-200/70 bg-warm-ivory p-5 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
            <SectionTitle icon={<LineChart className="h-4 w-4" />}>
              {dollars.plural} awarded — last 8 weeks
            </SectionTitle>
            <div className="mt-4 flex h-36 items-end gap-2" role="img" aria-label="Awards per week, last 8 weeks">
              {data.weeks.map((w, i) => {
                const h = Math.max((w.count / maxWeekCount) * 100, w.count > 0 ? 8 : 3);
                return (
                  <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="font-mono text-xs font-bold tabular-nums text-ink-700 dark:text-ink-200">
                      {w.count > 0 ? w.count : ""}
                    </span>
                    <div
                      className={`w-full rounded-sm transition-all ${
                        w.count > 0 ? "bg-antique-gold dark:bg-antique-gold" : "bg-ink-200 dark:bg-ink-800"
                      }`}
                      style={{ height: `${h}%` }}
                      title={`${w.count} awards · net ${w.sum}`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-8 gap-2">
              {data.weeks.map((w, i) => (
                <span
                  key={i}
                  className="truncate text-center text-[9px] leading-tight text-ink-400 dark:text-ink-600"
                  title={w.label}
                >
                  {w.label.split(" – ")[0]}
                </span>
              ))}
            </div>
            {data.weeks.every((w) => w.count === 0) && (
              <p className="mt-3 text-sm text-ink-400 dark:text-ink-500">
                No awards yet — the chart fills in as you award {dollars.plural.toLowerCase()}.
              </p>
            )}
          </section>

          {/* Behaviour usage */}
          <section className="rounded-card border border-ink-200/70 bg-warm-ivory p-5 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
            <SectionTitle icon={<Award className="h-4 w-4" />}>
              Most-used behaviours
            </SectionTitle>
            {data.topBehaviors.length === 0 ? (
              <p className="mt-4 text-sm text-ink-400 dark:text-ink-500">
                Award something to see which behaviours your class responds to.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {data.topBehaviors.map((b) => (
                  <li key={b.id}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-medium text-ink-800 dark:text-ink-100">
                        <span className="mr-1.5">{b.emoji}</span>
                        {b.label}
                      </span>
                      <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-ink-500 dark:text-ink-400">
                        ×{b.count}
                        <span
                          className={`ml-2 ${
                            b.net >= 0
                              ? "text-deep-gold dark:text-antique-gold"
                              : "text-warm-brick dark:text-brick-light"
                          }`}
                        >
                          {b.net >= 0 ? "+" : ""}
                          {b.net}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                      <div
                        className="h-full rounded-full bg-antique-gold"
                        style={{ width: `${(b.count / data.maxBehaviorCount) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Needs attention */}
          <section className="rounded-card border border-ink-200/70 bg-warm-ivory p-5 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
            <SectionTitle icon={<ShieldAlert className="h-4 w-4" />}>
              Needs attention
            </SectionTitle>
            {data.quiet.length === 0 ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-ink-400 dark:text-ink-500">
                <Activity className="h-4 w-4" aria-hidden />
                Everyone is active — nothing to flag.
              </p>
            ) : (
              <>
                <p className="mt-1 text-xs text-ink-400 dark:text-ink-500">
                  Quiet 7+ days, a negative fortnight, or still missing a PIN.
                </p>
                <ul className="mt-3 space-y-2">
                  {data.quiet.slice(0, 8).map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center gap-2.5 rounded-button border border-ink-100 px-3 py-2 dark:border-ink-800"
                    >
                      <Monogram name={s.name} colorIndex={s.colorIndex} size="xs" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-800 dark:text-ink-100">
                        {s.name}
                      </span>
                      {s.noPin && (
                        <ReasonChip
                          icon={<ShieldAlert className="h-3 w-3" />}
                          label="No PIN"
                          tone="warn"
                        />
                      )}
                      {s.net14 < 0 && (
                        <ReasonChip
                          icon={<TrendingUp className="h-3 w-3" />}
                          label={`${s.net14}`}
                          tone="bad"
                        />
                      )}
                      {s.days !== null && s.days >= 7 ? (
                        <ReasonChip icon={<AlertTriangle className="h-3 w-3" />} label={`${s.days}d quiet`} tone="warn" />
                      ) : s.days === null ? (
                        <ReasonChip icon={<AlertTriangle className="h-3 w-3" />} label="never active" tone="warn" />
                      ) : null}
                    </li>
                  ))}
                </ul>
                {data.quiet.length > 8 && (
                  <p className="mt-2 text-xs text-ink-400 dark:text-ink-500">
                    +{data.quiet.length - 8} more
                  </p>
                )}
              </>
            )}
          </section>

          {/* Quiz snapshot */}
          <section className="rounded-card border border-ink-200/70 bg-warm-ivory p-5 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
            <SectionTitle icon={<ClipboardList className="h-4 w-4" />}>
              Quiz participation
            </SectionTitle>
            {data.quizCount === 0 || data.quizAssigned === 0 ? (
              <p className="mt-4 text-sm text-ink-400 dark:text-ink-500">
                Publish a quiz and assign it to see participation here.
              </p>
            ) : (
              <>
                <p className="mt-4 font-mono text-4xl font-bold tabular-nums text-ink-900 dark:text-warm-ivory">
                  {Math.round((data.quizSubmitted / data.quizAssigned) * 100)}%
                </p>
                <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
                  {data.quizSubmitted} of {data.quizAssigned} attempts submitted across{" "}
                  {data.quizCount} {data.quizCount === 1 ? "quiz" : "quizzes"}
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                  <div
                    className="h-full rounded-full bg-antique-gold transition-all duration-500"
                    style={{ width: `${(data.quizSubmitted / data.quizAssigned) * 100}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-ink-400 dark:text-ink-500">
                  Per-quiz breakdown and per-question analytics live on each quiz's Results page.
                </p>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function OverviewCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <div className="rounded-card border border-ink-200/70 bg-warm-ivory p-4 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ivory-dim text-deep-gold dark:bg-antique-gold/10 dark:text-antique-gold">
        {icon}
      </span>
      <div className="mt-2 font-mono text-2xl font-bold tabular-nums leading-tight text-ink-900 dark:text-warm-ivory">
        {value}
      </div>
      <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
        {label}
      </div>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
      {icon}
      {children}
    </h2>
  );
}

function ReasonChip({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "warn" | "bad";
}) {
  const cls =
    tone === "bad"
      ? "bg-warm-brick/10 text-warm-brick dark:bg-warm-brick/15 dark:text-brick-light"
      : "bg-ivory-dim text-deep-gold dark:bg-antique-gold/10 dark:text-antique-gold";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums ${cls}`}
    >
      {icon}
      {label}
    </span>
  );
}
