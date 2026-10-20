import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Delete", onConfirm, onCancel }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-ink-950/40 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm animate-fade-scale-in rounded-card bg-warm-ivory p-6 shadow-soft-lg dark:bg-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-card bg-warm-brick/10 dark:bg-warm-brick/15">
          <AlertTriangle className="h-5 w-5 text-warm-brick dark:text-brick-light" />
        </div>
        <h2 className="text-base font-semibold text-ink-900 dark:text-warm-ivory">{title}</h2>
        <div className="mt-1.5 text-sm text-ink-600 dark:text-ink-300">{message}</div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-button px-4 py-2.5 text-sm font-semibold text-ink-600 transition-colors hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-button bg-warm-brick dark:bg-brick-light dark:text-obsidian px-4 py-2.5 text-sm font-semibold text-warm-ivory transition-colors hover:bg-warm-brick"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    message: React.ReactNode;
    confirmLabel?: string;
    onConfirm?: () => void;
  }>({ open: false, title: "", message: "" });

  const confirm = (opts: {
    title: string;
    message: React.ReactNode;
    confirmLabel?: string;
    onConfirm: () => void;
  }) => {
    setState({ open: true, ...opts });
  };

  const close = () => setState((s) => ({ ...s, open: false, onConfirm: undefined }));

  const dialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      confirmLabel={state.confirmLabel}
      onConfirm={() => {
        state.onConfirm?.();
        close();
      }}
      onCancel={close}
    />
  );

  return { confirm, dialog };
}
