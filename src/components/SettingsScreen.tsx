import { useEffect, useState } from "react";
import { Check, Download, Gem, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { CurrencyColor, CurrencyConfig, CurrencyKind, CurrencySettings } from "@/types";
import type { Store } from "@/lib/useStore";
import { getAvatarCatalog, getNameBgCatalog, getQuizAttempts, updateAvatarPrice, updateNameBgPrice, type CosmeticCatalogRow } from "@/lib/storage";
import { downloadCsv } from "@/lib/csv";
import {
  CURRENCY_COLORS,
  CURRENCY_ICONS,
  CURRENCY_NAME_MAX,
  CURRENCY_PRESETS,
  validateCurrencyName,
} from "@/lib/currency";
import { CurrencyAmount, CurrencyIcon } from "@/components/CurrencyAmount";
import { useCurrency } from "@/components/CurrencyProvider";
import { useToast } from "@/components/Toast";
import { ThemePicker } from "@/components/ThemePicker";
import { Nameplate } from "@/components/Nameplate";
import { Monogram } from "@/components/Monogram";
import type { ColorTheme } from "@/lib/themes";

interface Props {
  config: CurrencyConfig;
  onUpdateCurrency: (kind: CurrencyKind, settings: CurrencySettings) => void;
  settingsError: boolean;
  onRetrySettings: () => void;
  colorTheme: ColorTheme;
  onUpdateColorTheme: (theme: ColorTheme) => void;
  store: Store;
}

export function SettingsScreen({ config, onUpdateCurrency, settingsError, onRetrySettings, colorTheme, onUpdateColorTheme, store }: Props) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-6 sm:px-8 sm:py-8">
        <header>
          <h1 className="text-[28px] font-semibold leading-tight text-ink-900 dark:text-warm-ivory">Settings</h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Customize how your classroom works</p>
        </header>

        {settingsError && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-card border border-antique-gold bg-ivory-dim px-4 py-3 dark:border-antique-gold/30 dark:bg-antique-gold/10">
            <p className="text-sm font-medium text-deep-gold dark:text-antique-gold">
              Couldn't load some settings. Your data is safe — try again.
            </p>
            <button
              onClick={onRetrySettings}
              className="shrink-0 rounded-button bg-deep-gold dark:bg-antique-gold dark:text-obsidian px-3 py-1.5 text-xs font-semibold text-warm-ivory hover:bg-ink-700 dark:hover:bg-deep-gold"
            >
              Retry
            </button>
          </div>
        )}

        <section className="mt-8">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">
            Account
          </h2>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Your teacher login. Changing these never affects class data.
          </p>
          <div className="mt-4">
            <AccountSection />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">
            Appearance
          </h2>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Your console's colour theme. Applies instantly and follows you on any device — it
            never affects what your students see.
          </p>
          <div className="mt-4">
            <ThemePicker current={colorTheme} onSelect={onUpdateColorTheme} />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">
            Premium styles
          </h2>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            The avatar and name styles students buy with gems. Adjust a price and it applies to
            the shop and to what the server charges — no republish needed.
          </p>
          <div className="mt-4">
            <PremiumStylesSection />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">
            Export class data
          </h2>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Download your records as spreadsheets — they open in Excel and Google Sheets.
          </p>
          <div className="mt-4">
            <ExportSection store={store} />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">
            Class goal
          </h2>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            A shared target every student works toward — it shows on their dashboard and grows as
            the class earns {config.behavior.plural.toLowerCase()}.
          </p>
          <div className="mt-4">
            <ClassGoalEditor store={store} />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-400 dark:text-ink-500">
            Class currency
          </h2>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Name your class currencies. Changes apply everywhere instantly.
          </p>
          <div className="mt-4 space-y-4">
            <CurrencyCard
              key="behavior"
              kind="behavior"
              title="Behavior currency"
              description="Earned from behaviors and spent in the reward shop."
              config={config}
              onUpdateCurrency={onUpdateCurrency}
            />
            <CurrencyCard
              key="achievement"
              kind="achievement"
              title="Achievement currency"
              description="Awarded by quizzes only. A separate score — it can't be spent in the shop."
              config={config}
              onUpdateCurrency={onUpdateCurrency}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

/** Teacher editor for the shared class goal; progress derives from the ledger. */
function ClassGoalEditor({ store }: { store: Store }) {
  const { config } = useCurrency();
  const toast = useToast();
  const [draftTarget, setDraftTarget] = useState(store.classGoal.target?.toString() ?? "");
  const [draftLabel, setDraftLabel] = useState(store.classGoal.label ?? "");
  const [saving, setSaving] = useState(false);

  const target = parseInt(draftTarget, 10);
  const validTarget = Number.isFinite(target) && target >= 1;
  const earned = store.transactions.reduce(
    (sum, t) => (t.isUndone || t.amount <= 0 || t.type === "achievement" ? sum : sum + t.amount),
    0,
  );
  const pct = validTarget ? Math.min(100, Math.round((earned / target) * 100)) : 0;
  const reached = validTarget && earned >= target;

  const save = async () => {
    if (draftTarget.trim() === "") {
      // Clearing the goal
      setSaving(true);
      try {
        await store.saveClassGoal({ target: null, label: null });
        toast.show("Class goal cleared", "info");
      } catch {
        toast.show("Could not clear the goal — try again", "negative");
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!validTarget) {
      toast.show("Target must be a positive whole number", "negative");
      return;
    }
    setSaving(true);
    try {
      await store.saveClassGoal({ target, label: draftLabel.trim() || null });
      toast.show("Class goal saved", "positive");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Could not save — try again", "negative");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-card border border-ink-200/70 bg-warm-ivory p-4 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">
            What is the class working toward?
          </label>
          <input
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            placeholder="e.g. Class party, movie afternoon…"
            maxLength={60}
            className="h-10 w-full rounded-button border border-ink-200 bg-warm-ivory px-3 text-sm outline-none transition-colors placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">
            Target ({config.behavior.plural.toLowerCase()} earned)
          </label>
          <input
            inputMode="numeric"
            value={draftTarget}
            onChange={(e) => setDraftTarget(e.target.value.replace(/\D/g, "").slice(0, 7))}
            placeholder="e.g. 500"
            className="h-10 w-full rounded-button border border-ink-200 bg-warm-ivory px-3 font-mono text-sm tabular-nums outline-none transition-colors placeholder:font-sans placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800"
          />
        </div>
      </div>

      {validTarget ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-medium text-ink-500 dark:text-ink-400">
            <span>
              Class has earned{" "}
              <span className="font-mono font-bold tabular-nums text-ink-800 dark:text-ink-100">
                {earned}
              </span>{" "}
              of {target} {target === 1 ? config.behavior.singular.toLowerCase() : config.behavior.plural.toLowerCase()}
            </span>
            <span className={reached ? "font-bold text-deep-gold dark:text-antique-gold" : "font-mono tabular-nums"}>
              {pct}%
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
            <div
              className="h-full rounded-full bg-antique-gold transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-400 dark:text-ink-500">
          No target set — students won't see a class goal until you add one.
        </p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        {store.classGoal.target !== null && (
          <button
            onClick={() => {
              setDraftTarget("");
              setDraftLabel("");
              void save();
            }}
            disabled={saving}
            className="min-h-11 rounded-button px-3 py-2 text-xs font-semibold text-warm-brick transition-colors hover:bg-warm-brick/10 disabled:opacity-50 dark:text-brick-light"
          >
            Clear goal
          </button>
        )}
        <button
          onClick={() => void save()}
          disabled={saving}
          className="min-h-11 rounded-button bg-obsidian px-4 py-2 text-xs font-bold text-warm-ivory transition-colors hover:bg-ink-700 disabled:opacity-60 dark:bg-antique-gold dark:text-obsidian dark:hover:bg-deep-gold"
        >
          {saving ? "Saving…" : "Save class goal"}
        </button>
      </div>
    </div>
  );
}

function ExportSection({ store }: { store: Store }) {  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  /** Students with both currency balances (gems derived from the ledger). */
  const exportStudents = () => {
    const gemsBalance = new Map<string, number>();
    const gemsLifetime = new Map<string, number>();
    for (const t of store.transactions) {
      if (t.isUndone || t.type !== "achievement") continue;
      gemsBalance.set(t.studentId, (gemsBalance.get(t.studentId) ?? 0) + t.amount);
      if (t.amount > 0) gemsLifetime.set(t.studentId, (gemsLifetime.get(t.studentId) ?? 0) + t.amount);
    }
    downloadCsv(`genji-students-${today}.csv`, [
      ["Name", "Username", "Status", "Dollars balance", "Dollars lifetime", "Gems to spend", "Lifetime gems", "Added"],
      ...store.students.map((s) => [
        s.displayName,
        s.username ?? "",
        s.isActive ? "active" : "inactive",
        store.totals[s.id] ?? 0,
        store.lifetime[s.id] ?? 0,
        gemsBalance.get(s.id) ?? 0,
        gemsLifetime.get(s.id) ?? 0,
        new Date(s.createdAt).toLocaleDateString("en-GB"),
      ]),
    ]);
  };

  const exportActivity = () => {
    const nameById = new Map(store.students.map((s) => [s.id, s.displayName]));
    const rows: (string | number)[][] = [
      ["Date", "Student", "Type", "Currency", "Amount", "Reason", "Undone"],
    ];
    for (const t of [...store.transactions].sort((a, b) => b.createdAt - a.createdAt)) {
      rows.push([
        new Date(t.createdAt).toLocaleString("en-GB"),
        nameById.get(t.studentId) ?? "Removed student",
        t.type,
        t.type === "achievement" ? "Gems" : "Dollars",
        t.amount,
        t.reason,
        t.isUndone ? "yes" : "no",
      ]);
    }
    downloadCsv(`genji-activity-${today}.csv`, rows);
  };

  const exportQuizResults = async () => {
    setBusy("quiz");
    setError(null);
    try {
      const nameById = new Map(store.students.map((s) => [s.id, s.displayName]));
      const rows: (string | number)[][] = [["Quiz", "Student", "Status", "Correct", "Total", "Percent", "Gems", "Submitted"]];
      const perQuiz = await Promise.all(
        store.quizzes.map(async (q) => ({
          title: q.title,
          due: q.dueAt,
          attempts: await getQuizAttempts(q.id),
        })),
      );
      for (const q of perQuiz) {
        const missed = q.due < Date.now();
        for (const a of q.attempts) {
          const submitted = a.submittedAt !== null;
          rows.push([
            q.title,
            nameById.get(a.studentId) ?? "Removed student",
            submitted ? "submitted" : "in progress",
            a.correctCount ?? "",
            a.totalCount ?? "",
            submitted && a.totalCount ? Math.round(((a.correctCount ?? 0) / a.totalCount) * 100) + "%" : "",
            a.gemsAwarded ?? (missed ? 0 : ""),
            a.submittedAt ? new Date(a.submittedAt).toLocaleString("en-GB") : "",
          ]);
        }
      }
      downloadCsv(`genji-quiz-results-${today}.csv`, rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't export quiz results.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="grid gap-3 lg:grid-cols-3">
        <ExportCard
          title="Students & balances"
          description="Every student with both currency balances."
          busy={busy === "quiz"}
          onClick={exportStudents}
        />
        <ExportCard
          title="Activity log"
          description="Every award, spend and deduction, newest first."
          busy={busy === "quiz"}
          onClick={exportActivity}
        />
        <ExportCard
          title="Quiz results"
          description="All attempts across every quiz."
          busy={busy === "quiz"}
          onClick={() => void exportQuizResults()}
        />
      </div>
      {error && <p className="mt-3 text-sm text-warm-brick">{error}</p>}
    </div>
  );
}

function ExportCard({
  title,
  description,
  busy,
  onClick,
}: {
  title: string;
  description: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="flex min-h-11 items-start gap-3 rounded-card border border-ink-200/70 bg-warm-ivory p-4 text-left shadow-soft transition-colors hover:border-antique-gold/60 hover:bg-ink-50 disabled:opacity-60 dark:border-ink-800/70 dark:bg-ink-900 dark:hover:bg-ink-800/60"
    >
      <Download className="mt-0.5 h-4 w-4 shrink-0 text-deep-gold dark:text-antique-gold" aria-hidden />
      <span>
        <span className="block text-sm font-semibold text-ink-900 dark:text-warm-ivory">{title}</span>
        <span className="mt-0.5 block text-xs text-ink-500 dark:text-ink-400">{description}</span>
      </span>
    </button>
  );
}

function AccountSection() {  const [email, setEmail] = useState("");
  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => setEmail(data.user?.email ?? ""))
      .catch(() => setEmail(""));
  }, []);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChangeEmailCard currentEmail={email} />
      <ChangePasswordCard />
    </div>
  );
}

function ChangeEmailCard({ currentEmail }: { currentEmail: string }) {
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <div className="rounded-card border border-ink-200/70 bg-warm-ivory p-5 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-ink-900 dark:text-warm-ivory">Email</h3>
            <p className="mt-0.5 truncate text-sm text-ink-500 dark:text-ink-400">{currentEmail}</p>
          </div>
          <button
            onClick={() => {
              setOpen(true);
              setNewEmail("");
              setPassword("");
              setError("");
              setDone(false);
            }}
            className="shrink-0 rounded-button border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  const submit = async () => {
    const mail = newEmail.trim().toLowerCase();
    if (!mail || !password) {
      setError("Enter your new email and current password");
      return;
    }
    setBusy(true);
    setError("");
    try {
      // Re-authenticate first: the change only proceeds with the current password.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password,
      });
      if (signInError) {
        setError("Current password is incorrect");
        setBusy(false);
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ email: mail });
      if (updateError) {
        setError(updateError.message);
      } else {
        setDone(true);
        setOpen(false);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-card border border-ink-200/70 bg-warm-ivory p-5 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
      <h3 className="text-base font-semibold text-ink-900 dark:text-warm-ivory">Change email</h3>
      <div className="mt-4 space-y-3">
        <input
          type="email"
          value={newEmail}
          onChange={(e) => {
            setNewEmail(e.target.value);
            setError("");
          }}
          placeholder="New email"
          className="h-10 w-full rounded-button border border-ink-200 bg-warm-ivory px-3 text-sm outline-none transition-colors placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800 dark:focus:ring-antique-gold/20"
        />
        <PasswordInput
          value={password}
          onChange={(v) => {
            setPassword(v);
            setError("");
          }}
          placeholder="Current password"
        />
        {error && <p className="text-xs text-warm-brick">{error}</p>}
        {done && <p className="text-xs text-deep-gold">Email updated</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="rounded-button px-3 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={busy}
            className="rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-4 py-2 text-sm font-semibold text-warm-ivory hover:bg-ink-700 dark:hover:bg-deep-gold disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordCard() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <div className="rounded-card border border-ink-200/70 bg-warm-ivory p-5 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-ink-900 dark:text-warm-ivory">Password</h3>
            <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">••••••••</p>
          </div>
          <button
            onClick={() => {
              setOpen(true);
              setCurrent("");
              setNext("");
              setConfirm("");
              setError("");
              setDone(false);
            }}
            className="shrink-0 rounded-button border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  const submit = async () => {
    if (next.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data } = await supabase.auth.getUser();
      const currentEmail = data.user?.email ?? "";
      // Verify the current password before allowing the change.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentEmail,
        password: current,
      });
      if (signInError) {
        setError("Current password is incorrect");
        setBusy(false);
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: next });
      if (updateError) {
        setError(updateError.message);
      } else {
        setDone(true);
        setOpen(false);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-card border border-ink-200/70 bg-warm-ivory p-5 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
      <h3 className="text-base font-semibold text-ink-900 dark:text-warm-ivory">Change password</h3>
      <div className="mt-4 space-y-3">
        <PasswordInput
          value={current}
          onChange={(v) => {
            setCurrent(v);
            setError("");
          }}
          placeholder="Current password"
        />
        <PasswordInput
          value={next}
          onChange={(v) => {
            setNext(v);
            setError("");
          }}
          placeholder="New password (8+ characters)"
        />
        <PasswordInput
          value={confirm}
          onChange={(v) => {
            setConfirm(v);
            setError("");
          }}
          placeholder="Repeat new password"
        />
        {error && <p className="text-xs text-warm-brick">{error}</p>}
        {done && <p className="text-xs text-deep-gold">Password updated</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="rounded-button px-3 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={busy}
            className="rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-4 py-2 text-sm font-semibold text-warm-ivory hover:bg-ink-700 dark:hover:bg-deep-gold disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="current-password"
        className="h-10 w-full rounded-button border border-ink-200 bg-warm-ivory pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800 dark:focus:ring-antique-gold/20"
      />
    </div>
  );
}

function CurrencyCard({
  kind,
  title,
  description,
  config,
  onUpdateCurrency,
}: {
  kind: CurrencyKind;
  title: string;
  description: string;
  config: CurrencyConfig;
  onUpdateCurrency: (kind: CurrencyKind, settings: CurrencySettings) => void;
}) {
  const saved = config[kind];
  const [draft, setDraft] = useState<CurrencySettings>(saved);

  const singularError = validateCurrencyName(draft.singular);
  const pluralError = validateCurrencyName(draft.plural);

  const apply = (patch: Partial<CurrencySettings>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (validateCurrencyName(next.singular) === null && validateCurrencyName(next.plural) === null) {
      onUpdateCurrency(kind, { ...next, singular: next.singular.trim(), plural: next.plural.trim() });
    }
  };

  const colors = CURRENCY_COLORS[draft.color];

  return (
    <div className="rounded-card border border-ink-200/70 bg-warm-ivory p-5 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-ink-900 dark:text-warm-ivory">{title}</h3>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-400">{description}</p>
        </div>
        <div className={`flex shrink-0 items-center rounded-full px-3 py-1.5 text-sm font-semibold text-ink-800 dark:text-ink-100 ${colors.soft}`}>
          <CurrencyAmount amount={12} kind={kind} iconClassName="h-4 w-4" />
        </div>
      </div>

      <div className="mt-5">
        <Label>Presets</Label>
        <div className="flex flex-wrap gap-1.5">
          {CURRENCY_PRESETS.map((p) => {
            const active = saved.singular === p.singular && saved.plural === p.plural;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => apply({ singular: p.singular, plural: p.plural, icon: p.icon })}
                className={`flex h-9 items-center gap-1.5 rounded-button border px-2.5 text-xs font-semibold transition-colors ${
                  active
                    ? "border-antique-gold bg-ivory-dim text-deep-gold dark:bg-antique-gold/10 dark:text-antique-gold"
                    : "border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
                }`}
              >
                <CurrencyIcon name={p.icon} className="h-3.5 w-3.5" />
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <NameField
          label="Singular name"
          value={draft.singular}
          error={singularError}
          placeholder="e.g. Star"
          onChange={(v) => apply({ singular: v })}
        />
        <NameField
          label="Plural name"
          value={draft.plural}
          error={pluralError}
          placeholder="e.g. Stars"
          onChange={(v) => apply({ plural: v })}
        />
      </div>

      <div className="mt-5">
        <Label>Icon</Label>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12 lg:grid-cols-6 xl:grid-cols-12">
          {CURRENCY_ICONS.map((name) => {
            const active = draft.icon === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => apply({ icon: name })}
                aria-label={name}
                aria-pressed={active}
                className={`flex h-11 items-center justify-center rounded-button transition-colors ${
                  active
                    ? `${colors.soft} ring-2 ring-antique-gold`
                    : "bg-ink-50 text-ink-500 hover:bg-ink-100 dark:bg-ink-800/60 dark:text-ink-400 dark:hover:bg-ink-800"
                }`}
              >
                <CurrencyIcon name={name} className={`h-5 w-5 ${active ? colors.icon : ""}`} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CURRENCY_COLORS) as CurrencyColor[]).map((color) => {
            const active = draft.color === color;
            return (
              <button
                key={color}
                type="button"
                onClick={() => apply({ color })}
                aria-label={color}
                aria-pressed={active}
                className={`flex h-11 w-11 items-center justify-center rounded-full ring-offset-2 ring-offset-white transition-transform hover:scale-105 dark:ring-offset-ink-900 ${
                  CURRENCY_COLORS[color].swatch
                } ${active ? "ring-2 ring-ink-900 dark:ring-white" : ""}`}
              >
                {active && <Check className="h-5 w-5 text-warm-ivory" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
      {children}
    </div>
  );
}

function NameField({
  label,
  value,
  error,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  error: string | null;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-sm font-medium text-ink-700 dark:text-ink-200">{label}</label>
        <span className={`text-xs tabular-nums ${value.trim().length > CURRENCY_NAME_MAX ? "text-warm-brick" : "text-ink-400"}`}>
          {value.trim().length}/{CURRENCY_NAME_MAX}
        </span>
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-10 w-full rounded-button border bg-warm-ivory px-3 text-sm outline-none transition-colors placeholder:text-ink-400 focus:ring-2 dark:bg-ink-800 ${
          error
            ? "border-warm-brick focus:border-warm-brick focus:ring-warm-brick/20 dark:focus:ring-brick-light/20"
            : "border-ink-200 focus:border-antique-gold focus:ring-antique-gold/20 dark:border-ink-700 dark:focus:ring-antique-gold/20"
        }`}
      />
      {error && <p className="mt-1 text-xs text-warm-brick">{error}</p>}
    </div>
  );
}

/**
 * Teacher price editor for the gem-priced cosmetics (avatar styles and name
 * styles). Reads the server catalogs — the same tables the buy RPCs check —
 * so what's shown here is exactly what the server charges. Saving writes
 * through teacher-only RPCs; the student shop reads prices from these
 * tables at load time, so changes apply without republishing.
 */
export function PremiumStylesSection() {
  const toast = useToast();
  const [avatarRows, setAvatarRows] = useState<CosmeticCatalogRow[] | null>(null);
  const [nameRows, setNameRows] = useState<CosmeticCatalogRow[] | null>(null);
  const [error, setError] = useState(false);
  // Draft prices keyed by catalog id — inputs stay editable while dirty.
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    try {
      const [avatars, names] = await Promise.all([getAvatarCatalog(), getNameBgCatalog()]);
      setAvatarRows(avatars);
      setNameRows(names);
      setDrafts({});
      setError(false);
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (
    kind: "avatar" | "name",
    id: string,
    price: number,
    label: string,
  ) => {
    setSaving(id);
    try {
      if (kind === "avatar") await updateAvatarPrice(id, price);
      else await updateNameBgPrice(id, price);
      // Reflect the new price immediately — the RPC result is authoritative.
      if (kind === "avatar") setAvatarRows((rows) => rows?.map((r) => (r.id === id ? { ...r, price } : r)) ?? rows);
      else setNameRows((rows) => rows?.map((r) => (r.id === id ? { ...r, price } : r)) ?? rows);
      setDrafts((d) => {
        const rest = { ...d };
        delete rest[id];
        return rest;
      });
      toast.show(`${label} price saved`, "positive");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Could not save the price.", "negative");
    } finally {
      setSaving(null);
    }
  };

  if (error) {
    return (
      <div className="rounded-card border border-warm-brick/30 bg-warm-brick/10 px-4 py-3 text-sm text-warm-brick dark:border-brick-light/20 dark:text-brick-light">
        Couldn't load the style catalogs. If you haven't applied the premium-style migrations yet,
        do that first.
      </div>
    );
  }
  if (!avatarRows || !nameRows) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-card bg-ink-100 dark:bg-ink-800/60" />
        ))}
      </div>
    );
  }

  const groups: {
    title: string;
    kind: "avatar" | "name";
    rows: CosmeticCatalogRow[];
    render: (row: CosmeticCatalogRow) => React.ReactNode;
  }[] = [
    {
      title: "Avatar styles",
      kind: "avatar",
      rows: avatarRows,
      render: (row) => (
        <Monogram name="Student" colorIndex={0} avatarId={row.id === "monogram" ? undefined : row.id} size="md" />
      ),
    },
    {
      title: "Name styles",
      kind: "name",
      rows: nameRows,
      // Animated on purpose: the sweeping sheen is the Epic tier's whole
      // selling point, so the preview has to show it moving.
      render: (row) => <Nameplate name="Student" bgId={row.id} animate className="text-sm font-bold" />,
    },
  ];

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.kind}>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-ink-600 dark:text-ink-300">
            <Gem className="h-3.5 w-3.5 text-deep-gold dark:text-antique-gold" aria-hidden />
            {g.title}
          </p>
          <ul className="overflow-hidden rounded-card border border-ink-200/70 dark:border-ink-800/70">
            {g.rows.map((row, idx) => {
              const draft = drafts[row.id];
              const dirty = draft !== undefined && draft !== row.price;
              return (
                <li
                  key={row.id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    idx > 0 ? "border-t border-ink-200/70 dark:border-ink-800/70" : ""
                  }`}
                >
                  <div className="w-12 shrink-0">{g.render(row)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{row.name}</p>
                    <p className="text-[11px] capitalize text-ink-400 dark:text-ink-500">{row.rarity}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Gem className="h-3.5 w-3.5 text-deep-gold dark:text-antique-gold" aria-hidden />
                    <input
                      value={draft ?? row.price}
                      inputMode="numeric"
                      aria-label={`${row.name} price in gems`}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 7);
                        setDrafts((d) => ({ ...d, [row.id]: Number(digits || 0) }));
                      }}
                      className="h-9 w-20 rounded-button border border-ink-200 bg-warm-ivory px-2 text-right font-mono text-sm tabular-nums outline-none focus:border-antique-gold dark:border-ink-700 dark:bg-ink-800"
                    />
                    <button
                      onClick={() => void save(g.kind, row.id, draft ?? row.price, row.name)}
                      disabled={!dirty || saving === row.id}
                      className="min-h-9 rounded-button bg-obsidian px-3 text-xs font-bold text-warm-ivory transition-colors hover:bg-ink-700 disabled:opacity-40 dark:bg-antique-gold dark:text-obsidian"
                    >
                      {saving === row.id ? "Saving…" : "Save"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
