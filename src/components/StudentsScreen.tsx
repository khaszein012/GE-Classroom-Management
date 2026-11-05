import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, KeyRound, Pencil, Plus, Printer, Shuffle, Trash2, UserPlus } from "lucide-react";
import type { Store } from "@/lib/useStore";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { PinDialog } from "@/components/PinDialog";
import { useConfirm } from "@/components/ConfirmDialog";
import { Skeleton } from "@/components/Skeleton";
import { Monogram } from "@/components/Monogram";
import { Nameplate } from "@/components/Nameplate";
import { nextColorIndex } from "@/lib/avatarColor";
import { ColorPicker } from "@/components/Modal";
import { useCurrency } from "@/components/CurrencyProvider";
import { CurrencyAmount } from "@/components/CurrencyAmount";
import { generatePin, suggestUsername } from "@/lib/pin";
import { levelProgress } from "@/lib/levels";
import { formatDate } from "@/lib/time";
import { SORT_LABELS, loadSortMode, saveSortMode, sortStudents } from "@/lib/sortStudents";
import type { SortMode } from "@/lib/sortStudents";
import type { Student } from "@/types";

interface Props {
  store: Store;
  onPrintCards: () => void;
}

export function StudentsScreen({ store, onPrintCards }: Props) {
  const { students, totals, lifetime } = store;
  const { config } = useCurrency();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [pinReveal, setPinReveal] = useState<{ name: string; pin: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>(() => loadSortMode());

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);

  const openAdd = () =>
    setEditing({ id: undefined, name: "", color: nextColorIndex(students.length), username: "", pin: generatePin() });
  const openEdit = (s: Student) =>
    setEditing({
      id: s.id,
      name: s.displayName,
      color: s.avatarColor,
      username: s.username ?? "",
      pin: "",
      existing: true,
    });

  const save = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) {
      setSaveError("Name is required");
      return;
    }
    const username = editing.username.trim().toLowerCase();
    if (username && !/^[a-z0-9_]{3,20}$/.test(username)) {
      setSaveError("Username: 3–20 letters/numbers, no spaces");
      return;
    }
    setSaveError("");
    try {
      if (editing.id) {
        await store.updateStudent(editing.id, {
          displayName: name,
          avatarColor: editing.color,
          username: username || null,
        });
        toast.show("Student updated", "positive");
      } else {
        await store.addStudent(name, editing.color);
        toast.show(`${name} added`, "positive");
      }
      setEditing(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setSaveError(msg.includes("duplicate") ? "That username is already taken" : msg);
    }
  };

  const saveNewWithPin = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) {
      setSaveError("Name is required");
      return;
    }
    const username = editing.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      setSaveError("Username: 3–20 letters/numbers, no spaces");
      return;
    }
    if (!/^\d{6}$/.test(editing.pin)) {
      setSaveError("PIN must be exactly 6 digits");
      return;
    }
    setSaveError("");
    try {
      await store.addStudentWithPin({
        displayName: name,
        avatarColor: editing.color,
        username,
        pin: editing.pin,
      });
      setEditing(null);
      setPinReveal({ name, pin: editing.pin });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setSaveError(msg.includes("duplicate") ? "That username is already taken" : msg);
    }
  };

  const resetPin = (s: Student) => {
    confirm({
      title: `Reset PIN for ${s.displayName}?`,
      message: "A new 6-digit PIN will be generated and shown once. The old PIN stops working immediately.",
      confirmLabel: "Generate new PIN",
      onConfirm: async () => {
        const pin = generatePin();
        await store.setStudentPin(s.id, pin);
        setPinReveal({ name: s.displayName, pin });
        toast.show("PIN reset", "positive");
      },
    });
  };

  const remove = (id: string, name: string) => {
    confirm({
      title: `Delete ${name}?`,
      message: (
        <>
          This will permanently remove <strong>{name}</strong>, their {config.behavior.plural}, and their entire history. This cannot be undone.
        </>
      ),
      confirmLabel: "Delete student",
      onConfirm: async () => {
        try {
          await store.deleteStudent(id);
          toast.show(`${name} deleted`, "negative");
        } catch {
          toast.show("Could not delete student", "negative");
        }
      },
    });
  };

  const needsPinCount = students.filter((s) => !s.hasPin).length;

  const sortedStudents = useMemo(
    () => sortStudents(students, sortMode, totals, store.transactions),
    [students, sortMode, totals, store.transactions],
  );

  const handleSortChange = (mode: SortMode) => {
    setSortMode(mode);
    saveSortMode(mode);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-semibold leading-tight text-ink-900 dark:text-warm-ivory">Students</h1>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
              {students.length} {students.length === 1 ? "student" : "students"}
              {needsPinCount > 0 && ` · ${needsPinCount} need${needsPinCount === 1 ? "s" : ""} a PIN`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {students.length > 1 && (
              <div className="relative">
                <ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <select
                  value={sortMode}
                  onChange={(e) => handleSortChange(e.target.value as SortMode)}
                  className="h-10 appearance-none rounded-button border border-ink-200 bg-warm-ivory pl-9 pr-8 text-sm font-semibold text-ink-700 outline-none transition-colors hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:bg-ink-800"
                  aria-label="Sort students"
                >
                  {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => (
                    <option key={m} value={m}>{SORT_LABELS[m]}</option>
                  ))}
                </select>
              </div>
            )}
            {students.length > 0 && (
              <button
                onClick={onPrintCards}
                className="flex h-10 items-center gap-2 rounded-button border border-ink-200 bg-warm-ivory px-3 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:bg-ink-800"
              >
                <Printer className="h-4 w-4" />
                Print login cards
              </button>
            )}
            <button
              onClick={openAdd}
              className="flex h-10 items-center gap-2 rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-3 text-sm font-semibold text-warm-ivory transition-colors hover:bg-ink-700 dark:hover:bg-deep-gold"
            >
              <UserPlus className="h-4 w-4" />
              Add student
            </button>
          </div>
        </header>

        <div className="mt-6">
          {loading || store.loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[64px]" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-card border-2 border-dashed border-ink-200 py-16 text-center dark:border-ink-700">
              <Monogram name="?" colorIndex={0} size="xl" />
              <h2 className="mt-3 text-lg font-semibold text-ink-900 dark:text-warm-ivory">No students yet</h2>
              <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Add your class to start tracking {config.behavior.plural}.</p>
              <button
                onClick={openAdd}
                className="mt-4 flex items-center gap-2 rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-4 py-2.5 text-sm font-semibold text-warm-ivory hover:bg-ink-700 dark:hover:bg-deep-gold"
              >
                <Plus className="h-4 w-4" /> Add student
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-card border border-ink-200/70 bg-warm-ivory shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
              <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                {sortedStudents.map((s) => {
                  const total = totals[s.id] ?? 0;
                  const level = levelProgress(lifetime[s.id] ?? 0).level;
                  const pillClass =
                    total > 0
                      ? "bg-ivory-dim text-deep-gold dark:bg-antique-gold/15 dark:text-antique-gold"
                      : total < 0
                        ? "bg-warm-brick/10 text-warm-brick dark:bg-warm-brick/15 dark:text-brick-light"
                        : "bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400";
                  return (
                    <li key={s.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                      <div className="relative shrink-0">
                        <Monogram name={s.displayName} colorIndex={s.avatarColor} avatarId={s.equippedAvatar} size="md" />
                        <span
                          className="pointer-events-none absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-obsidian px-1 font-mono text-[9px] font-bold tabular-nums text-warm-ivory ring-2 ring-warm-ivory dark:bg-antique-gold dark:text-obsidian dark:ring-ink-900"
                          aria-label={`Level ${level}`}
                        >
                          {level}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Nameplate
                            name={s.displayName}
                            bgId={s.equippedNameBg}
                            animate={false}
                            className="max-w-[180px] text-[15px] font-medium"
                            plainClass="text-ink-900 dark:text-ink-100"
                          />
                          <span
                            className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-ink-600 dark:bg-ink-800 dark:text-ink-300"
                            title={`Level ${level} (lifetime earned)`}
                          >
                            LV {level}
                          </span>
                          {!s.hasPin ? (
                            <span className="shrink-0 rounded-full bg-ivory-dim px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-deep-gold dark:bg-antique-gold/15 dark:text-antique-gold">
                              Needs PIN
                            </span>
                          ) : (
                            <span className="shrink-0 rounded-full bg-ivory-dim px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-deep-gold dark:bg-antique-gold/15 dark:text-antique-gold">
                              Has PIN
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-ink-400 dark:text-ink-500">
                          {s.username ? `@${s.username} · ` : ""}Added {formatDate(s.createdAt)}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-bold ${pillClass}`}
                      >
                        <CurrencyAmount amount={total} variant="compact" />
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => resetPin(s)}
                          className="flex h-11 w-11 items-center justify-center rounded-button text-ink-500 transition-colors hover:bg-ink-100 hover:text-deep-gold dark:hover:bg-ink-800"
                          aria-label={`${s.hasPin ? "Reset" : "Set"} PIN for ${s.displayName}`}
                        >
                          <KeyRound className="h-[18px] w-[18px]" />
                        </button>
                        <button
                          onClick={() => openEdit(s)}
                          className="flex h-11 w-11 items-center justify-center rounded-button text-ink-500 transition-colors hover:bg-ink-100 hover:text-deep-gold dark:hover:bg-ink-800"
                          aria-label={`Edit ${s.displayName}`}
                        >
                          <Pencil className="h-[18px] w-[18px]" />
                        </button>
                        <button
                          onClick={() => remove(s.id, s.displayName)}
                          className="flex h-11 w-11 items-center justify-center rounded-button text-ink-500 transition-colors hover:bg-warm-brick/10 hover:text-warm-brick dark:hover:bg-warm-brick/10"
                          aria-label={`Delete ${s.displayName}`}
                        >
                          <Trash2 className="h-[18px] w-[18px]" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={editing !== null}
        title={editing?.id ? "Edit student" : "Add student"}
        onClose={() => setEditing(null)}
        onConfirm={editing?.id ? save : saveNewWithPin}
        confirmLabel={editing?.id ? "Save changes" : "Create student"}
      >
        {editing && (
          <StudentForm
            value={editing}
            students={students}
            onChange={(patch) => setEditing((prev) => (prev ? { ...prev, ...patch } : prev))}
          />
        )}
        {saveError && <p className="mt-3 text-xs text-warm-brick">{saveError}</p>}
      </Modal>

      <PinDialog
        open={pinReveal !== null}
        title="Student PIN created"
        contextLine={pinReveal ? `${pinReveal.name}'s login PIN` : ""}
        pin={pinReveal?.pin ?? ""}
        onClose={() => setPinReveal(null)}
      />

      {dialog}
    </div>
  );
}

interface EditingState {
  id?: string;
  name: string;
  color: number;
  username: string;
  pin: string;
  existing?: boolean;
}

function StudentForm({
  value,
  students,
  onChange,
}: {
  value: EditingState;
  students: Student[];
  onChange: (patch: Partial<EditingState>) => void;
}) {
  const [pinVisible, setPinVisible] = useState(false);

  // Auto-suggest a username from the display name; skip if the user edited it.
  const touchedUsername = useMemo(() => ({ current: false }), []);

  useEffect(() => {
    if (!value.id && !touchedUsername.current) {
      onChange({ username: suggestUsername(value.name) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.name]);

  const usernameError = (() => {
    const u = value.username.trim().toLowerCase();
    if (!u) return null;
    if (!/^[a-z0-9_]{3,20}$/.test(u)) return "3–20 letters/numbers, no spaces";
    if (students.some((s) => s.username === u && s.id !== value.id)) return "Already taken";
    return null;
  })();

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">Display name</label>
        <input
          autoFocus
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Alex Rivera"
          className="h-10 w-full rounded-button border border-ink-200 bg-warm-ivory px-3 text-sm outline-none transition-colors placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800 dark:focus:ring-antique-gold/20"
        />
      </div>
      <ColorPicker value={value.color} onChange={(color) => onChange({ color })} />
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">Username</label>
        <input
          value={value.username}
          onChange={(e) => {
            touchedUsername.current = true;
            onChange({ username: e.target.value.toLowerCase().replace(/\s/g, "") });
          }}
          placeholder="e.g. alexrivera"
          className={`h-10 w-full rounded-button border bg-warm-ivory px-3 text-sm outline-none transition-colors placeholder:text-ink-400 focus:ring-2 dark:bg-ink-800 ${
            usernameError
              ? "border-warm-brick focus:border-warm-brick focus:ring-warm-brick/20 dark:focus:ring-brick-light/20"
              : "border-ink-200 focus:border-antique-gold focus:ring-antique-gold/20 dark:border-ink-700 dark:focus:ring-antique-gold/20"
          }`}
        />
        {usernameError && <p className="mt-1 text-xs text-warm-brick">{usernameError}</p>}
      </div>

      {!value.id && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">6-digit PIN</label>
          <div className="flex items-center gap-2">
            <input
              type={pinVisible ? "text" : "password"}
              inputMode="numeric"
              maxLength={6}
              value={value.pin}
              onChange={(e) => onChange({ pin: e.target.value.replace(/\D/g, "").slice(0, 6) })}
              placeholder="••••••"
              className="h-10 w-32 rounded-button border border-ink-200 bg-warm-ivory px-3 text-center text-lg font-bold tracking-widest tabular-nums outline-none transition-colors focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800 dark:focus:ring-antique-gold/20"
            />
            <button
              type="button"
              onClick={() => onChange({ pin: generatePin() })}
              className="flex h-10 items-center gap-1.5 rounded-button border border-ink-200 bg-warm-ivory px-3 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:bg-ink-800"
            >
              <Shuffle className="h-3.5 w-3.5" />
              Generate
            </button>
            <button
              type="button"
              onClick={() => setPinVisible((v) => !v)}
              className="text-xs font-medium text-deep-gold hover:text-deep-gold dark:text-antique-gold"
            >
              {pinVisible ? "Hide" : "Show"}
            </button>
          </div>
          <p className="mt-1 text-xs text-ink-400 dark:text-ink-500">
            The PIN is shown once after saving, so you can write it down.
          </p>
        </div>
      )}
    </div>
  );
}
