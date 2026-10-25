import { useEffect, useState } from "react";
import { Sidebar, type Screen } from "@/components/Sidebar";
import { Dashboard } from "@/components/Dashboard";
import { StudentsScreen } from "@/components/StudentsScreen";
import { BehaviorsScreen } from "@/components/BehaviorsScreen";
import { ActivityLogScreen } from "@/components/ActivityLogScreen";
import { RewardsScreen } from "@/components/RewardsScreen";
import { QuizzesScreen } from "@/components/QuizzesScreen";
import { SettingsScreen } from "@/components/SettingsScreen";
import { LoginScreen } from "@/components/LoginScreen";
import { StudentView } from "@/components/StudentView";
import { PrintCards } from "@/components/PrintCards";
import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { CurrencyProvider, useCurrency } from "@/components/CurrencyProvider";
import { ToastProvider, useToast } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useStore, type Store } from "@/lib/useStore";
import { useTheme } from "@/lib/useTheme";
import { applyColorTheme } from "@/lib/themes";
import { migrateLegacyData } from "@/lib/migrate";
import { Skeleton } from "@/components/Skeleton";
import { ReconnectBanner } from "@/components/ReconnectBanner";

function BootScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 dark:bg-ink-950">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 px-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    </div>
  );
}

const SCREEN_TITLES: Record<Screen, string> = {
  dashboard: "Dashboard",
  students: "Students",
  behaviors: "Behaviors",
  rewards: "Rewards",
  quizzes: "Quizzes",
  activity: "Activity Log",
  settings: "Settings",
};

function MainApp({
  store,
  settingsError,
  onRetrySettings,
}: {
  store: Store;
  settingsError: boolean;
  onRetrySettings: () => void;
}) {
  const { theme, toggle } = useTheme();
  const { email, signOut } = useAuth();
  const { config, updateCurrency } = useCurrency();
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [printing, setPrinting] = useState(false);
  const pendingCount = store.redemptions.filter((r) => r.status === "pending").length;

  // The teacher's saved theme becomes authoritative once loaded; until then
  // the cached theme from before first paint stays applied (no flash).
  useEffect(() => {
    if (!store.loading) applyColorTheme(store.colorTheme);
  }, [store.colorTheme, store.loading]);

  useEffect(() => {
    document.title = `${SCREEN_TITLES[screen]} · Genji Educator`;
  }, [screen]);

  if (printing) {
    return <PrintCards students={store.students} onBack={() => setPrinting(false)} />;
  }

  return (
    <div className="flex h-screen flex-col bg-ink-50 dark:bg-ink-950 lg:flex-row">
      <ReconnectBanner />
      <Sidebar
        current={screen}
        onNavigate={setScreen}
        theme={theme}
        onToggleTheme={toggle}
        email={email}
        onSignOut={() => void signOut()}
        pendingCount={pendingCount}
      />
      {/* On desktop the sidebar is fixed 256px wide — shift content right by exactly that amount */}
      <main className="min-w-0 flex-1 overflow-hidden lg:ml-64">
        {store.error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm font-medium text-warm-brick">{store.error}</p>
            <button
              onClick={() => void store.refresh()}
              className="rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-4 py-2 text-sm font-semibold text-warm-ivory hover:bg-ink-700 dark:hover:bg-deep-gold"
            >
              Try again
            </button>
          </div>
        ) : (
          <div key={screen} className="h-full animate-slide-up">
            {screen === "dashboard" && (
              <Dashboard store={store} onGoToStudents={() => setScreen("students")} />
            )}
            {screen === "students" && (
              <StudentsScreen store={store} onPrintCards={() => setPrinting(true)} />
            )}
            {screen === "behaviors" && <BehaviorsScreen store={store} />}
            {screen === "rewards" && <RewardsScreen store={store} />}
            {screen === "quizzes" && <QuizzesScreen store={store} />}
            {screen === "activity" && <ActivityLogScreen store={store} />}
            {screen === "settings" && (
              <SettingsScreen
                config={config}
                onUpdateCurrency={updateCurrency}
                settingsError={settingsError}
                onRetrySettings={onRetrySettings}
                colorTheme={store.colorTheme}
                onUpdateColorTheme={(t) => {
                  store.saveColorTheme(t).catch(() => {
                    /* applied locally; persistence needs the Phase 7 migration */
                  });
                }}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Authenticated({
  settingsError,
  onRetrySettings,
}: {
  settingsError: boolean;
  onRetrySettings: () => void;
}) {
  const store = useStore();
  const toast = useToast();
  const [migrated, setMigrated] = useState(false);

  // One-time migration of any legacy localStorage data, after sign-in.
  useEffect(() => {
    if (migrated || store.loading) return;
    setMigrated(true);
    migrateLegacyData().then((result) => {
      if (result) {
        toast.show(result, "info");
        void store.refresh();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [migrated, store.loading]);

  return (
    <CurrencyProvider
      config={store.currencyConfig}
      loading={store.loading}
      onSave={store.saveCurrency}
    >
      <MainApp
        store={store}
        settingsError={settingsError}
        onRetrySettings={onRetrySettings}
      />
    </CurrencyProvider>
  );
}

function Gate() {
  const { session, ready, hasSettings, settingsError, recheckSettings, isStudent, signOut } = useAuth();

  if (!ready || (session && hasSettings === null && !isStudent)) return <BootScreen />;
  if (!session) return <LoginScreen />;

  // A signed-in student can ONLY ever reach the student view. Any teacher
  // navigation attempt lands here; there is no route inside StudentView.
  if (isStudent) {
    return (
      <ErrorBoundary>
        <StudentView onSignOut={() => void signOut()} />
      </ErrorBoundary>
    );
  }

  // Signups are closed at the auth provider level: exactly one teacher account
  // exists. A signed-in teacher session therefore always means setup already
  // ran, so the setup screen can never render again — by any navigation path.
  return (
    <ToastProvider>
      <Authenticated settingsError={settingsError} onRetrySettings={recheckSettings} />
    </ToastProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ErrorBoundary>
  );
}
