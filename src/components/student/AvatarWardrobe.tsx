import { useState } from "react";
import { Check, Gem, Lock, Sparkles, X } from "lucide-react";
import { AVATAR_PALETTE, initialsOf } from "@/lib/avatarColor";
import { RARITY_LABEL, type AvatarDef } from "@/lib/avatars";
import { NAME_BG_RARITY_LABEL, type NameBgDef } from "@/lib/nameBackgrounds";
import { Monogram } from "@/components/Monogram";
import { useFocusTrap } from "@/lib/useFocusTrap";

/**
 * The student's wardrobe: pick a colour, or equip one of the premium
 * avatars they own.
 *
 * Buying happens in the Shop (so gem pricing lives with the other shop
 * items); this panel is for equipping what you already own and choosing a
 * monogram colour. Locked styles are shown but not actionable — seeing what
 * you could buy is the point of a cosmetic tier.
 */
export function AvatarWardrobe({
  open,
  name,
  colorIndex,
  equippedId,
  owned,
  gemsBalance,
  busy,
  ownedNameBgs,
  equippedNameBgId,
  busyNameBg,
  avatarStyles,
  nameStyles,
  onPickColor,
  onEquip,
  onEquipNameBg,
  onClose,
  onGoToShop,
}: {
  open: boolean;
  name: string;
  colorIndex: number;
  equippedId: string;
  owned: string[];
  gemsBalance: number;
  busy: boolean;
  ownedNameBgs: string[];
  equippedNameBgId: string;
  busyNameBg: boolean;
  /** Server-priced catalogs merged with local visuals — DB wins on price. */
  avatarStyles: AvatarDef[];
  nameStyles: NameBgDef[];
  onPickColor: (index: number) => void;
  onEquip: (avatarId: string) => void;
  onEquipNameBg: (nameBgId: string) => void;
  onClose: () => void;
  onGoToShop: () => void;
}) {
  const [tab, setTab] = useState<"styles" | "colours" | "name">("styles");
  const trapRef = useFocusTrap<HTMLDivElement>(open);
  if (!open) return null;

  const ownedSet = new Set(owned);
  const premium = avatarStyles.filter((a) => a.price > 0);
  const ownedCount = premium.filter((a) => ownedSet.has(a.id)).length;
  const nameBgOwnedSet = new Set(ownedNameBgs);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Your look"
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-card border border-ink-200 bg-warm-ivory shadow-soft-lg animate-slide-up dark:border-ink-700 dark:bg-ink-900 sm:rounded-card"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-200/70 px-4 py-3 dark:border-ink-800/70">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-deep-gold dark:text-antique-gold" aria-hidden />
            <h2 className="font-display text-lg font-semibold text-ink-900 dark:text-warm-ivory">Your look</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close your look"
            className="flex h-10 w-10 items-center justify-center rounded-button text-ink-500 transition-colors hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 gap-1 border-b border-ink-200/70 px-3 pt-2 dark:border-ink-800/70" role="tablist">
          {(["styles", "colours", "name"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`min-h-10 rounded-t-button px-3 text-sm font-semibold transition-colors ${
                tab === t
                  ? "border-b-2 border-antique-gold text-ink-900 dark:text-warm-ivory"
                  : "border-b-2 border-transparent text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
              }`}
            >
              {t === "styles" ? "Styles" : t === "colours" ? "Colours" : "Name"}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {tab === "styles" ? (
            <>
              <p className="mb-3 text-xs text-ink-500 dark:text-ink-400">
                {ownedCount} of {premium.length} premium styles owned
              </p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {avatarStyles.map((a) => (
                  <StyleTile
                    key={a.id}
                    avatar={a}
                    name={name}
                    colorIndex={colorIndex}
                    equipped={equippedId === a.id}
                    isOwned={a.price === 0 || ownedSet.has(a.id)}
                    busy={busy}
                    onEquip={() => onEquip(a.id)}
                  />
                ))}
              </div>

              <button
                onClick={onGoToShop}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-button border border-antique-gold/40 bg-antique-gold/10 px-3 py-3 text-sm font-semibold text-deep-gold transition-colors hover:bg-antique-gold/20 dark:text-antique-gold"
              >
                <Gem className="h-4 w-4" aria-hidden />
                Buy more styles in the Shop
                <span className="ml-1 font-mono text-xs tabular-nums opacity-70">· {gemsBalance} gems</span>
              </button>
            </>
          ) : tab === "name" ? (
            <>
              <p className="mb-3 text-xs text-ink-500 dark:text-ink-400">
                A nameplate behind your name on your dashboard. Buy more in the Shop.
              </p>
              <div className="space-y-2">
                {nameStyles.map((b) => {
                  const isOwned = b.price === 0 || nameBgOwnedSet.has(b.id);
                  const equipped = equippedNameBgId === b.id;
                  return (
                    <button
                      key={b.id}
                      onClick={isOwned && !equipped ? () => onEquipNameBg(b.id) : undefined}
                      disabled={busyNameBg || !isOwned || equipped}
                      aria-pressed={equipped}
                      aria-label={`${b.name} name style${equipped ? " (equipped)" : isOwned ? "" : " — locked"}`}
                      className={`flex w-full items-center justify-between gap-3 rounded-card border px-3 py-2.5 transition-colors ${
                        equipped
                          ? "border-antique-gold bg-antique-gold/10"
                          : isOwned
                            ? "border-ink-200 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800"
                            : "border-dashed border-ink-200 dark:border-ink-700"
                      } disabled:cursor-default`}
                    >
                      {/* Preview: the actual nameplate treatment */}
                      <span className="min-w-0 flex-1 text-left">
                        {b.plate ? (
                          <span className={`relative inline-block max-w-[220px] truncate rounded-full px-3 py-0.5 text-sm font-bold ${b.plate} ${b.text}`}>
                            {b.flourish && (
                              <span aria-hidden className={`absolute inset-0 overflow-hidden rounded-full ${b.flourish}`} />
                            )}
                            <span className="relative">{name}</span>
                          </span>
                        ) : (
                          <span className="text-sm font-bold text-ink-900 dark:text-warm-ivory">{name}</span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-ink-400 dark:text-ink-500">
                          {NAME_BG_RARITY_LABEL[b.rarity]}
                        </span>
                        {equipped ? (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-antique-gold">
                            <Check className="h-3 w-3 text-obsidian" aria-hidden />
                          </span>
                        ) : isOwned ? (
                          <span className="text-xs font-semibold text-deep-gold dark:text-antique-gold">Equip</span>
                        ) : (
                          <span className="flex items-center gap-0.5 font-mono text-xs font-bold tabular-nums text-ink-400">
                            <Lock className="h-3 w-3" aria-hidden />
                            <Gem className="h-3 w-3" aria-hidden />
                            {b.price}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <p className="mb-3 text-xs text-ink-500 dark:text-ink-400">
                Your colour is how classmates find you in the roster.
              </p>
              <div className="grid grid-cols-6 gap-2.5">
                {AVATAR_PALETTE.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => onPickColor(i)}
                    disabled={busy}
                    className={`flex aspect-square items-center justify-center rounded-full text-xs font-bold transition-all ${c.bg} ${c.text} ${
                      colorIndex === i
                        ? "ring-2 ring-antique-gold ring-offset-2 dark:ring-offset-ink-900"
                        : "hover:scale-105"
                    } disabled:opacity-60`}
                    aria-label={`Colour ${i + 1}`}
                    aria-pressed={colorIndex === i}
                  >
                    {initialsOf(name)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StyleTile({
  avatar,
  name,
  colorIndex,
  equipped,
  isOwned,
  busy,
  onEquip,
}: {
  avatar: AvatarDef;
  name: string;
  colorIndex: number;
  equipped: boolean;
  isOwned: boolean;
  busy: boolean;
  onEquip: () => void;
}) {
  return (
    <button
      onClick={isOwned && !equipped ? onEquip : undefined}
      disabled={busy || !isOwned || equipped}
      aria-pressed={equipped}
      aria-label={`${avatar.name}${equipped ? " (equipped)" : isOwned ? "" : " — locked"}`}
      className={`group relative flex flex-col items-center gap-1.5 rounded-card border p-2 transition-colors ${
        equipped
          ? "border-antique-gold bg-antique-gold/10"
          : isOwned
            ? "border-ink-200 hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800"
            : "border-dashed border-ink-200 dark:border-ink-700"
      } disabled:cursor-default`}
    >
      <div className={isOwned ? "" : "opacity-40"}>
        <Monogram
          name={name}
          colorIndex={colorIndex}
          avatarId={avatar.price === 0 ? undefined : avatar.id}
          size="lg"
        />
      </div>
      <span className="w-full truncate text-center text-[10px] font-semibold text-ink-600 dark:text-ink-300">
        {avatar.name}
      </span>
      {equipped ? (
        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-antique-gold">
          <Check className="h-2.5 w-2.5 text-obsidian" aria-hidden />
        </span>
      ) : !isOwned ? (
        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-ink-200 dark:bg-ink-700">
          <Lock className="h-2.5 w-2.5 text-ink-500 dark:text-ink-400" aria-hidden />
        </span>
      ) : null}
      {!isOwned && (
        <span className="flex items-center gap-0.5 font-mono text-[10px] font-bold tabular-nums text-ink-400">
          <Gem className="h-2.5 w-2.5" aria-hidden />
          {avatar.price}
        </span>
      )}
      {isOwned && !equipped && (
        <span className="text-[10px] font-semibold text-deep-gold dark:text-antique-gold">
          {RARITY_LABEL[avatar.rarity]}
        </span>
      )}
    </button>
  );
}