import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Timer as TimerIcon, X } from "lucide-react";

/**
 * Projector timer — full-screen, huge digits, dark for maximum contrast.
 * Countdown (presets or custom) with a time's-up alarm, plus a stopwatch.
 * Space bar starts/pauses; Esc closes.
 */

type Mode = "countdown" | "stopwatch";

function fmt(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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

export function TimerOverlay({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("countdown");
  const [presetMin, setPresetMin] = useState(5);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // stopwatch ms
  const [remaining, setRemaining] = useState(5 * 60_000); // countdown ms
  const [finished, setFinished] = useState(false);
  const tickRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  const duration = presetMin * 60_000;

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
        e.preventDefault();
        setRunning((r) => !r);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const reset = () => {
    setRunning(false);
    setFinished(false);
    setElapsed(0);
    setRemaining(duration);
  };

  const setMinutes = (m: number) => {
    setPresetMin(m);
    setRunning(false);
    setFinished(false);
    setRemaining(m * 60_000);
  };

  const display = mode === "stopwatch" ? fmt(elapsed) : fmt(remaining);
  const urgent = mode === "countdown" && running && remaining <= 10_000 && remaining > 0;

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
          style={{ fontSize: "min(30vw, 42vh)", fontVariantNumeric: "tabular-nums" }}
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
      <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 px-4 pb-8">
        {mode === "countdown" && !running && (
          <>
            {[1, 3, 5, 10, 15, 20].map((m) => (
              <button
                key={m}
                onClick={() => setMinutes(m)}
                className={`min-h-12 rounded-button border px-4 font-mono text-sm font-bold tabular-nums transition-colors ${
                  presetMin === m
                    ? "border-antique-gold bg-antique-gold/15 text-antique-gold"
                    : "border-white/15 text-ink-300 hover:bg-white/5"
                }`}
                aria-label={`${m} minute countdown`}
              >
                {m} min
              </button>
            ))}
          </>
        )}
        <button
          onClick={() => setRunning((r) => !r)}
          className={`flex min-h-14 items-center gap-2 rounded-button px-10 text-base font-bold transition-colors ${
            running
              ? "bg-warm-brick text-warm-ivory hover:bg-warm-brick/80"
              : "bg-antique-gold text-obsidian hover:bg-deep-gold hover:text-warm-ivory"
          }`}
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
  );
}
