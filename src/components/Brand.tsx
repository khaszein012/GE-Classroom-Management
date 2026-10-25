import { Circle, Sparkles } from "lucide-react";

/**
 * The Genji Educator brand mark. Identity, not decoration: it keeps its
 * original palette in every colour theme via the pinned brand utilities
 * (the tile always provides a Genji-light / Genji-dark surface so the mark
 * never sits awkwardly on a themed background).
 */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="brand-tile relative flex h-10 w-10 shrink-0 items-center justify-center rounded-card shadow-soft">
        <Circle className="absolute h-7 w-7" strokeWidth={2.2} />
        <Sparkles className="brand-accent relative h-3.5 w-3.5" strokeWidth={2.5} />
      </div>
      <div className="leading-none">
        <div className={`brand-text font-display text-2xl font-semibold tracking-[0.12em] ${compact ? "text-xl" : ""}`}>GENJI</div>
        <div className="brand-accent mt-1 text-[9px] font-semibold uppercase tracking-[0.32em]">Educator</div>
      </div>
    </div>
  );
}

export function BrandLockup({ className = "" }: { className?: string }) {
  return <div className={className}><BrandMark /></div>;
}
