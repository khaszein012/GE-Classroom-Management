import { useMemo, useState } from "react";
import {
  ArrowRight,
  ClipboardList,
  PartyPopper,
  Store as StoreIcon,
  Users,
  Zap,
} from "lucide-react";
import type { Store } from "@/lib/useStore";
import * as storage from "@/lib/storage";
import { AVATAR_PALETTE } from "@/lib/avatarColor";
import { Monogram } from "@/components/Monogram";
import { useCurrency } from "@/components/CurrencyProvider";
import { ONBOARDING_FLAG as FLAG } from "@/lib/prefs";

/**
 * First-run wizard for a brand-new teacher (shows only when the class has
 * zero students and hasn't been dismissed). Three steps: welcome, bulk-add
 * students, done — with pointers to what to explore next.
 */
export function OnboardingWizard({
  store,
  onDone,
  onGoTo,
}: {
  store: Store;
  onDone: () => void;
  onGoTo: (screen: "behaviors" | "rewards" | "quizzes") => void;
}) {
  const { config } = useCurrency();
  const [step, setStep] = useState(0);
  const [names, setNames] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(
    () =>
      names
        .split("\n")
        .map((n) => n.trim())
        .filter((n) => n.length > 0)
        .slice(0, 60),
    [names],
  );

  const finish = () => {
    try {
      localStorage.setItem(FLAG, "1");
    } catch {
      /* ignore */
    }
    onDone();
  };

  const addStudents = async () => {
    if (parsed.length === 0) {
      setError("Type at least one student name.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await storage.insertStudentsRaw(store.activeClassId, 
        parsed.map((name, i) => ({
          display_name: name.slice(0, 60),
          avatar_emoji: "",
          avatar_color: i % AVATAR_PALETTE.length,
        })),
      );
      await store.refresh(store.activeClassId);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the students.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4 backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Genji Educator"
    >
      <div className="w-full max-w-lg animate-fade-scale-in overflow-hidden rounded-card bg-warm-ivory shadow-soft-lg dark:bg-ink-900">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4 dark:border-ink-800">
          <div className="flex items-center gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-1.5 w-6 rounded-full transition-colors ${
                  i === step ? "bg-antique-gold" : "bg-ink-200 dark:bg-ink-700"
                }`}
              />
            ))}
          </div>
          <button
            onClick={finish}
            className="min-h-11 rounded-button px-3 text-sm font-semibold text-ink-500 transition-colors hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800"
          >
            Skip
          </button>
        </div>

        {step === 0 && (
          <div className="px-6 py-7 text-center sm:px-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-ivory-dim dark:bg-antique-gold/10">
              <PartyPopper className="h-7 w-7 text-deep-gold dark:text-antique-gold" aria-hidden />
            </div>
            <h2 className="mt-4 font-display text-3xl font-semibold text-ink-900 dark:text-warm-ivory">
              Welcome to Genji Educator
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
              Three minutes of setup and your classroom economy is running:
            </p>
            <ul className="mx-auto mt-4 max-w-sm space-y-2.5 text-left">
              <WizardPoint
                icon={<Zap className="h-4 w-4" />}
                title={`Award ${config.behavior.plural.toLowerCase()}`}
                body={`Tap a behaviour and students earn ${config.behavior.plural.toLowerCase()} instantly.`}
              />
              <WizardPoint
                icon={<StoreIcon className="h-4 w-4" />}
                title="Run the shop"
                body="Students spend their earnings on rewards you set — you approve."
              />
              <WizardPoint
                icon={<ClipboardList className="h-4 w-4" />}
                title={`Quiz for ${config.achievement.plural.toLowerCase()}`}
                body={`Build quizzes that pay ${config.achievement.plural.toLowerCase()} — a separate score for the shop's gem shelf.`}
              />
            </ul>
            <button
              onClick={() => setStep(1)}
              className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-button bg-obsidian px-4 py-2.5 text-sm font-bold text-warm-ivory transition-colors hover:bg-ink-700 dark:bg-antique-gold dark:text-obsidian dark:hover:bg-deep-gold"
            >
              Set up my class
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="px-6 py-7 sm:px-10">
            <h2 className="font-display text-2xl font-semibold text-ink-900 dark:text-warm-ivory">
              Add your students
            </h2>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
              One name per line. You can add more later, along with usernames and PINs.
            </p>
            <textarea
              autoFocus
              value={names}
              onChange={(e) => {
                setNames(e.target.value);
                setError(null);
              }}
              rows={7}
              placeholder={"Ava Rahman\nLiam Chen\nSofia Park"}
              className="mt-3 w-full resize-y rounded-button border border-ink-200 bg-warm-ivory px-3 py-2.5 font-mono text-sm outline-none transition-colors placeholder:font-sans placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs font-medium text-ink-400 dark:text-ink-500">
                {parsed.length} {parsed.length === 1 ? "student" : "students"} ready
              </span>
              {parsed.length > 0 && (
                <span className="flex -space-x-1.5" aria-hidden>
                  {parsed.slice(0, 6).map((n, i) => (
                    <Monogram key={i} name={n} colorIndex={i % AVATAR_PALETTE.length} size="xs" ring="ring-1 ring-warm-ivory dark:ring-ink-900" />
                  ))}
                </span>
              )}
            </div>
            {error && <p className="mt-2 text-xs text-warm-brick">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setStep(0)}
                className="min-h-11 rounded-button px-4 py-2.5 text-sm font-semibold text-ink-600 transition-colors hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
              >
                Back
              </button>
              <button
                onClick={() => void addStudents()}
                disabled={adding || parsed.length === 0}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-button bg-obsidian px-4 py-2.5 text-sm font-bold text-warm-ivory transition-colors hover:bg-ink-700 disabled:opacity-50 dark:bg-antique-gold dark:text-obsidian dark:hover:bg-deep-gold"
              >
                <Users className="h-4 w-4" aria-hidden />
                {adding ? "Adding…" : `Add ${parsed.length || ""} ${parsed.length === 1 ? "student" : "students"}`.trim()}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="px-6 py-7 text-center sm:px-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-ivory-dim dark:bg-antique-gold/10">
              <PartyPopper className="h-7 w-7 text-deep-gold dark:text-antique-gold" aria-hidden />
            </div>
            <h2 className="mt-4 font-display text-2xl font-semibold text-ink-900 dark:text-warm-ivory">
              Your class is ready
            </h2>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
              {store.students.length} {store.students.length === 1 ? "student" : "students"} added. Here's where to go next:
            </p>
            <div className="mt-4 space-y-2 text-left">
              <NextStep
                icon={<Zap className="h-4 w-4" />}
                title="Add behaviours"
                body={`Define what earns (or costs) ${config.behavior.plural.toLowerCase()}.`}
                onClick={() => {
                  finish();
                  onGoTo("behaviors");
                }}
              />
              <NextStep
                icon={<StoreIcon className="h-4 w-4" />}
                title="Stock the shop"
                body="Add rewards priced in Dollars — and later, in Gems."
                onClick={() => {
                  finish();
                  onGoTo("rewards");
                }}
              />
              <NextStep
                icon={<ClipboardList className="h-4 w-4" />}
                title={`Build your first quiz`}
                body={`One attempt, ${config.achievement.plural.toLowerCase()} for the score.`}
                onClick={() => {
                  finish();
                  onGoTo("quizzes");
                }}
              />
            </div>
            <button
              onClick={finish}
              className="mt-5 min-h-11 w-full rounded-button border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-600 transition-colors hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
            >
              Go to the dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function WizardPoint({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-card border border-ink-100 bg-ink-50/60 p-3 dark:border-ink-800 dark:bg-ink-800/40">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ivory-dim text-deep-gold dark:bg-antique-gold/10 dark:text-antique-gold">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-semibold text-ink-900 dark:text-warm-ivory">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-500 dark:text-ink-400">{body}</span>
      </span>
    </li>
  );
}

function NextStep({
  icon,
  title,
  body,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-11 w-full items-start gap-3 rounded-card border border-ink-200/70 bg-warm-ivory p-3 text-left transition-colors hover:border-antique-gold/60 hover:bg-ink-50 dark:border-ink-800/70 dark:bg-ink-900 dark:hover:bg-ink-800/60"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ivory-dim text-deep-gold dark:bg-antique-gold/10 dark:text-antique-gold">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink-900 dark:text-warm-ivory">{title}</span>
        <span className="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">{body}</span>
      </span>
      <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-ink-400" aria-hidden />
    </button>
  );
}
