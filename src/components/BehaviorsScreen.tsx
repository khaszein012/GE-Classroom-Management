import { useEffect, useState } from "react";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react";
import type { Store } from "@/lib/useStore";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { useConfirm } from "@/components/ConfirmDialog";
import { Skeleton } from "@/components/Skeleton";
import { useCurrency } from "@/components/CurrencyProvider";
import { CurrencyAmount } from "@/components/CurrencyAmount";

interface Props {
  store: Store;
}

const BEHAVIOR_EMOJIS = [
  "✅", "🤝", "💡", "📝", "🧠", "⭐", "🎯", "🏆",
  "💪", "🙌", "👏", "🎓", "📚", "✨", "🔥", "🌟",
  "😵‍💫", "🚫", "⏰", "❌", "⚠️", "😕", "😴", "💢",
] as const;

export function BehaviorsScreen({ store }: Props) {
  const { behaviors } = store;
  const { config } = useCurrency();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [editing, setEditing] = useState<{ id?: string; label: string; emoji: string; points: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);

  const positive = behaviors.filter((b) => b.points > 0);
  const negative = behaviors.filter((b) => b.points < 0);

  const openAdd = () => setEditing({ label: "", emoji: "⭐", points: "1" });
  const openEdit = (id: string, label: string, emoji: string, points: number) =>
    setEditing({ id, label, emoji, points: String(points) });

  const save = async () => {
    if (!editing) return;
    const label = editing.label.trim();
    const pts = parseInt(editing.points, 10);
    if (!label) return;
    if (Number.isNaN(pts) || pts === 0) return;
    try {
      if (editing.id) {
        await store.updateBehavior(editing.id, { label, emoji: editing.emoji, points: pts });
        toast.show("Behavior updated", "positive");
      } else {
        await store.addBehavior(label, editing.emoji, pts);
        toast.show(`${label} added`, "positive");
      }
      setEditing(null);
    } catch {
      toast.show("Could not save behavior", "negative");
    }
  };

  const remove = (id: string, label: string) => {
    confirm({
      title: `Delete "${label}"?`,
      message: (
        <>
          This behavior will be removed from the picker. <strong>Past transactions that used it will stay in the activity log</strong> — only the quick-tap button is deleted.
        </>
      ),
      confirmLabel: "Delete behavior",
      onConfirm: async () => {
        try {
          await store.deleteBehavior(id);
          toast.show(`"${label}" deleted`, "negative");
        } catch {
          toast.show("Could not delete behavior", "negative");
        }
      },
    });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-semibold leading-tight text-ink-900 dark:text-warm-ivory">Behaviors</h1>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Tap-to-award actions with preset {config.behavior.singular} values</p>
          </div>
          <button
            onClick={openAdd}
            className="flex h-10 items-center gap-2 rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-3 text-sm font-semibold text-warm-ivory transition-colors hover:bg-ink-700 dark:hover:bg-deep-gold"
          >
            <Plus className="h-4 w-4" />
            Add behavior
          </button>
        </header>

        <div className="mt-6">
          {loading || store.loading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <BehaviorColumn
                title="Positive"
                tone="positive"
                items={positive}
                onEdit={(b) => openEdit(b.id, b.label, b.emoji, b.points)}
                onDelete={(b) => remove(b.id, b.label)}
              />
              <BehaviorColumn
                title="Negative"
                tone="negative"
                items={negative}
                onEdit={(b) => openEdit(b.id, b.label, b.emoji, b.points)}
                onDelete={(b) => remove(b.id, b.label)}
              />
            </div>
          )}
        </div>
      </div>

      <Modal
        open={editing !== null}
        title={editing?.id ? "Edit behavior" : "Add behavior"}
        onClose={() => setEditing(null)}
        onConfirm={save}
        confirmLabel={editing?.id ? "Save changes" : "Add behavior"}
      >
        {editing && (
          <BehaviorForm
            value={editing}
            onChange={(patch) => setEditing((prev) => (prev ? { ...prev, ...patch } : prev))}
          />
        )}
      </Modal>

      {dialog}
    </div>
  );
}

function BehaviorColumn({
  title,
  tone,
  items,
  onEdit,
  onDelete,
}: {
  title: string;
  tone: "positive" | "negative";
  items: { id: string; label: string; emoji: string; points: number }[];
  onEdit: (b: { id: string; label: string; emoji: string; points: number }) => void;
  onDelete: (b: { id: string; label: string }) => void;
}) {
  const accent = tone === "positive" ? "bg-deep-gold" : "bg-warm-brick";
  return (
    <section className="rounded-card border border-ink-200/70 bg-warm-ivory p-4 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
      <div className="mb-3 flex items-center gap-2">
        <div className={`h-2.5 w-2.5 rounded-full ${accent}`} />
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-600 dark:text-ink-300">{title}</h2>
        <span className="ml-auto text-xs font-medium text-ink-400 dark:text-ink-500">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-button bg-ink-50 px-3 py-6 text-center text-sm text-ink-400 dark:bg-ink-800/50 dark:text-ink-500">
          No {title.toLowerCase()} behaviors
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((b) => (
            <li
              key={b.id}
              className="flex items-center gap-3 rounded-button border border-ink-100 bg-warm-ivory px-3 py-2.5 transition-colors hover:border-ink-200 dark:border-ink-800 dark:bg-ink-900 dark:hover:border-ink-700"
            >
              <span className="text-xl">{b.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink-900 dark:text-ink-100">{b.label}</div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${
                  tone === "positive"
                    ? "bg-ivory-dim text-deep-gold dark:bg-antique-gold/10 dark:text-antique-gold"
                    : "bg-warm-brick/10 text-warm-brick dark:bg-warm-brick/10 dark:text-brick-light"
                }`}
              >
                <CurrencyAmount amount={b.points} signed iconClassName="h-3.5 w-3.5" />
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => onEdit(b)}
                  className="flex h-9 w-9 items-center justify-center rounded-button text-ink-500 hover:bg-ink-100 hover:text-deep-gold dark:hover:bg-ink-800"
                  aria-label={`Edit ${b.label}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(b)}
                  className="flex h-9 w-9 items-center justify-center rounded-button text-ink-500 hover:bg-warm-brick/10 hover:text-warm-brick dark:hover:bg-warm-brick/10"
                  aria-label={`Delete ${b.label}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BehaviorForm({
  value,
  onChange,
}: {
  value: { label: string; emoji: string; points: string };
  onChange: (patch: { label?: string; emoji?: string; points?: string }) => void;
}) {
  const [labelError, setLabelError] = useState("");
  const [pointsError, setPointsError] = useState("");
  const { config } = useCurrency();
  const currencyPlural = config.behavior.plural;

  useEffect(() => {
    setLabelError(value.label.trim() ? "" : "Label is required");
    const pts = parseInt(value.points, 10);
    setPointsError(Number.isNaN(pts) || pts === 0 ? `${currencyPlural} cannot be zero` : "");
  }, [value.label, value.points, currencyPlural]);

  const adjust = (delta: number) => {
    const current = parseInt(value.points, 10) || 0;
    const next = current + delta;
    if (next === 0) return;
    onChange({ points: String(next) });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">Label</label>
        <input
          autoFocus
          value={value.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="e.g. On task"
          className="h-10 w-full rounded-button border border-ink-200 bg-warm-ivory px-3 text-sm outline-none transition-colors placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800 dark:focus:ring-antique-gold/20"
        />
        {labelError && <p className="mt-1 text-xs text-warm-brick">{labelError}</p>}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">{currencyPlural}</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => adjust(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-button bg-warm-brick/10 text-warm-brick hover:bg-warm-brick/10 dark:bg-warm-brick/10 dark:text-brick-light dark:hover:bg-warm-brick/20"
          >
            <Minus className="h-5 w-5" />
          </button>
          <input
            type="number"
            value={value.points}
            onChange={(e) => onChange({ points: e.target.value })}
            className="h-11 w-24 rounded-button border border-ink-200 bg-warm-ivory px-3 text-center text-lg font-bold outline-none focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800 dark:focus:ring-antique-gold/20"
          />
          <button
            type="button"
            onClick={() => adjust(1)}
            className="flex h-11 w-11 items-center justify-center rounded-button bg-ivory-dim text-deep-gold hover:bg-ivory-dim dark:bg-antique-gold/10 dark:text-antique-gold dark:hover:bg-antique-gold/20"
          >
            <Plus className="h-5 w-5" />
          </button>
          <span className="ml-1 text-xs text-ink-400 dark:text-ink-500">Cannot be zero</span>
        </div>
        {pointsError && <p className="mt-1 text-xs text-warm-brick">{pointsError}</p>}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">Emoji</label>
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-card bg-ink-100 text-2xl dark:bg-ink-800">
          {value.emoji}
        </div>
        <div className="grid grid-cols-8 gap-1.5">
          {BEHAVIOR_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onChange({ emoji })}
              className={`flex h-10 w-10 items-center justify-center rounded-button text-xl transition-colors ${
                value.emoji === emoji
                  ? "bg-ivory-dim ring-2 ring-antique-gold dark:bg-antique-gold/20"
                  : "hover:bg-ink-100 dark:hover:bg-ink-800"
              }`}
              aria-label={`Pick ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
