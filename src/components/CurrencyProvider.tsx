import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { CurrencyConfig, CurrencyKind, CurrencySettings } from "@/types";
import { DEFAULT_CURRENCY_CONFIG } from "@/lib/currency";
import { Skeleton } from "@/components/Skeleton";

interface CurrencyContextValue {
  config: CurrencyConfig;
  updateCurrency: (kind: CurrencyKind, settings: CurrencySettings) => void;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

interface Props {
  config: CurrencyConfig | undefined;
  loading: boolean;
  onSave: (config: CurrencyConfig) => Promise<void> | void;
  children: ReactNode;
}

/**
 * Sits inside the auth gate and above every screen. While the store is
 * loading class_settings from the database it renders a skeleton instead
 * of children, so no consumer ever sees undefined currency values. If the
 * settings row is missing or fails to load, the hardcoded defaults apply
 * and the app still renders.
 */
export function CurrencyProvider({ config, loading, onSave, children }: Props) {
  const [local, setLocal] = useState<CurrencyConfig | null>(null);

  const effective = local ?? config ?? DEFAULT_CURRENCY_CONFIG;

  const updateCurrency = useCallback(
    (kind: CurrencyKind, settings: CurrencySettings) => {
      const next = { ...effective, [kind]: settings };
      setLocal(next);
      void Promise.resolve(onSave(next)).catch(() => setLocal(null));
    },
    [effective, onSave],
  );

  const value = useMemo(() => ({ config: effective, updateCurrency }), [effective, updateCurrency]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 dark:bg-ink-950">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 px-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
    );
  }

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
}
