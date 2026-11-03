import { useEffect, useRef, useState } from "react";
import { Check, Dices, RotateCcw, Users, X } from "lucide-react";
import { Monogram } from "@/components/Monogram";
import { Confetti } from "@/components/student/Confetti";

/**
 * Random student picker — slot-machine style name roller for the projector.
 * Pool: by default everyone; the teacher can narrow it to a hand-picked
 * subset (kept per class in localStorage). Fair mode: everyone in the pool
 * gets a turn before anyone repeats. One giant name flickers and
 * decelerates onto the winner — tidy at any class size.
 */

const FAIR_KEY = "cr_picker_picked";
const FAIR_MODE_KEY = "cr_picker_fair";
const poolKey = (classId: number) => `cr_picker_pool_${classId}`;

interface PickerStudent {
  id: string;
  displayName: string;
  avatarColor: number;
}

function loadPicked(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAIR_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Saved pool for this class, minus ids that no longer exist; none saved → everyone. */
function loadPool(classId: number, students: PickerStudent[]): string[] | null {
  try {
    const raw = localStorage.getItem(poolKey(classId));
    if (!raw) return null;
    const saved: string[] = JSON.parse(raw);
    const ids = new Set(students.map((s) => s.id));
    const valid = saved.filter((id) => ids.has(id));
    return valid.length > 0 ? valid : null; // empty/stale save self-heals to everyone
  } catch {
    return null;
  }
}

export function PickerOverlay({
  students,
  classId,
  onClose,
}: {
  students: PickerStudent[];
  classId: number;
  onClose: () => void;
}) {
  const [fairMode, setFairMode] = useState(() => localStorage.getItem(FAIR_MODE_KEY) !== "0");
  const [pickedIds, setPickedIds] = useState<string[]>(loadPicked);
  const [poolIds, setPoolIds] = useState<string[] | null>(() => loadPool(classId, students));
  const [choosing, setChoosing] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [display, setDisplay] = useState<PickerStudent | null>(students[0] ?? null);
  const [landed, setLanded] = useState<PickerStudent | null>(null);
  const timerRef = useRef<number | null>(null);

  const pool = poolIds === null ? students : students.filter((s) => poolIds.includes(s.id));
  const active = pool.filter((s) => !fairMode || !pickedIds.includes(s.id));

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const savePool = (next: string[] | null) => {
    setPoolIds(next);
    try {
      if (next === null) localStorage.removeItem(poolKey(classId));
      else localStorage.setItem(poolKey(classId), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const toggleInPool = (id: string) => {
    const base = poolIds ?? students.map((s) => s.id);
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    // Deselecting everything = back to "everyone" (never a dead-end pool).
    savePool(next.length === 0 ? null : next);
  };

  const roll = () => {
    if (rolling || active.length === 0) return;
    setLanded(null);
    setRolling(true);
    const winnerIndex = Math.floor(Math.random() * active.length);
    const flicks = 22 + Math.floor(Math.random() * 6);
    let n = 0;
    const tick = () => {
      setDisplay(active[n % active.length]);
      n += 1;
      if (n <= flicks) {
        // Decelerate: 55 ms flicks easing out to ~435 ms as it lands.
        timerRef.current = window.setTimeout(tick, 55 + Math.pow(n / flicks, 2.2) * 380);
      } else {
        const w = active[winnerIndex];
        setDisplay(w);
        setLanded(w);
        setRolling(false);
        if (fairMode) {
          const next = [...pickedIds, w.id].filter((pid) => students.some((x) => x.id === pid));
          setPickedIds(next);
          try {
            localStorage.setItem(FAIR_KEY, JSON.stringify(next));
          } catch {
            /* ignore */
          }
        }
      }
    };
    tick();
  };

  const resetPicked = () => {
    setPickedIds([]);
    try {
      localStorage.setItem(FAIR_KEY, "[]");
    } catch {
      /* ignore */
    }
  };

  const toggleFair = () => {
    const next = !fairMode;
    setFairMode(next);
    try {
      localStorage.setItem(FAIR_MODE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  // ----- Choose-pool panel -------------------------------------------------
  if (choosing) {
    const selected = new Set(poolIds ?? students.map((s) => s.id));
    return (
      <div
        className="fixed inset-0 z-[65] flex flex-col overflow-hidden bg-ink-950/95 px-4 py-5"
        role="dialog"
        aria-modal="true"
        aria-label="Choose who can be picked"
      >
        <div className="mx-auto flex w-full max-w-3xl shrink-0 items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-warm-ivory">
            <Users className="h-6 w-6 text-antique-gold" aria-hidden />
            Who can be picked?
          </h1>
          <button
            onClick={() => setChoosing(false)}
            aria-label="Back to the picker"
            className="flex h-11 w-11 items-center justify-center rounded-button text-ink-300 transition-colors hover:bg-white/10 hover:text-warm-ivory"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mx-auto mt-1 w-full max-w-3xl text-sm text-ink-400">
          Tap to include or exclude — the roller only picks highlighted students. Your selection is
          remembered for this class.
        </p>

        <div className="mx-auto mt-3 flex w-full max-w-3xl shrink-0 items-center justify-between gap-2">
          <span className="font-mono text-sm font-bold tabular-nums text-antique-gold">
            {selected.size} of {students.length} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => savePool(null)}
              disabled={poolIds === null}
              className="min-h-11 rounded-button border border-white/15 px-3 text-xs font-semibold text-ink-300 transition-colors hover:bg-white/5 hover:text-warm-ivory disabled:opacity-40"
            >
              Everyone
            </button>
            <button
              onClick={() => savePool([])}
              disabled={poolIds !== null && poolIds.length === 0}
              className="min-h-11 rounded-button border border-white/15 px-3 text-xs font-semibold text-ink-300 transition-colors hover:bg-white/5 hover:text-warm-ivory disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mx-auto mt-3 w-full max-w-3xl flex-1 overflow-y-auto pb-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {students.map((s) => {
              const on = selected.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleInPool(s.id)}
                  aria-pressed={on}
                  className={`flex min-h-14 items-center gap-2.5 rounded-card border px-3 text-left transition-colors ${
                    on
                      ? "border-antique-gold/60 bg-antique-gold/10 text-warm-ivory"
                      : "border-white/10 bg-white/[0.03] text-ink-400 hover:bg-white/5"
                  }`}
                >
                  <Monogram name={s.displayName} colorIndex={s.avatarColor} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.displayName}</span>
                  {on && <Check className="h-4 w-4 shrink-0 text-antique-gold" aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-3xl shrink-0 justify-center pt-2">
          <button
            onClick={() => setChoosing(false)}
            disabled={selected.size === 0}
            className="flex min-h-14 items-center gap-2 rounded-button bg-antique-gold px-10 text-base font-bold text-obsidian transition-colors hover:bg-deep-gold hover:text-warm-ivory disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Dices className="h-5 w-5" aria-hidden />
            {selected.size === 0
              ? "Select at least one student"
              : `Pick from ${selected.size} student${selected.size === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    );
  }

  // ----- Roller ------------------------------------------------------------
  return (
    <div
      className="fixed inset-0 z-[65] flex flex-col items-center overflow-hidden bg-ink-950/95 px-4 py-5"
      role="dialog"
      aria-modal="true"
      aria-label="Random student picker"
    >
      {/* Header */}
      <div className="flex w-full max-w-4xl shrink-0 items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-warm-ivory">
          <Dices className="h-6 w-6 text-antique-gold" aria-hidden />
          Pick a student
        </h1>
        <button
          onClick={onClose}
          aria-label="Close picker"
          className="flex h-11 w-11 items-center justify-center rounded-button text-ink-300 transition-colors hover:bg-white/10 hover:text-warm-ivory"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Fair mode + pool bar */}
      <div className="flex w-full max-w-4xl shrink-0 flex-wrap items-center justify-center gap-3 py-3">
        <button
          onClick={toggleFair}
          role="switch"
          aria-checked={fairMode}
          className={`flex min-h-11 items-center gap-2 rounded-button border px-3 text-xs font-semibold transition-colors ${
            fairMode
              ? "border-antique-gold/50 bg-antique-gold/10 text-antique-gold"
              : "border-white/15 text-ink-300 hover:bg-white/5"
          }`}
        >
          <span
            className={`relative h-4 w-8 rounded-full transition-colors ${fairMode ? "bg-antique-gold" : "bg-ink-600"}`}
            aria-hidden
          >
            <span
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-warm-ivory transition-all ${fairMode ? "left-[18px]" : "left-0.5"}`}
            />
          </span>
          Fair mode
        </button>
        <button
          onClick={() => setChoosing(true)}
          disabled={rolling}
          aria-label="Choose which students can be picked"
          className={`flex min-h-11 items-center gap-2 rounded-button border px-3 text-xs font-semibold transition-colors ${
            poolIds === null
              ? "border-white/15 text-ink-300 hover:bg-white/5"
              : "border-antique-gold/50 bg-antique-gold/10 text-antique-gold"
          } disabled:opacity-40`}
        >
          <Users className="h-3.5 w-3.5" aria-hidden />
          {poolIds === null
            ? `All ${students.length} students`
            : `${poolIds.length} of ${students.length} students`}
        </button>
        {fairMode && (
          <>
            <span className="font-mono text-xs tabular-nums text-ink-300">
              {active.length} of {pool.length} remaining
            </span>
            <button
              onClick={resetPicked}
              disabled={pickedIds.length === 0 || rolling}
              className="flex min-h-11 items-center gap-1.5 rounded-button border border-white/15 px-3 text-xs font-semibold text-ink-300 transition-colors hover:bg-white/5 hover:text-warm-ivory disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Reset turns
            </button>
          </>
        )}
      </div>

      {/* Name roller */}
      <div className="relative flex flex-1 flex-col items-center justify-center self-stretch px-4 text-center">
        {landed && <Confetti count={120} />}
        <div className="relative z-10 flex flex-col items-center">
          <div
            className={`flex h-28 w-28 items-center justify-center transition-transform duration-300 ${
              rolling ? "scale-95" : "scale-110"
            }`}
          >
            <Monogram
              name={display?.displayName ?? "?"}
              colorIndex={display?.avatarColor ?? 0}
              size="xl"
            />
          </div>
          {landed ? (
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-antique-gold">
              We choose
            </p>
          ) : rolling ? (
            <p className="mt-6 animate-pulse text-sm font-semibold uppercase tracking-[0.3em] text-ink-400">
              Picking…
            </p>
          ) : (
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-ink-400">
              Ready when you are
            </p>
          )}
          {/* The name — keyed so every flick remounts with a quick fade */}
          <p
            key={display?.id ?? "none"}
            className={`mt-2 max-w-5xl font-display font-bold leading-tight text-warm-ivory sm:text-7xl text-6xl ${
              rolling ? "opacity-80 blur-[1px]" : ""
            }`}
            style={{ fontSize: "min(11vw, 8rem)" }}
          >
            {display?.displayName ?? "—"}
          </p>
          {landed && (
            <p className="mt-3 text-sm font-medium text-ink-300">
              {display?.displayName.split(" ")[0]}'s turn!
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="z-10 mt-12 flex shrink-0 flex-wrap items-center justify-center gap-3">
          <button
            onClick={roll}
            disabled={rolling || active.length === 0}
            className="flex min-h-14 items-center gap-2 rounded-button bg-antique-gold px-10 text-base font-bold text-obsidian transition-colors hover:bg-deep-gold hover:text-warm-ivory disabled:cursor-wait disabled:opacity-60"
            aria-label={rolling ? "Picking" : landed ? "Pick again" : "Pick a student"}
          >
            <Dices className="h-5 w-5" aria-hidden />
            {rolling
              ? "Picking…"
              : landed
                ? "Roll again"
                : active.length === 0
                  ? fairMode
                    ? "Everyone's had a turn"
                    : "No students selected"
                  : "Pick a student"}
          </button>
          {fairMode && pickedIds.length > 0 && (
            <button
              onClick={resetPicked}
              disabled={rolling}
              className="flex min-h-14 items-center gap-1.5 rounded-button border border-white/15 px-5 text-sm font-semibold text-ink-300 transition-colors hover:bg-white/5 hover:text-warm-ivory disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset turns
            </button>
          )}
          <button
            onClick={onClose}
            className="min-h-14 rounded-button border border-white/20 px-6 text-sm font-semibold text-ink-200 transition-colors hover:bg-white/10"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
