import { useRef, useState } from "react";
import { Dices, RotateCcw, X } from "lucide-react";
import { Monogram } from "@/components/Monogram";
import { AVATAR_PALETTE } from "@/lib/avatarColor";
import { Confetti } from "@/components/student/Confetti";

/**
 * Random student picker — a big spinning wheel for the projector.
 * Fair mode: everyone gets a turn before anyone repeats (picked list kept
 * locally, reset anytime). SVG wheel with per-student avatar gradient
 * segments, eased CSS rotation, confetti reveal.
 */

const SPIN_MS = 4600;
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
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<PickerStudent | null>(null);
  const rotationRef = useRef(0);

  const active = students.filter((s) => !fairMode || !pickedIds.includes(s.id));
  const segments = active.length;
  const seg = segments > 0 ? 360 / segments : 360;

  /** Pull the raw hex pair out of the palette's Tailwind gradient classes so
   *  wheel segments use the exact same colours as the student's avatar. */
  const hexOf = (s: PickerStudent) => {
    const def = AVATAR_PALETTE[s.avatarColor % AVATAR_PALETTE.length];
    const from = def.bg.match(/from-\[(#[0-9a-fA-F]{6})\]/)?.[1] ?? "#5b4327";
    const to = def.bg.match(/to-\[(#[0-9a-fA-F]{6})\]/)?.[1] ?? "#3d2f27";
    return { from, to };
  };

  const arcPath = (index: number) => {
    const size = 560;
    const cx = size / 2;
    const rr = size / 2 - 8;
    const a0 = (index * seg - 90) * (Math.PI / 180);
    const a1 = ((index + 1) * seg - 90) * (Math.PI / 180);
    const x0 = cx + rr * Math.cos(a0);
    const y0 = cx + rr * Math.sin(a0);
    const x1 = cx + rr * Math.cos(a1);
    const y1 = cx + rr * Math.sin(a1);
    const large = seg > 180 ? 1 : 0;
    if (segments === 1) {
      return `M ${cx} ${cx - rr} A ${rr} ${rr} 0 1 1 ${cx - 0.01} ${cx - rr} Z`;
    }
    return `M ${cx} ${cx} L ${x0} ${y0} A ${rr} ${rr} 0 ${large} 1 ${x1} ${y1} Z`;
  };

  const spin = () => {
    if (spinning || active.length === 0) return;
    setWinner(null);
    setSpinning(true);
    const winnerIndex = Math.floor(Math.random() * active.length);
    const segment = 360 / active.length;
    // Land the pointer (top) mid-segment, with jitter so repeats differ.
    const targetAngle = winnerIndex * segment + segment / 2 + (Math.random() - 0.5) * segment * 0.6;
    const currentMod = ((rotationRef.current % 360) + 360) % 360;
    const spinTo = rotationRef.current + 360 * 5 + ((360 - targetAngle - currentMod + 720) % 360);
    rotationRef.current = spinTo;
    setRotation(spinTo);
    setTimeout(() => {
      const w = active[winnerIndex];
      setWinner(w);
      if (fairMode) {
        const next = [...pickedIds, w.id].filter((id) => students.some((s) => s.id === id));
        setPickedIds(next);
        try {
          localStorage.setItem(FAIR_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }
      setSpinning(false);
    }, SPIN_MS + 100);
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

  const size = 560;
  const cx = size / 2;
  const rr = size / 2 - 8;

  return (
    <div
      className="fixed inset-0 z-[65] flex flex-col items-center overflow-hidden bg-ink-950/95 px-4 py-5"
      role="dialog"
      aria-modal="true"
      aria-label="Random student picker"
    >
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
              disabled={pickedIds.length === 0 || spinning}
              className="flex min-h-11 items-center gap-1.5 rounded-button border border-white/15 px-3 text-xs font-semibold text-ink-300 transition-colors hover:bg-white/5 hover:text-warm-ivory disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Reset turns
            </button>
          </>
        )}
      </div>

      {winner ? (
        <div className="relative flex flex-1 flex-col items-center justify-center px-4 text-center">
          <Confetti count={120} />
          <div className="relative z-10 flex flex-col items-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-antique-gold">
              The wheel chooses
            </p>
            <div className="mt-6 scale-125">
              <Monogram name={winner.displayName} colorIndex={winner.avatarColor} size="xl" />
            </div>
            <p className="mt-8 font-display text-6xl font-bold text-warm-ivory sm:text-7xl">
              {winner.displayName}
            </p>
            <div className="mt-10 flex gap-3">
              <button
                onClick={() => setWinner(null)}
                className="flex min-h-12 items-center gap-2 rounded-button bg-antique-gold px-6 py-3 text-sm font-bold text-obsidian transition-colors hover:bg-deep-gold hover:text-warm-ivory"
              >
                <Dices className="h-4 w-4" aria-hidden />
                Spin again
              </button>
              <button
                onClick={onClose}
                className="min-h-12 rounded-button border border-white/20 px-6 py-3 text-sm font-semibold text-ink-200 transition-colors hover:bg-white/10"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex flex-1 flex-col items-center justify-center self-stretch">
          <div
            className="absolute top-2 z-20 h-0 w-0 border-x-[14px] border-t-[26px] border-x-transparent border-t-antique-gold drop-shadow"
            aria-hidden
          />
          <div className="relative" style={{ width: "min(70vmin, 560px)", height: "min(70vmin, 560px)" }}>
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="h-full w-full drop-shadow-2xl"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.8, 0.22, 1)` : "none",
              }}
              aria-hidden
            >
              <defs>
                {active.map((s, i) => {
                  const { from, to } = hexOf(s);
                  return (
                    <linearGradient key={s.id} id={`wheel-grad-${i}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={from} />
                      <stop offset="100%" stopColor={to} />
                    </linearGradient>
                  );
                })}
              </defs>
              {active.map((s, i) => {
                const mid = (i + 0.5) * seg;
                const labelR = rr * 0.62;
                const labelAngle = mid - 90;
                const lx = cx + labelR * Math.cos((labelAngle * Math.PI) / 180);
                const ly = cx + labelR * Math.sin((labelAngle * Math.PI) / 180);
                return (
                  <g key={s.id}>
                    <path
                      d={arcPath(i)}
                      fill={`url(#wheel-grad-${i})`}
                      stroke="rgb(11 13 16 / 0.6)"
                      strokeWidth="2"
                    />
                    {segments > 1 && segments <= 30 && (
                      <text
                        x={lx}
                        y={ly}
                        fill="#f4f0e7"
                        fontSize={Math.max(11, Math.min(20, 520 / segments))}
                        fontWeight="700"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(${mid}, ${cx}, ${cx})`}
                      >
                        {s.displayName.length > 16 ? `${s.displayName.slice(0, 15)}…` : s.displayName}
                      </text>
                    )}
                  </g>
                );
              })}
              {active.length === 0 && <circle cx={cx} cy={cx} r={rr} fill="rgb(20 23 28)" />}
            </svg>
            <button
              onClick={spin}
              disabled={spinning || active.length === 0}
              className="absolute left-1/2 top-1/2 z-10 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-obsidian text-warm-ivory shadow-soft-lg ring-4 ring-antique-gold/60 transition-transform hover:scale-105 disabled:cursor-wait"
              aria-label={spinning ? "Spinning" : "Spin the wheel"}
            >
              {spinning ? (
                <span className="animate-pulse font-mono text-xs font-bold uppercase tracking-widest">…</span>
              ) : (
                <>
                  <Dices className="h-7 w-7 text-antique-gold" aria-hidden />
                  <span className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-widest">Spin</span>
                </>
              )}
            </button>
          </div>
          <p className="mt-4 shrink-0 text-sm text-ink-400">
            {active.length === 0
              ? fairMode
                ? "Everyone has had a turn — reset to start a new round."
                : "No students to pick from."
              : `${active.length} ${active.length === 1 ? "student" : "students"} on the wheel`}
          </p>
        </div>
      )}
    </div>
  );
}
