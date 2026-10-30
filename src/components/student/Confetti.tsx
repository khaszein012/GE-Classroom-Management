import { useMemo, useState } from "react";

const CONFETTI_COLORS = [
  "bg-antique-gold",
  "bg-deep-gold",
  "bg-warm-brick",
  "bg-brick-light",
  "bg-ink-500",
];

/** Hand-rolled CSS confetti in theme colors — no dependencies, honors
 *  prefers-reduced-motion by not rendering at all. */
export function Confetti({ count = 90 }: { count?: number }) {
  const [motionOk] = useState(
    () => typeof window === "undefined" || !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 2.2 + Math.random() * 1.8,
        size: 6 + Math.random() * 7,
        rot: `${Math.random() > 0.5 ? "" : "-"}${240 + Math.round(Math.random() * 480)}deg`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: Math.random() > 0.5,
      })),
    [count],
  );
  if (!motionOk) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={`absolute top-0 block ${p.color} ${p.round ? "rounded-full" : "rounded-[1px]"}`}
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.round ? p.size : p.size * 0.55,
              animation: `confetti-fall ${p.duration}s linear ${p.delay}s forwards`,
              "--rot": p.rot,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
