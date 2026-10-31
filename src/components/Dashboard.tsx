import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, Award, CheckSquare, Search, Square, UserPlus, Users } from "lucide-react";
import type { Store } from "@/lib/useStore";
import { useToast } from "@/components/Toast";
import { AwardModal, selectedIdsRef } from "@/components/AwardModal";
import { Modal, ColorPicker } from "@/components/Modal";
import { AVATAR_PALETTE } from "@/lib/avatarColor";
import { StatStrip } from "@/components/StatStrip";
import { StudentCard } from "@/components/StudentCard";
import { Skeleton } from "@/components/Skeleton";
import { useCurrency } from "@/components/CurrencyProvider";
import { formatCurrency } from "@/lib/currency";
import { SORT_LABELS, loadSortMode, saveSortMode, sortStudents } from "@/lib/sortStudents";
import type { SortMode } from "@/lib/sortStudents";

interface Props {
  store: Store;
  onGoToStudents: () => void;
}

export function Dashboard({ store, onGoToStudents }: Props) {
  const { students, behaviors, transactions, totals } = store;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [awardOpen, setAwardOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [pulse, setPulse] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [quickBusy, setQuickBusy] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>(() => loadSortMode());
  const toast = useToast();
  const { config } = useCurrency();

  // Brief skeleton on first mount.
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = sortStudents(students, sortMode, totals, transactions);
    if (!q) return sorted;
    return sorted.filter((s) => s.displayName.toLowerCase().includes(q));
  }, [students, query, sortMode, totals, transactions]);

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  // First positive / first negative behavior for quick-actions.
  const firstPositive = behaviors.find((b) => b.points > 0);
  const firstNegative = behaviors.find((b) => b.points < 0);

  const stats = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayTs = startOfToday.getTime();
    // Achievement (gems) rows are a separate score, not class currency.
    const todays = transactions.filter(
      (t) => t.createdAt >= todayTs && !t.isUndone && t.type !== "achievement",
    );
    const pointsToday = todays.reduce((sum, t) => sum + t.amount, 0);
    const awardsToday = todays.length;
    const classTotal = Object.values(totals).reduce((sum, v) => sum + v, 0);
    const studentCount = students.length;
    const classAverage = studentCount === 0 ? 0 : classTotal / studentCount;
    return { pointsToday, awardsToday, classTotal, classAverage, studentCount };
  }, [transactions, totals, students.length]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filtered.map((s) => s.id)));
  const clear = () => setSelected(new Set());

  const openAward = () => {
    if (selected.size === 0) return;
    selectedIdsRef.current = Array.from(selected);
    setAwardOpen(true);
  };

  const quickAward = async (
    studentId: string,
    behavior: { id: string; label: string; points: number },
  ) => {
    if (quickBusy) return;
    setQuickBusy(true);
    try {
      await store.award([studentId], {
        type: "behavior",
        amount: behavior.points,
        reason: behavior.label,
        behaviorId: behavior.id,
      });
      setPulse(new Set([studentId]));
      setTimeout(() => setPulse(new Set()), 850);
      toast.show(
        `${formatCurrency(config.behavior, behavior.points, true)} · ${behavior.label}`,
        behavior.points >= 0 ? "positive" : "negative",
      );
    } catch {
      toast.show("Could not award — try again", "negative");
    } finally {
      setQuickBusy(false);
    }
  };

  const handleAwarded = async (label: string, amount: number, count: number) => {
    setAwardOpen(false);
    setPulse(new Set(selected));
    setTimeout(() => setPulse(new Set()), 850);
    setSelected(new Set());
    toast.show(
      `${formatCurrency(config.behavior, amount, true)} · ${label} to ${count} ${count === 1 ? "student" : "students"}`,
      amount >= 0 ? "positive" : "negative",
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mx-auto w-full max-w-[1400px] flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-semibold leading-tight text-ink-900 dark:text-warm-ivory">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
              {students.length === 0
                ? "No students yet"
                : `${students.length} ${students.length === 1 ? "student" : "students"} · tap cards to select`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {students.length > 0 && (
              <button
                onClick={allSelected ? clear : selectAll}
                className="flex h-10 items-center gap-2 rounded-button border border-ink-200 bg-warm-ivory px-3 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:bg-ink-800"
              >
                {allSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                {allSelected ? "Clear" : "Select all"}
              </button>
            )}
            <button
              onClick={() => setAddOpen(true)}
              className="flex h-10 items-center gap-2 rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-3 text-sm font-semibold text-warm-ivory transition-colors hover:bg-ink-700 dark:hover:bg-deep-gold"
            >
              <UserPlus className="h-4 w-4" />
              Add student
            </button>
          </div>
        </header>

        {/* Stat strip */}
        <div className="mt-6">
          {loading || store.loading ? (
            <Skeleton className="h-[104px] rounded-card" />
          ) : (
            <StatStrip {...stats} />
          )}
        </div>

        {/* Search */}
        {students.length > 0 && (
          <div className="mt-6 flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search students…"
                className="h-10 w-full rounded-button border border-ink-200 bg-warm-ivory pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-900 dark:focus:ring-antique-gold/20"
              />
            </div>
            {students.length > 1 && (
              <div className="relative">
                <ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <select
                  value={sortMode}
                  onChange={(e) => {
                    const m = e.target.value as SortMode;
                    setSortMode(m);
                    saveSortMode(m);
                  }}
                  className="h-10 appearance-none rounded-button border border-ink-200 bg-warm-ivory pl-9 pr-8 text-sm font-semibold text-ink-700 outline-none transition-colors hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:bg-ink-800"
                  aria-label="Sort students"
                >
                  {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => (
                    <option key={m} value={m}>{SORT_LABELS[m]}</option>
                  ))}
                </select>
              </div>
            )}
            <span className="ml-auto text-xs font-medium text-ink-400 dark:text-ink-500">
              {filtered.length} shown
            </span>
          </div>
        )}

        {/* Grid */}
        <div className="mt-4 pb-28">
          {loading || store.loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-[72px]" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <EmptyState onAdd={() => setAddOpen(true)} currencyPlural={config.behavior.plural} />
          ) : filtered.length === 0 ? (
            <div className="rounded-card border border-dashed border-ink-200 py-12 text-center text-sm text-ink-500 dark:border-ink-700 dark:text-ink-400">
              No students match “{query}”.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
              {filtered.map((s, index) => (
                <StudentCard
                  key={s.id}
                  colorIndex={index}
                  name={s.displayName}
                  total={totals[s.id] ?? 0}
                  lifetime={store.lifetime[s.id] ?? 0}
                  selected={selected.has(s.id)}
                  pulsing={pulse.has(s.id)}
                  onClick={() => toggle(s.id)}
                  onQuickPlus={
                    firstPositive ? () => quickAward(s.id, firstPositive) : undefined
                  }
                  onQuickMinus={
                    firstNegative ? () => quickAward(s.id, firstNegative) : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sticky bottom selection bar */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 sm:px-8 sm:pb-6">
          <div className="mx-auto flex max-w-md items-center justify-between gap-3 animate-slide-up rounded-card bg-ink-900 px-4 py-3 text-warm-ivory shadow-soft-lg dark:bg-ink-800">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-button bg-warm-ivory/10">
                <Users className="h-[18px] w-[18px]" />
              </div>
              <span className="text-sm font-semibold">
                {selected.size} {selected.size === 1 ? "student" : "students"} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clear}
                className="rounded-button px-3 py-2 text-sm font-semibold text-warm-ivory/80 transition-colors hover:bg-warm-ivory/10"
              >
                Clear
              </button>
              <button
                onClick={openAward}
                className="flex items-center gap-2 rounded-button bg-antique-gold px-4 py-2 text-sm font-bold text-warm-ivory transition-colors hover:bg-deep-gold"
              >
                <Award className="h-4 w-4" />
                Award
              </button>
            </div>
          </div>
        </div>
      )}

      <AwardModal
        open={awardOpen}
        store={store}
        selectedCount={selected.size}
        onClose={() => setAwardOpen(false)}
        onAwarded={handleAwarded}
      />

      <QuickAddStudent
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(name, color) => {
          void store
            .addStudent(name, color)
            .then(() => {
              setAddOpen(false);
              toast.show(`${name} added`, "positive");
            })
            .catch(() => toast.show("Could not add student", "negative"));
        }}
        onGoToStudents={onGoToStudents}
      />
    </div>
  );
}

function EmptyState({ onAdd, currencyPlural }: { onAdd: () => void; currencyPlural: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border-2 border-dashed border-ink-200 bg-warm-ivory/50 py-16 text-center dark:border-ink-700 dark:bg-ink-900/40">
      <div className="flex h-16 w-16 items-center justify-center rounded-card bg-ivory-dim dark:bg-antique-gold/10">
        <Users className="h-8 w-8 text-deep-gold" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-ink-900 dark:text-warm-ivory">No students yet</h2>
      <p className="mt-1 max-w-xs text-sm text-ink-500 dark:text-ink-400">
        Add your first student to start awarding {currencyPlural} in class.
      </p>
      <button
        onClick={onAdd}
        className="mt-4 flex items-center gap-2 rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-4 py-2.5 text-sm font-semibold text-warm-ivory transition-colors hover:bg-ink-700 dark:hover:bg-deep-gold"
      >
        <UserPlus className="h-4 w-4" />
        Add your first student
      </button>
    </div>
  );
}

function QuickAddStudent({
  open,
  onClose,
  onAdd,
  onGoToStudents,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, color: number) => void;
  onGoToStudents: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setColor(Math.floor(Math.random() * AVATAR_PALETTE.length));
      setError("");
    }
  }, [open]);

  const submit = () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    onAdd(name.trim(), color);
  };

  return (
    <Modal open={open} title="Add student" onClose={onClose} onConfirm={submit} confirmLabel="Add student">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">
            Display name
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="e.g. Alex Rivera"
            className="h-10 w-full rounded-button border border-ink-200 bg-warm-ivory px-3 text-sm outline-none transition-colors placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800 dark:focus:ring-antique-gold/20"
          />
          {error && <p className="mt-1 text-xs text-warm-brick">{error}</p>}
        </div>
        <ColorPicker value={color} onChange={setColor} name={name} />
        <button
          onClick={onGoToStudents}
          className="text-xs font-medium text-deep-gold hover:text-deep-gold dark:text-antique-gold"
        >
          Need more options? Open full student manager →
        </button>
      </div>
    </Modal>
  );
}
