import { ClipboardList, HelpCircle, History, Home, LineChart, LogOut, Menu, Moon, Settings, Store, Sun, Users, X, Zap } from "lucide-react";
import { BrandMark } from "@/components/Brand";
import { useState } from "react";

export type Screen = "dashboard" | "students" | "behaviors" | "rewards" | "quizzes" | "activity" | "insights" | "settings";

interface Props {
  current: Screen;
  onNavigate: (s: Screen) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  email?: string | null;
  onSignOut?: () => void;
  pendingCount?: number;
  onOpenHelp?: () => void;
}

interface NavItemsProps {
  current: Screen;
  onNavigate: (s: Screen) => void;
  pendingCount?: number;
}

const NAV: { id: Screen; label: string; icon: typeof Home }[] = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "students", label: "Students", icon: Users },
  { id: "behaviors", label: "Behaviors", icon: Zap },
  { id: "rewards", label: "Rewards", icon: Store },
  { id: "quizzes", label: "Quizzes", icon: ClipboardList },
  { id: "activity", label: "Activity", icon: History },
  { id: "insights", label: "Insights", icon: LineChart },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ current, onNavigate, theme, onToggleTheme, email, onSignOut, pendingCount = 0, onOpenHelp }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (s: Screen) => {
    onNavigate(s);
    setMobileOpen(false);
  };

  const openHelp = () => {
    setMobileOpen(false);
    onOpenHelp?.();
  };

  return (
    <>
      {/* Mobile top bar with hamburger — fully hidden at 1024px+ */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-200/70 bg-warm-ivory/80 px-4 py-3 backdrop-blur-md dark:border-ink-800/70 dark:bg-ink-900/80 lg:hidden">
        <Brand compact />
        <button
          onClick={() => setMobileOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-button text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer — exists only below 1024px, slides in from the LEFT */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm" />
          <div
            className="absolute left-0 top-0 h-full w-72 animate-slide-in-left bg-warm-ivory p-4 shadow-soft-lg dark:bg-ink-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <Brand />
              <button
                onClick={() => setMobileOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-button text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavItems current={current} onNavigate={handleNav} pendingCount={pendingCount} />
            <Footer theme={theme} onToggleTheme={onToggleTheme} email={email} onSignOut={onSignOut} onOpenHelp={openHelp} />
          </div>
        </div>
      )}

      {/* Desktop sidebar — pure Tailwind responsive: hidden below lg, flex at lg+ */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-ink-200/70 bg-warm-ivory dark:border-ink-800/70 dark:bg-ink-900 lg:flex">
        <div className="px-5 pb-4 pt-6">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <NavItems current={current} onNavigate={handleNav} pendingCount={pendingCount} />
        </div>
        <div className="px-3 pb-4">
          <Footer theme={theme} onToggleTheme={onToggleTheme} email={email} onSignOut={onSignOut} onOpenHelp={openHelp} />
        </div>
      </aside>
    </>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <BrandMark compact={compact} />;
}

function NavItems({ current, onNavigate, pendingCount = 0 }: NavItemsProps) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = current === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            aria-current={active ? "page" : undefined}
            className={`group relative flex items-center gap-3 rounded-button px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-l-[3px] border-antique-gold bg-ivory-dim text-deep-gold dark:border-antique-gold dark:bg-antique-gold/10 dark:text-antique-gold"
                : "border-l-[3px] border-transparent text-ink-500 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                active
                  ? "bg-warm-ivory shadow-soft dark:bg-ink-900/70"
                  : "bg-transparent"
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] ${
                  active ? "text-deep-gold dark:text-antique-gold" : "text-ink-400 group-hover:text-ink-700 dark:group-hover:text-ink-200"
                }`}
              />
            </span>
            {item.label}
            {item.id === "rewards" && pendingCount > 0 && (
              <span
                className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-obsidian dark:bg-antique-gold dark:text-obsidian px-1 text-[10px] font-bold text-warm-ivory"
                aria-label={`${pendingCount} pending requests`}
              >
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function Footer({
  theme,
  onToggleTheme,
  email,
  onSignOut,
  onOpenHelp,
}: {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  email?: string | null;
  onSignOut?: () => void;
  onOpenHelp?: () => void;
}) {
  return (
    <div className="mt-4 border-t border-ink-200/70 pt-3 dark:border-ink-800/70">
      {onOpenHelp && (
        <button
          onClick={onOpenHelp}
          className="flex w-full items-center gap-3 rounded-button px-3 py-2.5 text-sm font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
        >
          <HelpCircle className="h-[18px] w-[18px]" />
          Help & guide
        </button>
      )}
      <button
        onClick={onToggleTheme}
        className="flex w-full items-center gap-3 rounded-button px-3 py-2.5 text-sm font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
      >
        {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </button>
      {email && (
        <div className="mt-1 rounded-button bg-ink-50 px-3 py-2.5 dark:bg-ink-800/60">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
            Signed in
          </div>
          <div className="mt-0.5 truncate text-xs font-medium text-ink-700 dark:text-ink-200" title={email}>
            {email}
          </div>
        </div>
      )}
      {onSignOut && (
        <button
          onClick={onSignOut}
          className="mt-1 flex w-full items-center gap-3 rounded-button px-3 py-2.5 text-sm font-medium text-ink-500 transition-colors hover:bg-warm-brick/10 hover:text-warm-brick dark:text-ink-400 dark:hover:bg-warm-brick/10 dark:hover:text-brick-light"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sign out
        </button>
      )}
    </div>
  );
}
