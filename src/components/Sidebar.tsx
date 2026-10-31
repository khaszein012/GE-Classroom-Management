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
  classes: { id: number; name: string; emoji: string }[];
  activeClassId: number;
  onSwitchClass: (id: number) => void;
  onCreateClass: (name: string, emoji: string) => void;
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

export function Sidebar({ current, onNavigate, theme, onToggleTheme, email, onSignOut, pendingCount = 0, onOpenHelp, classes, activeClassId, onSwitchClass, onCreateClass }: Props) {
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
            <ClassSwitcher
              classes={classes}
              activeClassId={activeClassId}
              onSwitchClass={onSwitchClass}
              onCreateClass={onCreateClass}
            />
            <div className="my-2 border-t border-ink-200/70 dark:border-ink-800/70" />
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
          <ClassSwitcher
            classes={classes}
            activeClassId={activeClassId}
            onSwitchClass={onSwitchClass}
            onCreateClass={onCreateClass}
          />
          <div className="my-2 border-t border-ink-200/70 dark:border-ink-800/70" />
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

function ClassSwitcher({
  classes,
  activeClassId,
  onSwitchClass,
  onCreateClass,
}: {
  classes: { id: number; name: string; emoji: string }[];
  activeClassId: number;
  onSwitchClass: (id: number) => void;
  onCreateClass: (name: string, emoji: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🎓");
  const EMOJIS = ["🎓", "📚", "🎨", "🧪", "🎵", "⚽", "🌟", "🚀", "🧩", "🍎"];

  const create = () => {
    if (!name.trim()) return;
    onCreateClass(name.trim(), emoji);
    setName("");
    setEmoji("🎓");
    setCreating(false);
  };

  return (
    <div className="px-2">
      <p className="px-1 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">
        All classes
      </p>
      <div className="max-h-44 space-y-0.5 overflow-y-auto">
        {classes.map((c) => {
          const active = c.id === activeClassId;
          return (
            <button
              key={c.id}
              onClick={() => onSwitchClass(c.id)}
              aria-pressed={active}
              className={`flex min-h-10 w-full items-center gap-2 rounded-button px-2 py-1.5 text-left text-sm transition-colors ${
                active
                  ? "bg-ivory-dim font-semibold text-deep-gold dark:bg-antique-gold/10 dark:text-antique-gold"
                  : "text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
              }`}
            >
              <span className="text-base" aria-hidden>{c.emoji}</span>
              <span className="min-w-0 flex-1 truncate">{c.name}</span>
              {active && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-antique-gold" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
      {creating ? (
        <div className="mt-1 rounded-button border border-ink-200 p-2 dark:border-ink-700">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Class name…"
            maxLength={60}
            className="h-9 w-full rounded-button border border-ink-200 bg-warm-ivory px-2 text-sm outline-none focus:border-antique-gold dark:border-ink-700 dark:bg-ink-800"
            aria-label="New class name"
          />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                aria-pressed={emoji === e}
                aria-label={`Icon ${e}`}
                className={`flex h-8 w-8 items-center justify-center rounded-button text-base transition-colors ${
                  emoji === e ? "bg-ivory-dim ring-1 ring-antique-gold dark:bg-ink-800" : "hover:bg-ink-100 dark:hover:bg-ink-800"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="mt-2 flex justify-end gap-1.5">
            <button
              onClick={() => setCreating(false)}
              className="min-h-9 rounded-button px-2 text-xs font-semibold text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800"
            >
              Cancel
            </button>
            <button
              onClick={create}
              disabled={!name.trim()}
              className="min-h-9 rounded-button bg-obsidian px-3 text-xs font-bold text-warm-ivory disabled:opacity-50 dark:bg-antique-gold dark:text-obsidian"
            >
              Create
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="mt-1 flex min-h-9 w-full items-center gap-2 rounded-button px-2 text-xs font-semibold text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-button border border-dashed border-ink-300 text-sm leading-none dark:border-ink-600" aria-hidden>
            +
          </span>
          New class
        </button>
      )}
    </div>
  );
}
