import { Circle, Sparkles } from "lucide-react";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-obsidian text-warm-ivory shadow-soft dark:bg-warm-ivory dark:text-obsidian">
        <Circle className="absolute h-7 w-7" strokeWidth={2.2} />
        <Sparkles className="relative h-3.5 w-3.5 text-antique-gold" strokeWidth={2.5} />
      </div>
      <div className="leading-none">
        <div className={`font-display text-2xl font-semibold tracking-[0.12em] text-obsidian dark:text-warm-ivory ${compact ? "text-xl" : ""}`}>GENJI</div>
        <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.32em] text-antique-gold">Educator</div>
      </div>
    </div>
  );
}

export function BrandLockup({ className = "" }: { className?: string }) {
  return <div className={className}><BrandMark /></div>;
}
