import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive, ArchiveRestore, Minus, PackageX, Pencil, Plus, Store as StoreIcon, Trash2, Upload, X,
} from "lucide-react";
import type { Reward, RewardCurrency } from "@/types";
import type { Store } from "@/lib/useStore";
import * as storage from "@/lib/storage";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { useConfirm } from "@/components/ConfirmDialog";
import { Skeleton } from "@/components/Skeleton";
import { useCurrency } from "@/components/CurrencyProvider";
import { CurrencyAmount, CurrencyIcon } from "@/components/CurrencyAmount";
import { RequestsPanel } from "@/components/RequestsPanel";
import { RewardThumbnail } from "@/components/RewardThumbnail";
import { uploadRewardImage, removeRewardImage } from "@/lib/rewardImage";

interface Props {
  store: Store;
}

export function RewardsScreen({ store }: Props) {
  const { config } = useCurrency();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<{
    id?: string;
    name: string;
    description: string;
    currency: RewardCurrency;
    cost: string;
    unlimited: boolean;
    stock: string;
    imageUrl: string | null;
  } | null>(null);
  // While pending requests exist, the database refuses a currency change;
  // the picker is disabled and explains why instead of failing silently.
  const [currencyLocked, setCurrencyLocked] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rewards: Reward[] = store.rewards;
  const active = useMemo(
    () => rewards.filter((r) => !r.isArchived).sort((a, b) => a.sortOrder - b.sortOrder),
    [rewards],
  );
  const archived = useMemo(
    () => rewards.filter((r) => r.isArchived).sort((a, b) => a.sortOrder - b.sortOrder),
    [rewards],
  );

  const openAdd = () => {
    setCurrencyLocked(false);
    setEditing({ name: "", description: "", currency: "dollars", cost: "10", unlimited: true, stock: "0", imageUrl: null });
  };

  const openEdit = (r: Reward) => {
    setEditing({
      id: r.id,
      name: r.name,
      description: r.description ?? "",
      currency: r.currency,
      cost: String(r.cost),
      unlimited: r.stock === null,
      stock: r.stock === null ? "0" : String(r.stock),
      imageUrl: r.imageUrl,
    });
    setCurrencyLocked(false);
    storage
      .rewardHasPendingRequests(r.id)
      .then(setCurrencyLocked)
      .catch(() => setCurrencyLocked(false));
  };

  const save = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    const cost = parseInt(editing.cost, 10);
    const stock = editing.unlimited ? null : parseInt(editing.stock, 10);
    if (!name) return;
    if (Number.isNaN(cost) || cost < 1) return;
    if (stock !== null && (Number.isNaN(stock) || stock < 0)) return;
    try {
      if (editing.id) {
        await store.updateReward(editing.id, {
          name,
          description: editing.description,
          cost,
          currency: editing.currency,
          stock,
          imageUrl: editing.imageUrl,
        });
        toast.show("Reward updated", "positive");
      } else {
        await store.addReward({
          name,
          description: editing.description,
          cost,
          currency: editing.currency,
          stock,
          imageUrl: editing.imageUrl,
        });
        toast.show(`${name} added to the shop`, "positive");
      }
      setEditing(null);
    } catch (e) {
      // e.g. the DB guard: currency can't change while requests are pending.
      toast.show(e instanceof Error ? e.message : "Could not save the reward", "negative");
    }
  };

  const toggleActive = async (r: Reward) => {
    setBusyId(r.id);
    try {
      await store.updateReward(r.id, { isActive: !r.isActive });
      toast.show(r.isActive ? `${r.name} hidden from the shop` : `${r.name} is back in the shop`, "info");
    } catch {
      toast.show("Could not change availability", "negative");
    } finally {
      setBusyId(null);
    }
  };

  const adjustStock = async (r: Reward, delta: number) => {
    if (r.stock === null) return;
    const next = r.stock + delta;
    if (next < 0) return;
    setBusyId(r.id);
    try {
      await store.setRewardStock(r.id, next);
    } catch {
      toast.show("Could not change stock", "negative");
    } finally {
      setBusyId(null);
    }
  };

  const markSoldOut = async (r: Reward) => {
    setBusyId(r.id);
    try {
      await store.setRewardStock(r.id, 0);
      toast.show(`${r.name} marked sold out`, "info");
    } catch {
      toast.show("Could not update stock", "negative");
    } finally {
      setBusyId(null);
    }
  };

  const archive = (r: Reward) =>
    store.updateReward(r.id, { isArchived: true, isActive: false }).then(
      () => toast.show(`${r.name} archived`, "info"),
      () => toast.show("Could not archive the reward", "negative"),
    );

  const restore = (r: Reward) =>
    store.updateReward(r.id, { isArchived: false, isActive: true }).then(
      () => toast.show(`${r.name} restored`, "positive"),
      () => toast.show("Could not restore the reward", "negative"),
    );

  const remove = (r: Reward) => {
    confirm({
      title: `Delete "${r.name}"?`,
      message: "This permanently removes the reward. This is only possible because it has never been requested.",
      confirmLabel: "Delete reward",
      onConfirm: async () => {
        try {
          if (r.imageUrl) await removeRewardImage(r.imageUrl).catch(() => {});
          await store.deleteReward(r.id);
          toast.show(`"${r.name}" deleted`, "negative");
        } catch {
          toast.show("Could not delete the reward", "negative");
        }
      },
    });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-semibold leading-tight text-ink-900 dark:text-warm-ivory">Rewards</h1>
            <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
              The shop your students spend {config.behavior.plural.toLowerCase()} and{" "}
              {config.achievement.plural.toLowerCase()} in
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex h-10 items-center gap-2 rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-3 text-sm font-semibold text-warm-ivory transition-colors hover:bg-ink-700 dark:hover:bg-deep-gold"
          >
            <Plus className="h-4 w-4" />
            Add reward
          </button>
        </header>

        <RequestsPanel store={store} />

        <section className="mt-6 rounded-card border border-ink-200/70 bg-warm-ivory p-4 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StoreIcon className="h-4 w-4 text-ink-500 dark:text-ink-400" />
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-600 dark:text-ink-300">
                Shop items
              </h2>
              <span className="text-xs font-medium text-ink-400 dark:text-ink-500">{active.length}</span>
            </div>
            {archived.length > 0 && (
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="flex h-8 items-center gap-1.5 rounded-button border border-ink-200 px-2.5 text-xs font-semibold text-ink-600 transition-colors hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
              >
                <Archive className="h-3.5 w-3.5" />
                {showArchived ? "Hide archived" : `Show archived (${archived.length})`}
              </button>
            )}
          </div>

          {store.loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-[64px]" />
              ))}
            </div>
          ) : active.length === 0 && archived.length === 0 ? (
            <p className="rounded-button bg-ink-50 px-3 py-8 text-center text-sm text-ink-400 dark:bg-ink-800/50 dark:text-ink-500">
              No rewards yet. Add your first one so the shop isn't empty.
            </p>
          ) : (
            <ul className="space-y-2">
              {active.map((r, index) => (
                <RewardRowItem
                  key={r.id}
                  reward={r}
                  first={index === 0}
                  last={index === active.length - 1}
                  busy={busyId === r.id}
                  onEdit={() => openEdit(r)}
                  onToggleActive={() => void toggleActive(r)}
                  onAdjustStock={(d) => void adjustStock(r, d)}
                  onSoldOut={() => void markSoldOut(r)}
                  onArchive={() => void archive(r)}
                  onDelete={() => remove(r)}
                  onMove={(dir) => {
                    const target = dir === "up" ? index - 1 : index + 1;
                    if (target < 0 || target >= active.length) return;
                    const next = [...active];
                    [next[index], next[target]] = [next[target], next[index]];
                    void store.reorderRewards(next.map((x) => x.id)).catch(() => toast.show("Could not reorder", "negative"));
                  }}
                />
              ))}
            </ul>
          )}

          {showArchived && archived.length > 0 && (
            <div className="mt-4 border-t border-ink-100 pt-3 dark:border-ink-800">
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-500">
                Archived — hidden from students, history kept
              </h3>
              <ul className="space-y-2">
                {archived.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 rounded-button border border-ink-100 bg-ink-50/50 px-3 py-2.5 dark:border-ink-800 dark:bg-ink-800/30"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <RewardThumbnail imageUrl={r.imageUrl} name={r.name} className="h-8 w-8 shrink-0 rounded-button" />
                        <div className="truncate text-sm font-semibold text-ink-700 dark:text-ink-300">{r.name}</div>
                      </div>
                      <div className="text-xs text-ink-400 dark:text-ink-500">
                        <CurrencyAmount
                          amount={r.cost}
                          kind={r.currency === "gems" ? "achievement" : "behavior"}
                          iconClassName="h-3 w-3"
                        />
                        {r.stock === null ? " · unlimited" : ` · stock ${r.stock}`}
                      </div>
                    </div>
                    <button
                      onClick={() => void restore(r)}
                      className="flex h-9 items-center gap-1.5 rounded-button border border-ink-200 px-3 text-xs font-semibold text-ink-600 transition-colors hover:bg-ink-100 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
                    >
                      <ArchiveRestore className="h-3.5 w-3.5" />
                      Restore
                    </button>
                    <DeleteIfNeverRequestedButton reward={r} onDelete={remove} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={editing !== null}
        title={editing?.id ? "Edit reward" : "Add reward"}
        onClose={() => setEditing(null)}
        onConfirm={() => void save()}
        confirmLabel={editing?.id ? "Save changes" : "Add reward"}
      >
        {editing && (
          <RewardForm
            value={editing}
            currencyLocked={currencyLocked}
            onChange={(patch) => setEditing((prev) => (prev ? { ...prev, ...patch } : prev))}
          />
        )}
      </Modal>

      {dialog}
    </div>
  );
}

function DeleteIfNeverRequestedButton({ reward, onDelete }: { reward: Reward; onDelete: (r: Reward) => void }) {
  const [neverRequested, setNeverRequested] = useState<boolean | null>(null);
  useEffect(() => {
    storage
      .rewardHasRedemptions(reward.id)
      .then((has) => setNeverRequested(!has))
      .catch(() => setNeverRequested(false));
  }, [reward.id]);
  if (neverRequested === null) return <span className="h-9 w-9 shrink-0" aria-hidden />;
  return (
    <button
      onClick={() => onDelete(reward)}
      disabled={!neverRequested}
      title={neverRequested ? `Delete ${reward.name}` : "Cannot be deleted — it has been requested. Archive instead."}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-button text-ink-400 hover:bg-warm-brick/10 hover:text-warm-brick disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-warm-brick/10"
      aria-label={`Delete ${reward.name}`}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function RewardRowItem({
  reward: r,
  first,
  last,
  busy,
  onEdit,
  onToggleActive,
  onAdjustStock,
  onSoldOut,
  onArchive,
  onDelete,
  onMove,
}: {
  reward: Reward;
  first: boolean;
  last: boolean;
  busy: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onAdjustStock: (delta: number) => void;
  onSoldOut: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const lowStock = r.stock !== null && r.stock <= 2;
  const soldOut = r.stock === 0;
  return (
    <li
      className={`flex items-center gap-2 rounded-button border bg-warm-ivory px-3 py-2.5 transition-colors disabled:opacity-60 dark:bg-ink-900 ${
        soldOut || !r.isActive
          ? "border-ink-100 dark:border-ink-800/60"
          : "border-ink-200 hover:border-ink-300 dark:border-ink-800/70 dark:hover:border-ink-700"
      } ${soldOut ? "opacity-60" : ""} ${busy ? "opacity-50" : ""}`}
    >
      <div className="flex shrink-0 flex-col gap-0.5">
        <button
          onClick={() => onMove("up")}
          disabled={first}
          className="flex h-7 w-11 items-center justify-center rounded text-ink-300 hover:bg-ink-100 hover:text-ink-600 disabled:opacity-30 dark:text-ink-600 dark:hover:bg-ink-800"
          aria-label={`Move ${r.name} up`}
        >
          <span className="text-[10px] font-bold leading-none">▲</span>
        </button>
        <button
          onClick={() => onMove("down")}
          disabled={last}
          className="flex h-7 w-11 items-center justify-center rounded text-ink-300 hover:bg-ink-100 hover:text-ink-600 disabled:opacity-30 dark:text-ink-600 dark:hover:bg-ink-800"
          aria-label={`Move ${r.name} down`}
        >
          <span className="text-[10px] font-bold leading-none">▼</span>
        </button>
      </div>

      <div className={`min-w-0 flex-1 ${soldOut ? "opacity-80" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          <RewardThumbnail imageUrl={r.imageUrl} name={r.name} className="h-9 w-9 shrink-0 rounded-button" />
          <span className="truncate text-sm font-semibold text-ink-900 dark:text-ink-100">{r.name}</span>
          {!r.isActive && (
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-500 dark:bg-ink-800 dark:text-ink-400">
              Inactive
            </span>
          )}
          {soldOut && (
            <span className="rounded-full bg-warm-brick/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warm-brick dark:bg-warm-brick/15 dark:text-brick-light">
              Sold out
            </span>
          )}
          {lowStock && !soldOut && (
            <span className="rounded-full bg-ivory-dim px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-deep-gold dark:bg-antique-gold/15 dark:text-antique-gold">
              Low stock
            </span>
          )}
        </div>
        {r.description && (
          <p className="truncate text-xs text-ink-500 dark:text-ink-400">{r.description}</p>
        )}
      </div>

      <span className="shrink-0 rounded-full bg-ivory-dim px-2.5 py-1 text-xs font-bold text-deep-gold dark:bg-antique-gold/15 dark:text-antique-gold">
        <CurrencyAmount
          amount={r.cost}
          kind={r.currency === "gems" ? "achievement" : "behavior"}
          iconClassName="h-3.5 w-3.5"
        />
      </span>

      <div className="flex shrink-0 items-center gap-1">
        {r.stock === null ? (
          <span className="px-1.5 text-xs font-medium text-ink-400 dark:text-ink-500">Unlimited</span>
        ) : (
          <>
            <button
              onClick={() => onAdjustStock(-1)}
              disabled={r.stock === 0 || busy}
              className="flex h-9 w-9 items-center justify-center rounded-button bg-ink-100 text-ink-600 hover:bg-ink-200 disabled:opacity-40 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"
              aria-label={`Decrease stock of ${r.name}`}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-[2rem] text-center text-sm font-bold tabular-nums text-ink-800 dark:text-ink-100">
              {r.stock}
            </span>
            <button
              onClick={() => onAdjustStock(1)}
              disabled={busy}
              className="flex h-9 w-9 items-center justify-center rounded-button bg-ink-100 text-ink-600 hover:bg-ink-200 disabled:opacity-40 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"
              aria-label={`Increase stock of ${r.name}`}
            >
              <Plus className="h-4 w-4" />
            </button>
            {r.stock > 0 && (
              <button
                onClick={onSoldOut}
                disabled={busy}
                title="Mark sold out"
                className="flex h-9 w-9 items-center justify-center rounded-button text-ink-400 hover:bg-warm-brick/10 hover:text-warm-brick disabled:opacity-40 dark:hover:bg-warm-brick/10"
                aria-label={`Mark ${r.name} sold out`}
              >
                <PackageX className="h-4 w-4" />
              </button>
            )}
          </>
        )}
        <button
          onClick={onToggleActive}
          disabled={busy}
          role="switch"
          aria-checked={r.isActive}
          aria-label={r.isActive ? `Hide ${r.name} from the shop` : `Show ${r.name} in the shop`}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            r.isActive ? "bg-deep-gold" : "bg-ink-300 dark:bg-ink-700"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-warm-ivory shadow transition-all ${
              r.isActive ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
        <button
          onClick={onEdit}
          className="flex h-9 w-9 items-center justify-center rounded-button text-ink-500 hover:bg-ink-100 hover:text-deep-gold dark:hover:bg-ink-800"
          aria-label={`Edit ${r.name}`}
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={onArchive}
          className="flex h-9 w-9 items-center justify-center rounded-button text-ink-500 hover:bg-ink-100 hover:text-deep-gold dark:hover:bg-ink-800"
          aria-label={`Archive ${r.name}`}
        >
          <Archive className="h-4 w-4" />
        </button>
        <DeleteIfNeverRequestedButton reward={r} onDelete={onDelete} />
      </div>
    </li>
  );
}

function RewardForm({
  value,
  currencyLocked,
  onChange,
}: {
  value: { id?: string; name: string; description: string; currency: RewardCurrency; cost: string; unlimited: boolean; stock: string; imageUrl: string | null };
  currencyLocked: boolean;
  onChange: (patch: { name?: string; description?: string; currency?: RewardCurrency; cost?: string; unlimited?: boolean; stock?: string; imageUrl?: string | null }) => void;
}) {
  const { config } = useCurrency();
  const [nameError, setNameError] = useState("");
  const [costError, setCostError] = useState("");
  const [stockError, setStockError] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tempIdRef = useRef<string>("");

  if (!tempIdRef.current) tempIdRef.current = `temp-${Date.now()}`;

  const priceCurrency = value.currency === "gems" ? config.achievement : config.behavior;
  const priceName = (n: number) => (n === 1 ? priceCurrency.singular.toLowerCase() : priceCurrency.plural.toLowerCase());

  const validate = () => {
    setNameError(value.name.trim() ? "" : "Name is required");
    const cost = parseInt(value.cost, 10);
    setCostError(Number.isNaN(cost) || cost < 1 ? `Must cost at least 1 ${priceName(1)}` : "");
    if (!value.unlimited) {
      const stock = parseInt(value.stock, 10);
      setStockError(Number.isNaN(stock) || stock < 0 ? "Stock cannot be negative" : "");
    } else {
      setStockError("");
    }
  };

  const handleImageFile = async (file: File) => {
    setImageError("");
    setImageBusy(true);
    try {
      const id = value.id ?? tempIdRef.current;
      const url = await uploadRewardImage(id, file);
      onChange({ imageUrl: url });
    } catch (e) {
      setImageError(e instanceof Error ? e.message : "Could not upload image");
    } finally {
      setImageBusy(false);
    }
  };

  const handleRemoveImage = async () => {
    if (value.imageUrl) {
      await removeRewardImage(value.imageUrl).catch(() => {});
    }
    onChange({ imageUrl: null });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">Name</label>
        <input
          autoFocus
          value={value.name}
          onChange={(e) => onChange({ name: e.target.value })}
          onBlur={validate}
          placeholder="e.g. Homework pass"
          maxLength={80}
          className="h-10 w-full rounded-button border border-ink-200 bg-warm-ivory px-3 text-sm outline-none transition-colors placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800 dark:focus:ring-antique-gold/20"
        />
        {nameError && <p className="mt-1 text-xs text-warm-brick">{nameError}</p>}
      </div>

      {/* Image upload */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">
          Image <span className="font-normal text-ink-400">(optional · JPG, PNG, WebP · 2 MB max)</span>
        </label>
        {value.imageUrl ? (
          <div className="flex items-center gap-3">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-button border border-ink-200 dark:border-ink-700">
              <RewardThumbnail imageUrl={value.imageUrl} name={value.name} className="h-full w-full" />
            </div>
            <button
              type="button"
              onClick={() => void handleRemoveImage()}
              className="flex h-9 items-center gap-1.5 rounded-button border border-ink-200 px-3 text-xs font-semibold text-warm-brick transition-colors hover:bg-warm-brick/10 dark:border-ink-700 dark:hover:bg-warm-brick/10"
            >
              <X className="h-3.5 w-3.5" />
              Remove image
            </button>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) void handleImageFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-button border-2 border-dashed px-4 py-6 text-center transition-colors ${
              dragOver
                ? "border-antique-gold bg-ivory-dim/40 dark:bg-antique-gold/10"
                : "border-ink-200 hover:border-antique-gold hover:bg-ink-50 dark:border-ink-700 dark:hover:border-antique-gold/40 dark:hover:bg-ink-800/50"
            }`}
          >
            {imageBusy ? (
              <span className="text-sm text-ink-500">Uploading…</span>
            ) : (
              <>
                <Upload className="h-5 w-5 text-ink-400" />
                <span className="text-sm font-medium text-ink-600 dark:text-ink-300">Click or drop an image</span>
              </>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImageFile(file);
            e.target.value = "";
          }}
        />
        {imageError && <p className="mt-1 text-xs text-warm-brick">{imageError}</p>}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">
          Description <span className="font-normal text-ink-400">(optional)</span>
        </label>
        <input
          value={value.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What the student gets"
          className="h-10 w-full rounded-button border border-ink-200 bg-warm-ivory px-3 text-sm outline-none transition-colors placeholder:text-ink-400 focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800 dark:focus:ring-antique-gold/20"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">
          Currency
        </label>
        <div
          className="flex rounded-button border border-ink-200 bg-warm-ivory p-1 dark:border-ink-700 dark:bg-ink-800"
          role="group"
          aria-label="Reward currency"
        >
          {(["dollars", "gems"] as RewardCurrency[]).map((c) => {
            const settings = c === "gems" ? config.achievement : config.behavior;
            const selected = value.currency === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => onChange({ currency: c })}
                disabled={currencyLocked}
                aria-pressed={selected}
                className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-button px-3 text-xs font-semibold transition-colors disabled:opacity-50 ${
                  selected
                    ? "bg-obsidian text-warm-ivory dark:bg-antique-gold dark:text-obsidian"
                    : "text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200"
                }`}
              >
                <CurrencyIcon name={settings.icon} className="h-4 w-4" aria-hidden />
                {settings.plural}
              </button>
            );
          })}
        </div>
        {currencyLocked && (
          <p className="mt-1.5 text-xs text-warm-brick dark:text-brick-light">
            Students have pending requests for this reward, so its currency is locked until
            they're decided.
          </p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">Cost</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={value.cost}
            onChange={(e) => onChange({ cost: e.target.value })}
            onBlur={validate}
            className="h-11 w-28 rounded-button border border-ink-200 bg-warm-ivory px-3 text-center font-mono text-lg font-bold tabular-nums outline-none focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800 dark:focus:ring-antique-gold/20"
          />
          <span className="flex items-center gap-1 text-sm text-ink-500 dark:text-ink-400">
            <CurrencyIcon name={priceCurrency.icon} className="h-4 w-4" aria-hidden />
            {priceCurrency.plural}
          </span>
        </div>
        {costError && <p className="mt-1 text-xs text-warm-brick">{costError}</p>}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-200">Stock</label>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={value.unlimited}
              onChange={(e) => onChange({ unlimited: e.target.checked })}
              className="h-4 w-4 accent-antique-gold"
            />
            <span className="text-sm text-ink-600 dark:text-ink-300">Unlimited</span>
          </label>
          {!value.unlimited && (
            <input
              type="number"
              min={0}
              value={value.stock}
              onChange={(e) => onChange({ stock: e.target.value })}
              onBlur={validate}
              className="h-10 w-28 rounded-button border border-ink-200 bg-warm-ivory px-3 text-center text-sm font-bold outline-none focus:border-antique-gold focus:ring-2 focus:ring-antique-gold/20 dark:border-ink-700 dark:bg-ink-800 dark:focus:ring-antique-gold/20"
            />
          )}
        </div>
        {stockError && <p className="mt-1 text-xs text-warm-brick">{stockError}</p>}
      </div>
    </div>
  );
}