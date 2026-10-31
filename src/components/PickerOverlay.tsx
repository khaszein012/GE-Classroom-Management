import { useEffect, useRef, useState } from "react";
import { Dices, RotateCcw, X } from "lucide-react";
import { Monogram } from "@/components/Monogram";
import { Confetti } from "@/components/student/Confetti";

/**
 * Random student picker — slot-machine style name roller for the projector.
 * Fair mode: everyone gets a turn before anyone repeats (picked list kept
 * locally, reset anytime). One giant name flickers and decelerates onto the
 * winner — tidy at any class size, big enough to read from the back row.
 */

const FAIR_KEY = "cr_picker_picked";
const FAIR_MODE_KEY = "cr_picker_fair";

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

export function PickerOverlay({ students, onClose }: { students: PickerStudent[]; onClose: () => void }) {
  const [fairMode, setFairMode] = useState(() => localStorage.getItem(FAIR_MODE_KEY) !== "0");
  const [pickedIds, setPickedIds] = useState<string[]>(loadPicked);
  const [rolling, setRolling] = useState(false);
  const [display, setDisplay] = useState<PickerStudent | null>(students[0] ?? null);
  const [landed, setLanded] = useState<PickerStudent | null>(null);
  const timerRef = useRef<number | null>(null);

  const active = students.filter((s) => !fairMode || !pickedIds.includes(s.id));

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

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

      {/* Fair mode bar */}
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
        {fairMode && (
          <>
            <span className="font-mono text-xs tabular-nums text-ink-300">
              {active.length} of {students.length} remaining
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
            className={`flex min-h-14 items-center gap-2 rounded-button px-10 text-base font-bold transition-colors ${
              landed
                ? "bg-antique-gold text-obsidian hover:bg-deep-gold hover:text-warm-ivory"
                : "bg-antique-gold text-obsidian hover:bg-deep-gold hover:text-warm-ivory"
            } disabled:cursor-wait disabled:opacity-60`}
            aria-label={rolling ? "Picking" : landed ? "Pick again" : "Pick a student"}
          >
            <Dices className="h-5 w-5" aria-hidden />
            {rolling ? "Picking…" : landed ? "Roll again" : active.length === 0 ? "Everyone's had a turn" : "Pick a student"}
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
