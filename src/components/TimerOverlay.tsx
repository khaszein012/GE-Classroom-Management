import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Pause, Play, RotateCcw, Timer as TimerIcon, X } from "lucide-react";

/**
 * Projector timer — full-screen, huge digits, dark for maximum contrast.
 * Countdown (presets or custom hours/minutes/seconds) with a time's-up
 * alarm, plus a stopwatch. Space bar starts/pauses; Esc closes.
 */

type Mode = "countdown" | "stopwatch";

const PRESETS: { label: string; sec: number }[] = [
  { label: "30 sec", sec: 30 },
  { label: "1 min", sec: 60 },
  { label: "2 min", sec: 120 },
  { label: "3 min", sec: 180 },
  { label: "4 min", sec: 240 },
  { label: "5 min", sec: 300 },
  { label: "10 min", sec: 600 },
  { label: "15 min", sec: 900 },
  { label: "20 min", sec: 1200 },
  { label: "25 min", sec: 1500 },
  { label: "30 min", sec: 1800 },
  { label: "45 min", sec: 2700 },
  { label: "60 min", sec: 3600 },
];

function fmt(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function beep(): void {
  try {
    const ctx = new AudioContext();
    [0, 350, 700].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.12, ctx.currentTime + delay / 1000);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay / 1000 + 0.28);
      osc.start(ctx.currentTime + delay / 1000);
      osc.stop(ctx.currentTime + delay / 1000 + 0.3);
    });
    setTimeout(() => void ctx.close(), 1500);
  } catch {
    /* audio unavailable — silent is fine */
  }
}

/** One H/M/S stepper box: big mono digits, chevron up/down, label beneath. */
function TimePart({
  value,
  label,
  max,
  onChange,
}: {
  value: number;
  label: string;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-stretch rounded-card border border-white/15 bg-white/5 p-0.5 sm:p-1">
        <input
          value={value}
          inputMode="numeric"
          aria-label={label}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 2);
            onChange(Math.min(max, Number(digits || 0)));
          }}
          className="w-12 min-h-12 bg-transparent text-center font-mono text-3xl font-bold tabular-nums text-warm-ivory outline-none sm:w-16 sm:min-h-14 sm:text-4xl lg:w-20 lg:text-5xl"
        />
        <div className="flex flex-col justify-center gap-0.5 pl-0.5">
          <button
            onClick={() => onChange(Math.min(max, value + 1))}
            aria-label={`Increase ${label}`}
            className="flex h-9 w-9 items-center justify-center rounded-button text-ink-300 transition-colors hover:bg-white/10 hover:text-warm-ivory sm:h-10 sm:w-10"
          >
            <ChevronUp className="h-4 w-4" aria-hidden />
          </button>
          <button
            onClick={() => onChange(Math.max(0, value - 1))}
            aria-label={`Decrease ${label}`}
            disabled={value === 0}
            className="flex h-9 w-9 items-center justify-center rounded-button text-ink-300 transition-colors hover:bg-white/10 hover:text-warm-ivory disabled:opacity-30 sm:h-10 sm:w-10"
          >
            <ChevronDown className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-400">{label}</span>
    </div>
  );
}

export function TimerOverlay({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("countdown");
  const [hours, setHours] = useState(0);
  const [mins, setMins] = useState(5);
  const [secs, setSecs] = useState(0);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // stopwatch ms
  const [remaining, setRemaining] = useState(5 * 60_000); // countdown ms
  const [finished, setFinished] = useState(false);
  const tickRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  const totalSec = hours * 3600 + mins * 60 + secs;
  const duration = totalSec * 1000;

  // Ticker — one interval drives both modes.
  useEffect(() => {
    if (!running) return;
    lastRef.current = Date.now();
    tickRef.current = window.setInterval(() => {
      const now = Date.now();
      const delta = now - (lastRef.current ?? now);
      lastRef.current = now;
      if (mode === "stopwatch") {
        setElapsed((e) => e + delta);
      } else {
        setRemaining((r) => {
          const next = r - delta;
          if (next <= 0) {
            setRunning(false);
            setFinished(true);
            beep();
            return 0;
          }
          return next;
        });
      }
    }, 200);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [running, mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.code === "Space") {
        // Don't hijack space while typing in the H/M/S boxes.
        const el = e.target as HTMLElement | null;
        if (el && (el.tagName === "INPUT" || el.isContentEditable)) return;
        e.preventDefault();
        toggleRun();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, finished, totalSec, mode]);

  /** Set the countdown from a preset or the steppers; stops the clock. */
  const applySeconds = (sec: number) => {
    setHours(Math.floor(sec / 3600));
    setMins(Math.floor((sec % 3600) / 60));
    setSecs(sec % 60);
    setRunning(false);
    setFinished(false);
    setRemaining(sec * 1000);
  };

  const editPart = (part: "h" | "m" | "s", value: number) => {
    const h = part === "h" ? value : hours;
    const m = part === "m" ? value : mins;
    const s = part === "s" ? value : secs;
    setHours(h);
    setMins(m);
    setSecs(s);
    setRunning(false);
    setFinished(false);
    setRemaining((h * 3600 + m * 60 + s) * 1000);
  };

  const reset = () => {
    setRunning(false);
    setFinished(false);
    setElapsed(0);
    setRemaining(duration);
  };

  const toggleRun = () => {
    if (running) {
      setRunning(false);
      return;
    }
    if (finished) {
      // Restart: reload the full duration, then run.
      setRemaining(duration);
      setFinished(false);
      setRunning(true);
      return;
    }
    if (mode === "countdown" && totalSec === 0) return; // nothing to count
    setRunning(true);
  };

  const display = mode === "stopwatch" ? fmt(elapsed) : fmt(remaining);
  const urgent = mode === "countdown" && running && remaining <= 10_000 && remaining > 0;
  const showSetup = mode === "countdown" && !running;

  return (
    <div
      className="fixed inset-0 z-[65] flex flex-col bg-ink-950"
      role="dialog"
      aria-modal="true"
      aria-label="Classroom timer"
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-6 py-4">
        <div className="flex rounded-button border border-white/15 p-1" role="group" aria-label="Timer mode">
          {(["countdown", "stopwatch"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                reset();
              }}
              aria-pressed={mode === m}
              className={`flex min-h-11 items-center gap-2 rounded-button px-4 text-sm font-semibold transition-colors ${
                mode === m ? "bg-antique-gold text-obsidian" : "text-ink-300 hover:bg-white/5"
              }`}
            >
              <TimerIcon className="h-4 w-4" aria-hidden />
              {m === "countdown" ? "Countdown" : "Stopwatch"}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          aria-label="Close timer"
          className="flex h-11 w-11 items-center justify-center rounded-button text-ink-300 transition-colors hover:bg-white/10 hover:text-warm-ivory"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Giant digits */}
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <p
          className={`font-mono font-bold tabular-nums leading-none tracking-tight ${
            finished
              ? "animate-pulse text-warm-brick"
              : urgent
                ? "text-brick-light"
                : "text-warm-ivory"
          }`}
          style={{
            fontSize: display.length >= 7 ? "min(19vw, 36vh)" : "min(30vw, 42vh)",
            fontVariantNumeric: "tabular-nums",
          }}
          role="timer"
          aria-label={mode === "stopwatch" ? `Stopwatch at ${display}` : `${display} remaining`}
        >
          {display}
        </p>
        {finished && (
          <p className="mt-4 font-display text-4xl font-semibold text-antique-gold">Time's up!</p>
        )}
      </div>

      {/* Controls */}
      <div className="flex shrink-0 flex-col items-center gap-4 px-4 pb-8">
        {showSetup && (
          <>
            {/* Presets */}
            <div className="flex max-w-4xl flex-wrap items-center justify-center gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.sec}
                  onClick={() => applySeconds(p.sec)}
                  className={`min-h-12 rounded-button border px-4 font-mono text-sm font-bold tabular-nums transition-colors ${
                    totalSec === p.sec
                      ? "border-antique-gold bg-antique-gold/15 text-antique-gold"
                      : "border-white/15 text-ink-300 hover:bg-white/5"
                  }`}
                  aria-label={`${p.label} countdown`}
                  aria-pressed={totalSec === p.sec}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom H/M/S steppers */}
            <div className="flex items-start justify-center gap-1.5 sm:gap-3">
              <TimePart value={hours} label="Hours" max={23} onChange={(v) => editPart("h", v)} />
              <span className="mt-4 font-mono text-2xl font-bold text-ink-500 sm:mt-5 sm:text-3xl" aria-hidden>
                :
              </span>
              <TimePart value={mins} label="Minutes" max={59} onChange={(v) => editPart("m", v)} />
              <span className="mt-4 font-mono text-2xl font-bold text-ink-500 sm:mt-5 sm:text-3xl" aria-hidden>
                :
              </span>
              <TimePart value={secs} label="Seconds" max={59} onChange={(v) => editPart("s", v)} />
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={toggleRun}
            disabled={mode === "countdown" && !running && !finished && totalSec === 0}
            className={`flex min-h-14 items-center gap-2 rounded-button px-10 text-base font-bold transition-colors ${
              running
                ? "bg-warm-brick text-warm-ivory hover:bg-warm-brick/80"
                : "bg-antique-gold text-obsidian hover:bg-deep-gold hover:text-warm-ivory"
            } disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {running ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="h-5 w-5" aria-hidden />}
            {running ? "Pause" : finished ? "Restart" : "Start"}
          </button>
          <button
            onClick={reset}
            aria-label="Reset timer"
            className="flex min-h-14 w-14 items-center justify-center rounded-button border border-white/15 text-ink-300 transition-colors hover:bg-white/5 hover:text-warm-ivory"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
