import { useEffect, useMemo, useState } from "react";
import { Gem, History, RotateCcw, Search, Undo2 } from "lucide-react";
import type { Store } from "@/lib/useStore";
import { useToast } from "@/components/Toast";
import { relativeTime } from "@/lib/time";
import { Skeleton } from "@/components/Skeleton";
import { Monogram } from "@/components/Monogram";
import { initialsOf } from "@/lib/avatarColor";
import { useCurrency } from "@/components/CurrencyProvider";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { currencyKindFor } from "@/lib/currency";

interface Props {
  store: Store;
}

type CurrencyFilter = "all" | "behavior" | "achievement";

export function ActivityLogScreen({ store }: Props) {
  const { students, behaviors, transactions } = store;
  const toast = useToast();
  const { config } = useCurrency();
  const [studentFilter, setStudentFilter] = useState<string>("all");
  const [signFilter, setSignFilter] = useState<"all" | "positive" | "negative">("all");
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);

  const studentMap = useMemo(() => {
    const m: Record<string, { name: string; colorIndex: number }> = {};
    students.forEach((s) => {
      m[s.id] = { name: s.displayName, colorIndex: s.avatarColor };
    });
    return m;
  }, [students]);

  const behaviorMap = useMemo(() => {
    const m: Record<string, { label: string; emoji: string }> = {};
    for (const b of behaviors) m[b.id] = { label: b.label, emoji: b.emoji };
    return m;
  }, [behaviors]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions
      .filter((t) => {
        if (studentFilter !== "all" && t.studentId !== studentFilter) return false;
        if (signFilter === "positive" && t.amount <= 0) return false;
        if (signFilter === "negative" && t.amount >= 0) return false;
        // Currency separation: behavior/spend/adjustment are the class
        // currency; achievement rows are quiz gems — never mixed or summed.
        if (currencyFilter === "behavior" && t.type === "achievement") return false;
        if (currencyFilter === "achievement" && t.type !== "achievement") return false;
        if (q) {
          const sName = studentMap[t.studentId]?.name?.toLowerCase() ?? "";
          const reason = (t.behaviorId ? behaviorMap[t.behaviorId]?.label ?? t.reason : t.reason).toLowerCase();
          if (!sName.includes(q) && !reason.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [transactions, studentFilter, signFilter, currencyFilter, query, studentMap, behaviorMap]);

  const handleUndo = async (id: string) => {
    try {
      await store.setTransactionUndone(id, true);
      toast.show("Transaction undone", "info");
    } catch {
      toast.show("Could not undo transaction", "negative");
    }
  };
  const handleRedo = async (id: string) => {
    try {
      await store.setTransactionUndone(id, false);
      toast.show("Transaction restored", "positive");
    } catch {
      toast.show("Could not restore transaction", "negative");
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-6 sm:px-8 sm:py-8">
        <header>
          <h1 className="text-[28px] font-semibold leading-tight text-ink-900 dark:text-warm-ivory">Activity Log</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Every award and deduction, in reverse-chronological order
          </p>
        </header>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="h-10 w-full rounded-button border border-ink-200 bg-warm-ivory pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-900 dark:focus:ring-antique-gold/20"
            />
          </div>
          <select
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
            className="h-10 rounded-button border border-ink-200 bg-warm-ivory px-3 text-sm font-medium text-ink-700 outline-none transition-colors focus:border-antique-gold dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
          >
            <option value="all">All students</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {initialsOf(s.displayName)} {s.displayName}
              </option>
            ))}
          </select>
          <div className="flex rounded-button border border-ink-200 bg-warm-ivory p-1 dark:border-ink-700 dark:bg-ink-900" role="group" aria-label="Filter by currency">
            {(["all", "behavior", "achievement"] as CurrencyFilter[]).map((opt) => (
              <button
                key={opt}
                onClick={() => setCurrencyFilter(opt)}
                aria-pressed={currencyFilter === opt}
                className={`flex items-center gap-1.5 rounded-button px-3 py-1.5 text-xs font-semibold transition-colors ${
                  currencyFilter === opt
                    ? opt === "achievement"
                      ? "bg-antique-gold/20 text-deep-gold dark:bg-antique-gold/15 dark:text-antique-gold"
                      : "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200"
                    : "text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200"
                }`}
              >
                {opt === "achievement" && <Gem className="h-3.5 w-3.5" aria-hidden />}
                {opt === "all" ? "All" : config[opt].plural}
              </button>
            ))}
          </div>
          <div className="flex rounded-button border border-ink-200 bg-warm-ivory p-1 dark:border-ink-700 dark:bg-ink-900" role="group" aria-label="Filter by sign">
            {(["all", "positive", "negative"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setSignFilter(opt)}
                className={`rounded-button px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  signFilter === opt
                    ? opt === "positive"
                      ? "bg-ivory-dim text-deep-gold dark:bg-antique-gold/15 dark:text-antique-gold"
                      : opt === "negative"
                        ? "bg-warm-brick/10 text-warm-brick dark:bg-warm-brick/15 dark:text-brick-light"
                        : "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200"
                    : "text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs font-medium text-ink-400 dark:text-ink-500">
            {filtered.length} entries
          </span>
        </div>

        <div className="mt-4">
          {loading || store.loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[60px]" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-card border-2 border-dashed border-ink-200 py-16 text-center dark:border-ink-700">
              <History className="h-9 w-9 text-ink-300 dark:text-ink-600" />
              <h2 className="mt-3 text-lg font-semibold text-ink-900 dark:text-warm-ivory">No activity yet</h2>
              <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
                Award {config.behavior.plural} from the dashboard to see them here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filtered.map((t) => {
                const student = studentMap[t.studentId];
                const behavior = t.behaviorId ? behaviorMap[t.behaviorId] : undefined;
                const label = behavior?.label ?? t.reason;
                const positive = t.amount >= 0;
                const isGems = t.type === "achievement";
                return (
                  <li
                    key={t.id}
                    className={`flex items-center gap-3 rounded-card border bg-warm-ivory px-3 py-3 transition-colors sm:px-4 dark:bg-ink-900 ${
                      isGems
                        ? "border-antique-gold/50 bg-antique-gold/[0.06] dark:border-antique-gold/30 dark:bg-antique-gold/[0.07]"
                        : t.isUndone
                          ? "border-ink-100 opacity-60 dark:border-ink-800/50"
                          : "border-ink-200/70 dark:border-ink-800/70"
                    } ${t.isUndone ? "opacity-70" : ""}`}
                  >
                    <Monogram name={student?.name ?? "?"} colorIndex={student?.colorIndex ?? 0} size="md" />
                    <div className={`min-w-0 flex-1 ${t.isUndone ? "line-through" : ""}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-ink-900 dark:text-ink-100">
                          {student?.name ?? "Removed student"}
                        </span>
                        {isGems && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-antique-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-deep-gold dark:bg-antique-gold/15 dark:text-antique-gold">
                            <Gem className="h-3 w-3" aria-hidden />
                            {config.achievement.plural}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-ink-500 dark:text-ink-400">
                        {label} · {relativeTime(t.createdAt)}
                      </div>
                    </div>
                    <div
                      className={`shrink-0 whitespace-nowrap text-sm font-bold sm:text-base ${
                        t.isUndone
                          ? "text-ink-400 dark:text-ink-600"
                          : positive
                            ? "text-deep-gold dark:text-antique-gold"
                            : "text-warm-brick dark:text-brick-light"
                      }`}
                    >
                      <CurrencyAmount
                        amount={t.amount}
                        kind={currencyKindFor(t.type)}
                        signed
                        className={t.isUndone ? "line-through opacity-70" : ""}
                      />
                    </div>
                    <div className="shrink-0">
                      {t.isUndone ? (
                        <button
                          onClick={() => handleRedo(t.id)}
                          className="flex h-9 items-center gap-1.5 rounded-button bg-ink-100 px-3 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700"
                          aria-label="Redo transaction"
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span className="hidden sm:inline">Redo</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUndo(t.id)}
                          className="flex h-9 items-center gap-1.5 rounded-button bg-ink-100 px-3 text-xs font-semibold text-ink-700 transition-colors hover:bg-warm-brick/10 hover:text-warm-brick dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-warm-brick/10 dark:hover:text-brick-light"
                          aria-label="Undo transaction"
                        >
                          <Undo2 className="h-4 w-4" />
                          <span className="hidden sm:inline">Undo</span>
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
