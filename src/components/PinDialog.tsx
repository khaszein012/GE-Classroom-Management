import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  pin: string;
  contextLine: string;
  onClose: () => void;
}

/** One-time PIN reveal with copy + warning. Nothing stores the plaintext PIN. */
export function PinDialog({ open, title, pin, contextLine, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) setCopied(false);
  }, [open]);

  if (!open) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pin);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-md animate-fade-scale-in rounded-t-card bg-warm-ivory shadow-soft-lg dark:bg-ink-900 sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-ink-100 px-5 py-4 dark:border-ink-800">
          <h2 className="text-base font-semibold text-ink-900 dark:text-warm-ivory">{title}</h2>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">{contextLine}</p>
        </div>
        <div className="px-5 py-5">
          <div className="flex items-center justify-center gap-2">
            <div className="flex items-center gap-2 rounded-card bg-ink-100 px-5 py-3 dark:bg-ink-800">
              <span className="text-3xl font-bold tracking-[0.25em] tabular-nums text-ink-900 dark:text-warm-ivory">
                {pin}
              </span>
              <button
                onClick={copy}
                className="ml-1 flex h-9 w-9 items-center justify-center rounded-button text-ink-500 transition-colors hover:bg-ink-200 dark:hover:bg-ink-700"
                aria-label="Copy PIN"
              >
                {copied ? <Check className="h-4 w-4 text-deep-gold" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {copied && (
            <p className="mt-2 text-center text-xs font-medium text-deep-gold">Copied to clipboard</p>
          )}
          <p className="mt-4 text-center text-sm font-medium text-deep-gold dark:text-antique-gold">
            Save this now — it cannot be viewed again.
          </p>
        </div>
        <div className="flex justify-end border-t border-ink-100 px-5 py-4 dark:border-ink-800">
          <button
            onClick={onClose}
            className="rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-4 py-2.5 text-sm font-semibold text-warm-ivory transition-colors hover:bg-ink-700 dark:hover:bg-deep-gold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
