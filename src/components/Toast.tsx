import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface Toast {
  id: string;
  message: string;
  tone: "positive" | "negative" | "info";
}

interface ToastContextValue {
  show: (message: string, tone?: Toast["tone"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const toneConfig = {
    positive: {
      icon: CheckCircle2,
      bar: "bg-deep-gold",
      iconColor: "text-deep-gold",
    },
    negative: {
      icon: XCircle,
      bar: "bg-warm-brick",
      iconColor: "text-warm-brick",
    },
    info: {
      icon: Info,
      bar: "bg-antique-gold",
      iconColor: "text-deep-gold",
    },
  }[toast.tone];

  const Icon = toneConfig.icon;

  return (
    <div className="pointer-events-auto flex w-72 animate-slide-in-right items-center gap-3 overflow-hidden rounded-card bg-warm-ivory py-3 pl-3 pr-2 shadow-soft-lg dark:bg-ink-800">
      <div className={`h-9 w-1 shrink-0 rounded-full ${toneConfig.bar}`} />
      <Icon className={`h-5 w-5 shrink-0 ${toneConfig.iconColor}`} />
      <span className="flex-1 text-sm font-medium text-ink-800 dark:text-ink-100">{toast.message}</span>
      <button
        onClick={onDismiss}
        className="flex h-7 w-7 items-center justify-center rounded-button text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-700"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
