import { useEffect, useState } from "react";
import { Check, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { CurrencyColor, CurrencyConfig, CurrencyKind, CurrencySettings } from "@/types";
import {
  CURRENCY_COLORS,
  CURRENCY_ICONS,
  CURRENCY_NAME_MAX,
  CURRENCY_PRESETS,
  validateCurrencyName,
} from "@/lib/currency";
import { CurrencyAmount, CurrencyIcon } from "@/components/CurrencyAmount";

interface Props {
  config: CurrencyConfig;
  onUpdateCurrency: (kind: CurrencyKind, settings: CurrencySettings) => void;
  settingsError: boolean;
  onRetrySettings: () => void;
}

export function SettingsScreen({ config, onUpdateCurrency, settingsError, onRetrySettings }: Props) {
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
            Class currency
          </h2>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            Name your class currencies. Changes apply everywhere instantly.
          </p>
          <div className="mt-4">
            <CurrencyCard key="behavior" kind="behavior" title="Behavior currency" description="Earned from behaviors and spent in the reward shop." config={config} onUpdateCurrency={onUpdateCurrency} />
          </div>
        </section>
      </div>
    </div>
  );
}

function AccountSection() {
  const [email, setEmail] = useState("");
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
