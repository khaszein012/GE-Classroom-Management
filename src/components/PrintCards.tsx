import { Printer, X } from "lucide-react";
import { BrandLockup } from "@/components/Brand";
import { Monogram } from "@/components/Monogram";
import type { Student } from "@/types";

interface Props {
  students: Student[];
  onBack: () => void;
}

/** Printable page with one small login card per student (blank space for the PIN). */
export function PrintCards({ students, onBack }: Props) {
  return (
    <div className="min-h-screen bg-ink-100 print:bg-warm-ivory">
      <div className="mx-auto max-w-4xl px-4 py-6 print:p-0">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <h1 className="font-display text-3xl font-semibold text-obsidian">Student login cards</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex h-10 items-center gap-2 rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-3 text-sm font-semibold text-warm-ivory hover:bg-ink-700 dark:hover:bg-deep-gold"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
            <button
              onClick={onBack}
              className="flex h-10 w-10 items-center justify-center rounded-button text-ink-500 hover:bg-ink-200"
              aria-label="Back"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mb-6 hidden print:block">
          <BrandLockup />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3">
          {students.map((s) => (
            <div
              key={s.id}
              className="break-inside-avoid rounded-card border border-ink-300 bg-warm-ivory p-3 shadow-soft print:shadow-none"
            >
              <div className="flex items-center gap-2.5">
                <Monogram name={s.displayName} colorIndex={s.avatarColor} avatarId={s.equippedAvatar} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink-900">{s.displayName}</div>
                  <div className="truncate text-xs text-ink-500">{s.username ?? "—"}</div>
                </div>
              </div>
              <div className="mt-2 border-t border-dashed border-ink-300 pt-1.5">
                <div className="text-[9px] font-semibold uppercase tracking-wide text-ink-400">PIN</div>
                <div className="h-5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
