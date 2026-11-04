/**
 * Premium avatar catalog.
 *
 * Design constraint: these must NOT break the monogram recognition system.
 * A teacher scanning the roster should still be able to tell students apart,
 * so every premium avatar keeps the initials visible and keeps a distinct
 * background — it changes the *treatment* (gradient, glyph frame, pattern),
 * not the person's identity.
 *
 * v1 is a closed catalog: no uploads. Curated packs are mod-safe for a
 * school app and stay on brand. Adding an avatar = one entry here plus the
 * same id in the migration's seed (ids are stable strings stored in the DB).
 */

export type AvatarRarity = "free" | "uncommon" | "rare";

export interface AvatarDef {
  id: string;
  name: string;
  rarity: AvatarRarity;
  /** Gem price. Free-tier avatars are never sold. */
  price: number;
  /** Gradient/background classes for the tile. */
  bg: string;
  /** Text colour for the initials. */
  text: string;
  /** Ring/outline class. */
  ring: string;
  /** Optional decorative glyph rendered behind the initials. */
  glyph?: string;
  /** Extra flourish layer class (patterns, shine). */
  flourish?: string;
}

/** The default look: plain coloured monogram, free and always owned. */
export const DEFAULT_AVATAR_ID = "monogram";

export const AVATARS: readonly AvatarDef[] = [
  {
    id: DEFAULT_AVATAR_ID,
    name: "Classic",
    rarity: "free",
    price: 0,
    bg: "",
    text: "",
    ring: "",
  },

  // ----- Uncommon: richer treatments, same initials-forward idea -----------
  {
    id: "ink-scholar",
    name: "Ink Scholar",
    rarity: "uncommon",
    price: 15,
    bg: "bg-gradient-to-br from-[#22304a] to-[#0b1220]",
    text: "text-[#e8d8a8]",
    ring: "ring-[#c9a227]/40",
    glyph: "✦",
  },
  {
    id: "sea-glass",
    name: "Sea Glass",
    rarity: "uncommon",
    price: 15,
    bg: "bg-gradient-to-br from-[#1f5f5b] to-[#08302f]",
    text: "text-[#d8f5ef]",
    ring: "ring-[#7fd8c8]/40",
    glyph: "◇",
  },
  {
    id: "ember",
    name: "Ember",
    rarity: "uncommon",
    price: 15,
    bg: "bg-gradient-to-br from-[#7a3410] to-[#2a1005]",
    text: "text-[#ffd9b3]",
    ring: "ring-[#ff9f45]/40",
    glyph: "▲",
  },
  {
    id: "orchid",
    name: "Orchid",
    rarity: "uncommon",
    price: 15,
    bg: "bg-gradient-to-br from-[#5b2a5e] to-[#1f0d24]",
    text: "text-[#f0d4f5]",
    ring: "ring-[#d69ae0]/40",
    glyph: "❋",
  },

  // ----- Rare: gilded/gem-set treatments ----------------------------------
  {
    id: "gilded-crown",
    name: "Gilded Crown",
    rarity: "rare",
    price: 45,
    bg: "bg-gradient-to-br from-[#4a3a12] via-[#8a6a1f] to-[#2a1f08]",
    text: "text-[#fff3c4]",
    ring: "ring-[#f2cf5b]/70",
    glyph: "♛",
    flourish: "avatar-foil",
  },
  {
    id: "midnight-star",
    name: "Midnight Star",
    rarity: "rare",
    price: 45,
    bg: "bg-gradient-to-br from-[#241a4d] via-[#3a2a7a] to-[#0b0720]",
    text: "text-[#e3dcff]",
    ring: "ring-[#a99bff]/60",
    glyph: "★",
    flourish: "avatar-foil",
  },
  {
    id: "jade-dragon",
    name: "Jade Dragon",
    rarity: "rare",
    price: 60,
    bg: "bg-gradient-to-br from-[#123a2a] via-[#1f6b47] to-[#06170f]",
    text: "text-[#d6ffe8]",
    ring: "ring-[#5ce0a0]/60",
    glyph: "龍",
    flourish: "avatar-foil",
  },
  {
    id: "solar-flare",
    name: "Solar Flare",
    rarity: "rare",
    price: 60,
    bg: "bg-gradient-to-br from-[#7a2f0b] via-[#c2571a] to-[#3a1303]",
    text: "text-[#fff0d4]",
    ring: "ring-[#ffb35c]/70",
    glyph: "☀",
    flourish: "avatar-foil",
  },
];

const BY_ID = new Map(AVATARS.map((a) => [a.id, a]));

/** Unknown ids fall back to the default so a stale row never breaks render. */
export function avatarById(id: string | null | undefined): AvatarDef {
  return (id && BY_ID.get(id)) || AVATARS[0];
}

/** Everything a student can actually buy (free tier excluded). */
export function purchasableAvatars(): AvatarDef[] {
  return AVATARS.filter((a) => a.price > 0);
}

export const RARITY_LABEL: Record<AvatarRarity, string> = {
  free: "Starter",
  uncommon: "Uncommon",
  rare: "Rare",
};