/**
 * Premium avatar catalog.
 *
 * REDESIGN (2026-11-05): the first pass put a tiny glyph in the tile's
 * bottom-right corner — exactly where the level badge sits — and used muted
 * gradients, so premium avatars were nearly indistinguishable from free
 * ones. The redesign makes the glyph the MAIN artwork (large, centered) and
 * moves the initials to a small chip in the TOP-LEFT corner, opposite the
 * level badge. Initials stay visible (recognition rule), but the emoji is
 * what you see across the room.
 *
 * Free tier stays the classic colour monogram — that is the recognition
 * baseline and is never restyled.
 *
 * v2 is still a closed catalog: no uploads. Adding an avatar = one entry
 * here plus the same id in the migration seed (ids are stable strings).
 */

export type AvatarRarity = "free" | "uncommon" | "rare" | "epic";

export interface AvatarDef {
  id: string;
  name: string;
  rarity: AvatarRarity;
  /** Gem price. Free-tier avatars are never sold. */
  price: number;
  /** Background scene classes for the tile. */
  bg: string;
  /** Ring/outline class. */
  ring: string;
  /** The dominant emoji artwork, centered on the tile. */
  glyph: string;
  /** Extra flourish layer class (sheen/pattern) for top tiers. */
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
    ring: "",
    glyph: "",
  },

  // ----- Uncommon (15 gems): vivid animal/nature scenes --------------------
  {
    id: "ink-scholar",
    name: "Wise Owl",
    rarity: "uncommon",
    price: 15,
    bg: "bg-gradient-to-br from-[#4c3a8f] via-[#372a6b] to-[#181233]",
    ring: "ring-[#b9a5ff]/60",
    glyph: "🦉",
  },
  {
    id: "sea-glass",
    name: "Ocean Wave",
    rarity: "uncommon",
    price: 15,
    bg: "bg-gradient-to-br from-[#0e7490] via-[#0e5a75] to-[#062c3d]",
    ring: "ring-[#67e8f9]/60",
    glyph: "🐬",
  },
  {
    id: "ember",
    name: "Butterfly",
    rarity: "uncommon",
    price: 15,
    bg: "bg-gradient-to-br from-[#db2777] via-[#9d174d] to-[#4a0521]",
    ring: "ring-[#f9a8d4]/60",
    glyph: "🦋",
  },
  {
    id: "orchid",
    name: "Blossom",
    rarity: "uncommon",
    price: 15,
    bg: "bg-gradient-to-br from-[#c026d3] via-[#86198f] to-[#3b0764]",
    ring: "ring-[#f0abfc]/60",
    glyph: "🌸",
  },

  // ----- Rare (45-60 gems): bold statement scenes --------------------------
  {
    id: "gilded-crown",
    name: "Golden Crown",
    rarity: "rare",
    price: 45,
    bg: "bg-gradient-to-br from-[#f59e0b] via-[#b45309] to-[#451a03]",
    ring: "ring-[#fcd34d]/80",
    glyph: "👑",
    flourish: "avatar-foil",
  },
  {
    id: "midnight-star",
    name: "Midnight Moon",
    rarity: "rare",
    price: 45,
    bg: "bg-gradient-to-br from-[#1e3a8a] via-[#172554] to-[#020617]",
    ring: "ring-[#93c5fd]/60",
    glyph: "🌙",
  },
  {
    id: "jade-dragon",
    name: "Jade Dragon",
    rarity: "rare",
    price: 60,
    bg: "bg-gradient-to-br from-[#059669] via-[#065f46] to-[#022c22]",
    ring: "ring-[#6ee7b7]/70",
    glyph: "🐉",
    flourish: "avatar-foil",
  },
  {
    id: "solar-flare",
    name: "Solar Flare",
    rarity: "rare",
    price: 60,
    bg: "bg-gradient-to-br from-[#fb923c] via-[#ea580c] to-[#7c2d12]",
    ring: "ring-[#fed7aa]/70",
    glyph: "☀️",
    flourish: "avatar-foil",
  },

  // ----- Epic (80 gems): the top of the ladder ------------------------------
  {
    id: "aurora",
    name: "Aurora",
    rarity: "epic",
    price: 80,
    bg: "bg-gradient-to-br from-[#22d3ee] via-[#a855f7] to-[#ec4899]",
    ring: "ring-white/70",
    glyph: "🌈",
    flourish: "avatar-foil",
  },
  {
    id: "nebula",
    name: "Nebula",
    rarity: "epic",
    price: 80,
    bg: "bg-gradient-to-br from-[#6d28d9] via-[#312e81] to-[#0c0a1d]",
    ring: "ring-[#c4b5fd]/70",
    glyph: "🪐",
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

/**
 * Overlay the server catalog onto the local visuals: the DB wins for price,
 * display name and sort order, the client supplies the artwork. Styles
 * present only in the DB (no client art) are skipped — they could never be
 * rendered. If the catalog can't be read (pre-migration), the local prices
 * stand and everything keeps working.
 */
export function mergeAvatarCatalog(rows: { id: string; name: string; price: number; sort_order: number }[] | null): AvatarDef[] {
  if (!rows || rows.length === 0) return [...AVATARS].sort((a, b) => a.price - b.price);
  const out: AvatarDef[] = [];
  for (const row of rows) {
    const def = BY_ID.get(row.id);
    if (!def) continue;
    out.push({ ...def, name: row.name, price: row.price });
  }
  return out;
}

export const RARITY_LABEL: Record<AvatarRarity, string> = {
  free: "Starter",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
};