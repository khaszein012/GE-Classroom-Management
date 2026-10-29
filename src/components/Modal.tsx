import { useEffect } from "react";
import { X } from "lucide-react";
import { AVATAR_PALETTE, initialsOf } from "@/lib/avatarColor";
import { useFocusTrap } from "@/lib/useFocusTrap";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  children: React.ReactNode;
  destructive?: boolean;
}

export function Modal({
  open,
  title,
  onClose,
  onConfirm,
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  children,
  destructive = false,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const trapRef = useFocusTrap<HTMLDivElement>(open);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="w-full max-w-md animate-fade-scale-in rounded-t-card bg-warm-ivory shadow-soft-lg outline-none dark:bg-ink-900 sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4 dark:border-ink-800">
          <h2 className="text-base font-semibold text-ink-900 dark:text-warm-ivory">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-button text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-200"
            aria-label="Close"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-4 dark:border-ink-800">
          <button
            onClick={onClose}
            className="rounded-button px-4 py-2.5 text-sm font-semibold text-ink-600 transition-colors hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-button px-4 py-2.5 text-sm font-semibold text-warm-ivory transition-colors ${
              destructive
                ? "bg-warm-brick dark:bg-brick-light dark:text-obsidian hover:bg-warm-brick"
                : "bg-obsidian dark:bg-antique-gold dark:text-obsidian hover:bg-ink-700 dark:hover:bg-deep-gold"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ColorPicker({
  value,
  onChange,
  name = "",
  label = "Avatar colour",
}: {
  value: number;
  onChange: (color: number) => void;
  name?: string;
  label?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full text-base font-bold ${AVATAR_PALETTE[value % AVATAR_PALETTE.length].bg} ${AVATAR_PALETTE[value % AVATAR_PALETTE.length].text}`}
        >
          {initialsOf(name) || "?"}
        </div>
        <span className="text-sm text-ink-500 dark:text-ink-400">{label}</span>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {AVATAR_PALETTE.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all ${c.bg} ${c.text} ${
              value === i
                ? "ring-2 ring-offset-2 ring-antique-gold dark:ring-offset-ink-900"
                : "hover:scale-110"
            }`}
            aria-label={`Colour ${i + 1}`}
          >
            {initialsOf(name) || "?"}
          </button>
        ))}
      </div>
    </div>
  );
}
