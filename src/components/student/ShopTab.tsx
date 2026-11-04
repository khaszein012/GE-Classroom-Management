import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Gem, LayoutGrid, List, Sparkles, Store, Tag, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import * as storage from "@/lib/storage";
import type { Reward, RewardCurrency, CurrencySettings } from "@/types";
import { relativeTime } from "@/lib/time";
import { CurrencyIcon } from "@/components/CurrencyAmount";
import { RewardThumbnail } from "@/components/RewardThumbnail";
import { Monogram } from "@/components/Monogram";
import { RARITY_LABEL, type AvatarDef } from "@/lib/avatars";
import { NAME_BG_RARITY_LABEL, type NameBgDef } from "@/lib/nameBackgrounds";

export interface MyRedemption {
  id: string;
  rewardId: string;
  rewardName: string;
  costAtRequest: number;
  currency: RewardCurrency;
  status: "pending" | "approved" | "declined" | "cancelled";
  requestedAt: number;
  decidedAt: number | null;
  note: string | null;
}

type ShopFilter = "all" | "dollars" | "gems";
type ShopView = "grid" | "list";

const SHOP_VIEW_KEY = "cr_shop_view";

function loadShopView(): ShopView {
  try {
    return localStorage.getItem(SHOP_VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

/**
 * The student's Shop tab. Two sealed economies side by side: rewards priced
 * in Dollars (behaviour money) and rewards priced in Gems (quiz money).
 * Affordability always compares against the matching balance — never across
 * currencies — and there is no conversion between the two.
 */
export function ShopTab({
  balance,
  currency,
  gemsBalance,
  gemsCurrency,
  studentName,
  ownedAvatars,
  equippedAvatar,
  ownedNameBgs,
  equippedNameBg,
  avatarStyles,
  nameStyles,
  onAvatarsChanged,
  onQuietNote,
}: {
  balance: number;
  currency: CurrencySettings;
  gemsBalance: number;
  gemsCurrency: CurrencySettings;
  /** For rendering avatar previews with the student's own initials. */
  studentName: string;
  ownedAvatars: string[];
  equippedAvatar: string;
  ownedNameBgs: string[];
  equippedNameBg: string;
  /** Server-priced catalogs merged with local visuals — DB wins on price. */
  avatarStyles: AvatarDef[];
  nameStyles: NameBgDef[];
  /** Called after a successful purchase so the parent can refresh the wardrobe. */
  onAvatarsChanged: () => void;
  onQuietNote: (message: string) => void;
}) {
  const [rewards, setRewards] = useState<Reward[] | null>(null);
  const [redemptions, setRedemptions] = useState<MyRedemption[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<ShopFilter>("all");
  const [view, setView] = useState<ShopView>(loadShopView);
  const [confirming, setConfirming] = useState<Reward | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const decidedIdsRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const [r, rd] = await Promise.all([storage.getShopRewards(), storage.getMyRedemptions()]);
      const mine: MyRedemption[] = rd.map((row) => ({
        id: row.id,
        rewardId: row.reward_id,
        rewardName: row.rewards?.name ?? "Reward",
        costAtRequest: row.cost_at_request,
        currency: row.currency ?? "dollars",
        status: row.status,
        requestedAt: new Date(row.requested_at).getTime(),
        decidedAt: row.decided_at ? new Date(row.decided_at).getTime() : null,
        note: row.note,
      }));
      const mapped: Reward[] = r.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        cost: row.cost,
        currency: row.currency ?? "dollars",
        stock: row.stock,
        isActive: row.is_active,
        isArchived: row.is_archived,
        sortOrder: row.sort_order,
        createdAt: new Date(row.created_at).getTime(),
        imageUrl: row.image_url ?? null,
      }));
      setRewards(mapped);
      setRedemptions(mine);
      setError(false);
      return mine;
    } catch {
      setError(true);
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void load().then((mine) => {
      if (mine) for (const m of mine) if (m.status !== "pending") decidedIdsRef.current.add(m.id);
    });

    const channel = supabase
      .channel("student-shop")
      .on("postgres_changes", { event: "*", schema: "public", table: "redemptions" }, () => {
        void load().then((mine) => {
          if (!mine || !alive) return;
          for (const m of mine) {
            if (m.status === "pending" || decidedIdsRef.current.has(m.id)) continue;
            decidedIdsRef.current.add(m.id);
            if (m.status === "approved") onQuietNote(`Request approved: ${m.rewardName}`);
            else if (m.status === "declined") onQuietNote(`Request declined: ${m.rewardName}`);
          }
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rewards" }, () => void load())
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [load, onQuietNote]);

  const pendingByReward = useMemo(() => {
    const m = new Map<string, MyRedemption>();
    for (const r of redemptions ?? []) if (r.status === "pending") m.set(r.rewardId, r);
    return m;
  }, [redemptions]);

  const request = async (reward: Reward) => {
    setBusy(reward.id);
    setRequestError(null);
    try {
      await storage.requestReward(reward.id);
      const mine = await load();
      if (mine) {
        for (const m of mine) if (m.status !== "pending") decidedIdsRef.current.add(m.id);
      }
      setConfirming(null);
      onQuietNote(`Request sent: ${reward.name}`);
    } catch (e) {
      setRequestError(e instanceof Error ? e.message : "Could not send the request. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (id: string) => {
    setBusy(id);
    try {
      await storage.cancelMyRedemption(id);
      await load();
      onQuietNote("Request cancelled");
    } catch {
      setRequestError("Could not cancel the request. Try again.");
    } finally {
      setBusy(null);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-sm font-medium text-warm-brick">Couldn't load the shop.</p>
        <button
          onClick={() => void load()}
          className="rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-4 py-2 text-sm font-semibold text-warm-ivory hover:bg-ink-700 dark:hover:bg-deep-gold"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!rewards) return <ShopSkeleton />;

  const settingsFor = (c: RewardCurrency) => (c === "gems" ? gemsCurrency : currency);
  const balanceFor = (c: RewardCurrency) => (c === "gems" ? gemsBalance : balance);

  const setViewPersisted = (v: ShopView) => {
    setView(v);
    try {
      localStorage.setItem(SHOP_VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };

  const list = rewards;
  const history = redemptions ?? [];
  const dollarRewards = list.filter((r) => r.currency !== "gems");
  const gemRewards = list.filter((r) => r.currency === "gems");
  const visible =
    filter === "dollars" ? dollarRewards : filter === "gems" ? gemRewards : list;

  return (
    <div className="flex flex-col gap-6">
      {requestError && (
        <div className="rounded-card border border-warm-brick/30 bg-warm-brick/10 px-4 py-3 text-sm text-warm-brick dark:border-brick-light/20 dark:bg-warm-brick/10 dark:text-brick-light">
          {requestError}
        </div>
      )}

      {/* Your two balances, labelled — never combined */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-ink-200/70 bg-warm-ivory px-4 py-3 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
            <CurrencyIcon name={currency.icon} className="h-3.5 w-3.5" aria-hidden />
            {currency.plural} to spend
          </p>
          <p className="mt-0.5 font-mono text-2xl font-bold tabular-nums text-ink-900 dark:text-warm-ivory">
            {balance}
          </p>
          <p className="text-[11px] text-ink-400 dark:text-ink-500">earned from behaviours</p>
        </div>
        <div className="rounded-card border border-ink-200/70 bg-warm-ivory px-4 py-3 shadow-soft dark:border-ink-800/70 dark:bg-ink-900">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
            <CurrencyIcon name={gemsCurrency.icon} className="h-3.5 w-3.5" aria-hidden />
            {gemsCurrency.plural} to spend
          </p>
          <p className="mt-0.5 font-mono text-2xl font-bold tabular-nums text-ink-900 dark:text-warm-ivory">
            {gemsBalance}
          </p>
          <p className="text-[11px] text-ink-400 dark:text-ink-500">earned from quizzes</p>
        </div>
      </div>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Store className="h-4 w-4 text-ink-500 dark:text-ink-400" />
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-600 dark:text-ink-300">Shop</h2>
          <div
            className="flex rounded-button border border-ink-200 bg-warm-ivory p-0.5 dark:border-ink-700 dark:bg-ink-900"
            role="group"
            aria-label="Filter shop by currency"
          >
            {(["all", "dollars", "gems"] as ShopFilter[]).map((f) => {
              const label =
                f === "all" ? "All" : f === "dollars" ? currency.plural : gemsCurrency.plural;
              const selected = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  aria-pressed={selected}
                  className={`flex min-h-11 items-center gap-1.5 rounded-button px-3 text-xs font-semibold transition-colors ${
                    selected
                      ? "bg-obsidian text-warm-ivory dark:bg-antique-gold dark:text-obsidian"
                      : "text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200"
                  }`}
                >
                  {f === "gems" && <Gem className="h-3.5 w-3.5" aria-hidden />}
                  {f === "dollars" && (
                    <CurrencyIcon name={currency.icon} className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {label}
                </button>
              );
            })}
          </div>
          <span className="ml-auto text-xs font-medium text-ink-400 dark:text-ink-500">
            {visible.length} {visible.length === 1 ? "reward" : "rewards"}
          </span>
          <div
            className="flex rounded-button border border-ink-200 bg-warm-ivory p-0.5 dark:border-ink-700 dark:bg-ink-900"
            role="group"
            aria-label="Shop view"
          >
            <button
              onClick={() => setViewPersisted("grid")}
              aria-pressed={view === "grid"}
              aria-label="Grid view"
              title="Grid view"
              className={`flex h-11 w-11 items-center justify-center rounded-button transition-colors ${
                view === "grid"
                  ? "bg-obsidian text-warm-ivory dark:bg-antique-gold dark:text-obsidian"
                  : "text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200"
              }`}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
            </button>
            <button
              onClick={() => setViewPersisted("list")}
              aria-pressed={view === "list"}
              aria-label="List view"
              title="List view"
              className={`flex h-11 w-11 items-center justify-center rounded-button transition-colors ${
                view === "list"
                  ? "bg-obsidian text-warm-ivory dark:bg-antique-gold dark:text-obsidian"
                  : "text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200"
              }`}
            >
              <List className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        {filter === "gems" && gemRewards.length === 0 ? (
          <div className="rounded-card border-2 border-dashed border-ink-200 px-4 py-8 text-center dark:border-ink-700">
            <Gem className="mx-auto h-6 w-6 text-deep-gold dark:text-antique-gold" aria-hidden />
            <p className="mt-2 text-sm font-semibold text-ink-800 dark:text-ink-100">
              No {gemsCurrency.plural.toLowerCase()} rewards yet
            </p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-ink-500 dark:text-ink-400">
              {gemsCurrency.plural} come from quizzes. When your teacher adds{" "}
              {gemsCurrency.singular.toLowerCase()}-priced rewards, they'll appear here for you to
              spend them on.
            </p>
          </div>
        ) : filter === "all" ? (
          <div className="space-y-5">
            {dollarRewards.length > 0 && (
              <RewardGroup
                title={`Buy with ${currency.plural}`}
                icon={<CurrencyIcon name={currency.icon} className="h-3.5 w-3.5" aria-hidden />}
                rewards={dollarRewards}
                view={view}
                pendingByReward={pendingByReward}
                balanceFor={balanceFor}
                settingsFor={settingsFor}
                onRequest={setConfirming}
              />
            )}
            {gemRewards.length > 0 && (
              <RewardGroup
                title={`Buy with ${gemsCurrency.plural}`}
                icon={<Gem className="h-3.5 w-3.5" aria-hidden />}
                rewards={gemRewards}
                view={view}
                pendingByReward={pendingByReward}
                balanceFor={balanceFor}
                settingsFor={settingsFor}
                onRequest={setConfirming}
              />
            )}
          </div>
        ) : (
          <RewardGrid
            rewards={visible}
            view={view}
            pendingByReward={pendingByReward}
            balanceFor={balanceFor}
            settingsFor={settingsFor}
            onRequest={setConfirming}
          />
        )}
      </section>

      <AvatarStoreSection
        studentName={studentName}
        owned={ownedAvatars}
        equippedId={equippedAvatar}
        gemsBalance={gemsBalance}
        gemsLabel={gemsCurrency.plural}
        avatarStyles={avatarStyles}
        onChanged={onAvatarsChanged}
        onQuietNote={onQuietNote}
      />

      <NameStyleStoreSection
        studentName={studentName}
        owned={ownedNameBgs}
        equippedId={equippedNameBg}
        gemsBalance={gemsBalance}
        gemsLabel={gemsCurrency.plural}
        nameStyles={nameStyles}
        onChanged={onAvatarsChanged}
        onQuietNote={onQuietNote}
      />

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-ink-500 dark:text-ink-400" />
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-600 dark:text-ink-300">My requests</h2>
        </div>
        {history.length === 0 ? (
          <p className="rounded-button bg-ink-50 px-3 py-6 text-center text-sm text-ink-400 dark:bg-ink-800/50 dark:text-ink-500">
            No requests yet. When you request a reward, it appears here.
          </p>
        ) : (
          <ul className="space-y-2">
            {history.map((r) => {
              const reward = list.find((rw) => rw.id === r.rewardId);
              return (
                <MyRequestRow
                  key={r.id}
                  r={r}
                  imageUrl={reward?.imageUrl ?? null}
                  settings={settingsFor(r.currency)}
                  busy={busy === r.id}
                  onCancel={() => void cancel(r.id)}
                />
              );
            })}
          </ul>
        )}
      </section>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/40 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setConfirming(null)}
        >
          <div
            className="w-full max-w-sm animate-fade-scale-in rounded-t-card bg-warm-ivory p-6 shadow-soft-lg dark:bg-ink-900 sm:rounded-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-ink-900 dark:text-warm-ivory">Request "{confirming.name}"?</h3>
            {(() => {
              const settings = settingsFor(confirming.currency);
              const bal = balanceFor(confirming.currency);
              const name = confirming.cost === 1 ? settings.singular : settings.plural;
              return (
                <>
                  <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
                    It costs{" "}
                    <strong className="font-mono tabular-nums">{confirming.cost}</strong> {name}. Nothing is
                    deducted now — your teacher decides.
                  </p>
                  <div className="mt-3 rounded-button bg-ink-50 px-3 py-2.5 text-sm dark:bg-ink-800/60">
                    <div className="flex items-center justify-between text-ink-600 dark:text-ink-300">
                      <span className="flex items-center gap-1.5">
                        <CurrencyIcon name={settings.icon} className="h-3.5 w-3.5" aria-hidden />
                        {name} after approval
                      </span>
                      <span className="font-mono font-bold tabular-nums">
                        {Math.max(0, bal - confirming.cost)}
                      </span>
                    </div>
                  </div>
                </>
              );
            })()}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirming(null)}
                className="rounded-button px-4 py-2.5 text-sm font-semibold text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
              >
                Back
              </button>
              <button
                onClick={() => void request(confirming)}
                disabled={busy !== null}
                className="rounded-button bg-obsidian dark:bg-antique-gold dark:text-obsidian px-4 py-2.5 text-sm font-semibold text-warm-ivory hover:bg-ink-700 dark:hover:bg-deep-gold disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RewardGroup({
  title,
  icon,
  rewards,
  view,
  pendingByReward,
  balanceFor,
  settingsFor,
  onRequest,
}: {
  title: string;
  icon: React.ReactNode;
  rewards: Reward[];
  view: ShopView;
  pendingByReward: Map<string, MyRedemption>;
  balanceFor: (c: RewardCurrency) => number;
  settingsFor: (c: RewardCurrency) => CurrencySettings;
  onRequest: (r: Reward) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
        {icon}
        {title}
      </h3>
      <RewardGrid
        rewards={rewards}
        view={view}
        pendingByReward={pendingByReward}
        balanceFor={balanceFor}
        settingsFor={settingsFor}
        onRequest={onRequest}
      />
    </div>
  );
}

function RewardGrid({
  rewards,
  view,
  pendingByReward,
  balanceFor,
  settingsFor,
  onRequest,
}: {
  rewards: Reward[];
  view: ShopView;
  pendingByReward: Map<string, MyRedemption>;
  balanceFor: (c: RewardCurrency) => number;
  settingsFor: (c: RewardCurrency) => CurrencySettings;
  onRequest: (r: Reward) => void;
}) {
  if (view === "list") {
    return (
      <ul className="space-y-2">
        {rewards.map((r) => (
          <RewardRow
            key={r.id}
            reward={r}
            pendingByReward={pendingByReward}
            balanceFor={balanceFor}
            settingsFor={settingsFor}
            onRequest={onRequest}
          />
        ))}
      </ul>
    );
  }
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {rewards.map((r) => (
        <RewardCard
          key={r.id}
          reward={r}
          pendingByReward={pendingByReward}
          balanceFor={balanceFor}
          settingsFor={settingsFor}
          onRequest={onRequest}
        />
      ))}
    </ul>
  );
}

function rewardButtonState(
  r: Reward,
  pendingByReward: Map<string, MyRedemption>,
  balanceFor: (c: RewardCurrency) => number,
  settings: CurrencySettings,
) {
  const pending = pendingByReward.get(r.id);
  const soldOut = r.stock === 0;
  const need = r.cost - balanceFor(r.currency);
  const disabled = soldOut || need > 0 || !!pending;
  const unit = (n: number) => (n === 1 ? settings.singular.toLowerCase() : settings.plural.toLowerCase());
  let label = "Request";
  if (pending) label = "Requested";
  else if (soldOut) label = "Sold out";
  else if (need > 0) label = `Need ${need} more ${unit(need)}`;
  return { pending, soldOut, need, disabled, label };
}

/** Grid card: the visual view. Image is 16:9 so the shelf stays scannable. */
function RewardCard({
  reward: r,
  pendingByReward,
  balanceFor,
  settingsFor,
  onRequest,
}: {
  reward: Reward;
  pendingByReward: Map<string, MyRedemption>;
  balanceFor: (c: RewardCurrency) => number;
  settingsFor: (c: RewardCurrency) => CurrencySettings;
  onRequest: (r: Reward) => void;
}) {
  const settings = settingsFor(r.currency);
  const { soldOut, disabled, label } = rewardButtonState(r, pendingByReward, balanceFor, settings);
  return (
    <li
      className={`hover-lift flex flex-col rounded-card border bg-warm-ivory p-4 shadow-soft transition-colors dark:bg-ink-900 ${
        soldOut
          ? "border-ink-100 opacity-60 dark:border-ink-800/60"
          : "border-ink-200/70 dark:border-ink-800/70"
      }`}
    >
      <div className="-mx-4 -mt-4 mb-3">
        <RewardThumbnail
          imageUrl={r.imageUrl}
          name={r.name}
          className="aspect-[16/9] w-full"
        />
      </div>
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-sm font-semibold text-ink-900 dark:text-ink-100">
          <span className="break-words">{r.name}</span>
        </h3>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-ivory-dim px-2.5 py-1 text-xs font-bold text-deep-gold dark:bg-antique-gold/15 dark:text-antique-gold">
          <CurrencyIcon name={settings.icon} className="h-3.5 w-3.5" aria-hidden />
          <span className="font-mono tabular-nums">{r.cost}</span>
          <span>{r.cost === 1 ? settings.singular : settings.plural}</span>
        </span>
      </div>
      {r.description && (
        <p className="mt-1 line-clamp-2 text-xs text-ink-500 dark:text-ink-400">{r.description}</p>
      )}
      <div className="mt-2 text-xs font-medium text-ink-400 dark:text-ink-500">
        {r.stock === null ? "In stock" : soldOut ? "Sold out" : `${r.stock} left`}
      </div>
      <button
        onClick={() => onRequest(r)}
        disabled={disabled}
        aria-label={
          disabled
            ? `${r.name} — ${label}`
            : `Request ${r.name} for ${r.cost} ${r.cost === 1 ? settings.singular : settings.plural}`
        }
        className={`mt-3 flex h-11 w-full items-center justify-center rounded-button px-2 text-center text-xs font-semibold transition-colors ${
          disabled
            ? "cursor-not-allowed bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500"
            : "bg-obsidian dark:bg-antique-gold dark:text-obsidian text-warm-ivory hover:bg-ink-700 dark:hover:bg-deep-gold"
        }`}
      >
        {label}
      </button>
    </li>
  );
}

/** List row: the compact view — one line per reward, scannable shelf. */
function RewardRow({
  reward: r,
  pendingByReward,
  balanceFor,
  settingsFor,
  onRequest,
}: {
  reward: Reward;
  pendingByReward: Map<string, MyRedemption>;
  balanceFor: (c: RewardCurrency) => number;
  settingsFor: (c: RewardCurrency) => CurrencySettings;
  onRequest: (r: Reward) => void;
}) {
  const settings = settingsFor(r.currency);
  const { soldOut, disabled, label } = rewardButtonState(r, pendingByReward, balanceFor, settings);
  return (
    <li
      className={`hover-lift flex items-center gap-3 rounded-card border bg-warm-ivory p-3 shadow-soft transition-colors dark:bg-ink-900 ${
        soldOut
          ? "border-ink-100 opacity-60 dark:border-ink-800/60"
          : "border-ink-200/70 dark:border-ink-800/70"
      }`}
    >
      <RewardThumbnail
        imageUrl={r.imageUrl}
        name={r.name}
        className="h-14 w-14 shrink-0 rounded-button"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
            <span className="break-words">{r.name}</span>
          </h3>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-ivory-dim px-2 py-0.5 text-[11px] font-bold text-deep-gold dark:bg-antique-gold/15 dark:text-antique-gold">
            <CurrencyIcon name={settings.icon} className="h-3 w-3" aria-hidden />
            <span className="font-mono tabular-nums">{r.cost}</span>
          </span>
          <span className="text-[11px] font-medium text-ink-400 dark:text-ink-500">
            {r.stock === null ? "In stock" : soldOut ? "Sold out" : `${r.stock} left`}
          </span>
        </div>
        {r.description && (
          <p className="mt-0.5 truncate text-xs text-ink-500 dark:text-ink-400">{r.description}</p>
        )}
      </div>
      <button
        onClick={() => onRequest(r)}
        disabled={disabled}
        aria-label={
          disabled
            ? `${r.name} — ${label}`
            : `Request ${r.name} for ${r.cost} ${r.cost === 1 ? settings.singular : settings.plural}`
        }
        className={`flex h-11 min-w-[88px] shrink-0 items-center justify-center gap-1.5 rounded-button px-3 text-center text-xs font-semibold transition-colors ${
          disabled
            ? "cursor-not-allowed bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500"
            : "bg-obsidian dark:bg-antique-gold dark:text-obsidian text-warm-ivory hover:bg-ink-700 dark:hover:bg-deep-gold"
        }`}
      >
        {label}
      </button>
    </li>
  );
}

function MyRequestRow({
  r,
  imageUrl,
  settings,
  busy,
  onCancel,
}: {
  r: MyRedemption;
  imageUrl: string | null;
  settings: CurrencySettings;
  busy: boolean;
  onCancel: () => void;
}) {
  const pending = r.status === "pending";
  return (
    <li
      className={`flex items-center gap-3 rounded-button border bg-warm-ivory px-3 py-2.5 dark:bg-ink-900 ${
        pending
          ? "border-antique-gold/30 dark:border-antique-gold/30"
          : "border-ink-100 dark:border-ink-800/60"
      } ${busy ? "opacity-50" : ""}`}
    >
      <RewardThumbnail imageUrl={imageUrl} name={r.rewardName} className="h-10 w-10 shrink-0 rounded-button" />
      <StatusBadge status={r.status} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink-900 dark:text-ink-100">{r.rewardName}</div>
        <div className="flex items-center gap-1 truncate text-xs text-ink-500 dark:text-ink-400">
          <CurrencyIcon name={settings.icon} className="h-3 w-3 shrink-0" aria-hidden />
          <span className="font-mono tabular-nums">{r.costAtRequest}</span>
          <span className="truncate">· {relativeTime(r.requestedAt)}</span>
          {r.note && <> · {r.note}</>}
        </div>
      </div>
      {pending && (
        <button
          onClick={onCancel}
          disabled={busy}
          className="flex h-9 shrink-0 items-center gap-1 rounded-button border border-ink-200 px-2.5 text-xs font-semibold text-ink-600 transition-colors hover:bg-warm-brick/10 hover:text-warm-brick disabled:opacity-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-warm-brick/10"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
      )}
    </li>
  );
}

function StatusBadge({ status }: { status: MyRedemption["status"] }) {
  const cfg: Record<MyRedemption["status"], { label: string; cls: string }> = {
    pending: {
      label: "Pending",
      cls: "bg-ivory-dim text-deep-gold dark:bg-antique-gold/15 dark:text-antique-gold",
    },
    approved: {
      label: "Approved",
      cls: "bg-ivory-dim text-deep-gold dark:bg-antique-gold/15 dark:text-antique-gold",
    },
    declined: {
      label: "Declined",
      cls: "bg-warm-brick/10 text-warm-brick dark:bg-warm-brick/15 dark:text-brick-light",
    },
    cancelled: {
      label: "Cancelled",
      cls: "bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400",
    },
  };
  const c = cfg[status];
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${c.cls}`}>
      {c.label}
    </span>
  );
}

function ShopSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-card bg-ink-100 dark:bg-ink-800/60" />
      ))}
    </div>
  );
}

/**
 * Premium avatar styles, priced in Gems. Buying is instant (no teacher
 * approval — the server validates price, balance and ownership atomically),
 * and a purchase equips immediately so the student sees the result.
 */
function AvatarStoreSection({
  studentName,
  owned,
  equippedId,
  gemsBalance,
  gemsLabel,
  avatarStyles,
  onChanged,
  onQuietNote,
}: {
  studentName: string;
  owned: string[];
  equippedId: string;
  gemsBalance: number;
  gemsLabel: string;
  /** Server-priced catalog merged with local visuals. */
  avatarStyles: AvatarDef[];
  onChanged: () => void;
  onQuietNote: (message: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<AvatarDef | null>(null);
  const ownedSet = new Set(owned);
  const items = avatarStyles.filter((a) => a.price > 0);

  const buy = async (avatar: AvatarDef) => {
    setBusy(avatar.id);
    setError(null);
    try {
      const { gems_remaining } = await storage.buyAvatar(avatar.id);
      await storage.equipAvatar(avatar.id);
      onChanged();
      onQuietNote(`${avatar.name} is yours — equipped!`);
      setConfirming(null);
      void gems_remaining;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not buy that avatar. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-deep-gold dark:text-antique-gold" aria-hidden />
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-600 dark:text-ink-300">
          Avatar styles
        </h2>
        <span className="rounded-full bg-ivory-dim px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-deep-gold dark:bg-antique-gold/15 dark:text-antique-gold">
          Gems only
        </span>
      </div>
      {error && (
        <p className="mb-3 rounded-card border border-warm-brick/30 bg-warm-brick/10 px-3 py-2 text-sm text-warm-brick dark:border-brick-light/20 dark:text-brick-light">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((a) => {
          const isOwned = ownedSet.has(a.id);
          const equipped = equippedId === a.id;
          const affordable = gemsBalance >= a.price;
          return (
            <div
              key={a.id}
              className={`flex flex-col items-center gap-2 rounded-card border p-3 ${
                equipped
                  ? "border-antique-gold/60 bg-antique-gold/10"
                  : "border-ink-200/70 bg-warm-ivory shadow-soft dark:border-ink-800/70 dark:bg-ink-900"
              }`}
            >
              <Monogram
                name={studentName}
                colorIndex={0}
                avatarId={a.id}
                size="lg"
                className={isOwned ? "" : "opacity-90"}
              />
              <p className="w-full truncate text-center text-xs font-semibold text-ink-700 dark:text-ink-200">
                {a.name}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-400 dark:text-ink-500">
                {RARITY_LABEL[a.rarity]}
              </p>
              {equipped ? (
                <span className="w-full rounded-button bg-ivory-dim py-1.5 text-center text-xs font-bold text-deep-gold dark:bg-antique-gold/15 dark:text-antique-gold">
                  Equipped
                </span>
              ) : isOwned ? (
                <span className="w-full rounded-button bg-ink-100 py-1.5 text-center text-xs font-semibold text-ink-500 dark:bg-ink-800 dark:text-ink-400">
                  Owned — equip in your avatar
                </span>
              ) : (
                <button
                  onClick={() => setConfirming(a)}
                  disabled={busy === a.id}
                  className={`flex w-full items-center justify-center gap-1 rounded-button py-1.5 text-xs font-bold transition-colors ${
                    affordable
                      ? "bg-antique-gold text-obsidian hover:bg-deep-gold"
                      : "bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500"
                  } disabled:opacity-60`}
                >
                  <Gem className="h-3 w-3" aria-hidden />
                  {a.price}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/40 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setConfirming(null)}
        >
          <div
            className="w-full max-w-sm animate-fade-scale-in rounded-t-card bg-warm-ivory p-6 shadow-soft-lg dark:bg-ink-900 sm:rounded-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-ink-900 dark:text-warm-ivory">
              Buy "{confirming.name}"?
            </h3>
            <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
              It costs{" "}
              <span className="font-mono font-bold tabular-nums">{confirming.price}</span>{" "}
              {gemsLabel.toLowerCase()} ·{" "}
              {gemsBalance - confirming.price} after · yours forever, equip anytime
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirming(null)}
                className="min-h-11 rounded-button px-4 text-sm font-semibold text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800"
              >
                Cancel
              </button>
              <button
                onClick={() => void buy(confirming)}
                disabled={busy === confirming.id || gemsBalance < confirming.price}
                className="min-h-11 rounded-button bg-antique-gold px-4 text-sm font-bold text-obsidian transition-colors hover:bg-deep-gold disabled:opacity-60"
              >
                {busy === confirming.id ? "Buying…" : "Buy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Premium name styles — the nameplate behind the student's name on their
 * dashboard. Gem-priced with an escalating ladder (10 → 25 → 50 → 80).
 * Instant buy + auto-equip, same server-validated flow as avatar styles.
 */
function NameStyleStoreSection({
  studentName,
  owned,
  equippedId,
  gemsBalance,
  gemsLabel,
  nameStyles,
  onChanged,
  onQuietNote,
}: {
  studentName: string;
  owned: string[];
  equippedId: string;
  gemsBalance: number;
  gemsLabel: string;
  /** Server-priced catalog merged with local visuals. */
  nameStyles: NameBgDef[];
  onChanged: () => void;
  onQuietNote: (message: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<NameBgDef | null>(null);
  const ownedSet = new Set(owned);
  const items = nameStyles.filter((b) => b.price > 0);

  const buy = async (item: NameBgDef) => {
    setBusy(item.id);
    setError(null);
    try {
      await storage.buyNameBackground(item.id);
      await storage.equipNameBackground(item.id);
      onChanged();
      onQuietNote(`${item.name} name style is yours — equipped!`);
      setConfirming(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not buy that name style. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Tag className="h-4 w-4 text-deep-gold dark:text-antique-gold" aria-hidden />
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-600 dark:text-ink-300">
          Name styles
        </h2>
        <span className="rounded-full bg-ivory-dim px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-deep-gold dark:bg-antique-gold/15 dark:text-antique-gold">
          Gems only
        </span>
      </div>
      {error && (
        <p className="mb-3 rounded-card border border-warm-brick/30 bg-warm-brick/10 px-3 py-2 text-sm text-warm-brick dark:border-brick-light/20 dark:text-brick-light">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((b) => {
          const isOwned = ownedSet.has(b.id);
          const equipped = equippedId === b.id;
          const affordable = gemsBalance >= b.price;
          return (
            <div
              key={b.id}
              className={`flex items-center justify-between gap-3 rounded-card border px-4 py-3 ${
                equipped
                  ? "border-antique-gold/60 bg-antique-gold/10"
                  : "border-ink-200/70 bg-warm-ivory shadow-soft dark:border-ink-800/70 dark:bg-ink-900"
              }`}
            >
              <div className="min-w-0">
                {/* Real nameplate preview */}
                {b.plate ? (
                  <span className={`relative inline-block max-w-[180px] truncate rounded-full px-3 py-0.5 text-sm font-bold ${b.plate} ${b.text}`}>
                    {b.flourish && (
                      <span aria-hidden className={`absolute inset-0 overflow-hidden rounded-full ${b.flourish}`} />
                    )}
                    <span className="relative">{studentName}</span>
                  </span>
                ) : (
                  <span className="text-sm font-bold text-ink-900 dark:text-warm-ivory">{studentName}</span>
                )}
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-ink-400 dark:text-ink-500">
                  {NAME_BG_RARITY_LABEL[b.rarity]}
                </p>
              </div>
              {equipped ? (
                <span className="shrink-0 rounded-button bg-ivory-dim px-3 py-1.5 text-xs font-bold text-deep-gold dark:bg-antique-gold/15 dark:text-antique-gold">
                  Equipped
                </span>
              ) : isOwned ? (
                <span className="shrink-0 rounded-button bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-500 dark:bg-ink-800 dark:text-ink-400">
                  Owned
                </span>
              ) : (
                <button
                  onClick={() => setConfirming(b)}
                  disabled={busy === b.id}
                  className={`flex shrink-0 items-center gap-1 rounded-button px-3 py-1.5 text-xs font-bold transition-colors ${
                    affordable
                      ? "bg-antique-gold text-obsidian hover:bg-deep-gold"
                      : "bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500"
                  } disabled:opacity-60`}
                >
                  <Gem className="h-3 w-3" aria-hidden />
                  {b.price}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/40 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setConfirming(null)}
        >
          <div
            className="w-full max-w-sm animate-fade-scale-in rounded-t-card bg-warm-ivory p-6 shadow-soft-lg dark:bg-ink-900 sm:rounded-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-ink-900 dark:text-warm-ivory">
              Buy "{confirming.name}" name style?
            </h3>
            <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
              It costs{" "}
              <span className="font-mono font-bold tabular-nums">{confirming.price}</span>{" "}
              {gemsLabel.toLowerCase()} ·{" "}
              {gemsBalance - confirming.price} after · yours forever
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setConfirming(null)}
                className="min-h-11 rounded-button px-4 text-sm font-semibold text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800"
              >
                Cancel
              </button>
              <button
                onClick={() => void buy(confirming)}
                disabled={busy === confirming.id || gemsBalance < confirming.price}
                className="min-h-11 rounded-button bg-antique-gold px-4 text-sm font-bold text-obsidian transition-colors hover:bg-deep-gold disabled:opacity-60"
              >
                {busy === confirming.id ? "Buying…" : "Buy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
