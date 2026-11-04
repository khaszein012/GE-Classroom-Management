/**
 * Premium name-background catalog.
 *
 * A nameplate behind the student's display name on their dashboard. Same
 * model as the avatar catalog (avatars.ts): curated list, gem-priced,
 * escalating with rarity — bought through the Shop, owned permanently,
 * equipped freely. The server owns the prices (name_bg_catalog table);
 * this file owns the visuals.
 *
 * Deliberately dashboard-only: the teacher roster is a work surface, and a
 * busy nameplate there would slow scanning. The student's own dashboard is
 * the showcase.
 *
 * Free tier = no plate at all (the plain name), so nobody's name is worse
 * than it is today.
 */

export type NameBgRarity = "free" | "uncommon" | "rare" | "epic";

export interface NameBgDef {
  id: string;
  name: string;
  rarity: NameBgRarity;
  /** Gem price. The free style is never sold. */
  price: number;
  /** Classes for the nameplate itself; empty = plain text (classic look). */
  plate: string;
  /** Text colour override for saturated plates; empty = the default ink. */
  text: string;
  /** Extra flourish layer (gold sheen) for the top tiers. */
  flourish?: string;
}

export const DEFAULT_NAME_BG_ID = "none";

export const NAME_BACKGROUNDS: readonly NameBgDef[] = [
  {
    id: DEFAULT_NAME_BG_ID,
    name: "Classic",
    rarity: "free",
    price: 0,
    plate: "",
    text: "",
  },

  // ----- Uncommon: soft tinted plates (readable in light + dark) ----------
  {
    id: "skyline",
    name: "Skyline",
    rarity: "uncommon",
    price: 10,
    plate: "bg-sky-100 ring-1 ring-sky-300/70 dark:bg-sky-950/70 dark:ring-sky-700/60",
    text: "text-sky-950 dark:text-sky-100",
  },
  {
    id: "meadow",
    name: "Meadow",
    rarity: "uncommon",
    price: 10,
    plate: "bg-emerald-100 ring-1 ring-emerald-300/70 dark:bg-emerald-950/70 dark:ring-emerald-700/60",
    text: "text-emerald-950 dark:text-emerald-100",
  },
  {
    id: "blush",
    name: "Blush",
    rarity: "uncommon",
    price: 10,
    plate: "bg-rose-100 ring-1 ring-rose-300/70 dark:bg-rose-950/70 dark:ring-rose-700/60",
    text: "text-rose-950 dark:text-rose-100",
  },
  {
    id: "slate",
    name: "Slate",
    rarity: "uncommon",
    price: 10,
    plate: "bg-ink-100 ring-1 ring-ink-300/70 dark:bg-ink-800 dark:ring-ink-600/60",
    text: "text-ink-900 dark:text-ink-100",
  },

  // ----- Rare: saturated gradient plates -----------------------------------
  {
    id: "sunset",
    name: "Sunset",
    rarity: "rare",
    price: 25,
    plate: "bg-gradient-to-r from-orange-400 to-rose-400 ring-1 ring-orange-300/60",
    text: "text-white",
  },
  {
    id: "ocean",
    name: "Ocean",
    rarity: "rare",
    price: 25,
    plate: "bg-gradient-to-r from-sky-500 to-indigo-500 ring-1 ring-sky-400/60",
    text: "text-white",
  },
  {
    id: "forest",
    name: "Forest",
    rarity: "rare",
    price: 25,
    plate: "bg-gradient-to-r from-emerald-500 to-teal-500 ring-1 ring-emerald-400/60",
    text: "text-white",
  },

  // ----- Epic: the top of the ladder ---------------------------------------
  {
    id: "gilded",
    name: "Gilded",
    rarity: "epic",
    price: 50,
    plate: "bg-gradient-to-r from-[#8a6a1f] via-[#c9a227] to-[#8a6a1f] ring-1 ring-[#f2cf5b]/80",
    text: "text-[#fff7d6]",
    flourish: "avatar-foil",
  },
  {
    id: "royal",
    name: "Royal",
    rarity: "epic",
    price: 80,
    plate: "bg-gradient-to-r from-[#241a4d] via-[#5b3aa0] to-[#241a4d] ring-1 ring-[#a99bff]/70",
    text: "text-[#e3dcff]",
    flourish: "avatar-foil",
  },
];

const BY_ID = new Map(NAME_BACKGROUNDS.map((b) => [b.id, b]));

/** Unknown ids fall back to the classic look; a stale row never breaks render. */
export function nameBgById(id: string | null | undefined): NameBgDef {
  return (id && BY_ID.get(id)) || NAME_BACKGROUNDS[0];
}

/** Everything a student can buy (the free style excluded). */
export function purchasableNameBackgrounds(): NameBgDef[] {
  return NAME_BACKGROUNDS.filter((b) => b.price > 0);
}

/**
 * Overlay the server catalog onto the local visuals: the DB wins for price,
 * display name and sort order, the client supplies the artwork. Styles
 * present only in the DB (no client art) are skipped. If the catalog can't
 * be read (pre-migration), the local prices stand and everything works.
 */
export function mergeNameBgCatalog(rows: { id: string; name: string; price: number; sort_order: number }[] | null): NameBgDef[] {
  if (!rows || rows.length === 0) return [...NAME_BACKGROUNDS].sort((a, b) => a.price - b.price);
  const out: NameBgDef[] = [];
  for (const row of rows) {
    const def = BY_ID.get(row.id);
    if (!def) continue;
    out.push({ ...def, name: row.name, price: row.price });
  }
  return out;
}

export const NAME_BG_RARITY_LABEL: Record<NameBgRarity, string> = {
  free: "Starter",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
};