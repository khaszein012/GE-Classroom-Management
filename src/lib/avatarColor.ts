interface AvatarColorDef {
  bg: string;
  text: string;
}

export const AVATAR_PALETTE: readonly AvatarColorDef[] = [
  { bg: "bg-earth-01", text: "text-warm-ivory" },
  { bg: "bg-earth-02", text: "text-warm-ivory" },
  { bg: "bg-earth-03", text: "text-warm-ivory" },
  { bg: "bg-earth-04", text: "text-obsidian" },
  { bg: "bg-earth-05", text: "text-obsidian" },
  { bg: "bg-earth-06", text: "text-warm-ivory" },
  { bg: "bg-earth-07", text: "text-obsidian" },
  { bg: "bg-earth-08", text: "text-warm-ivory" },
  { bg: "bg-earth-09", text: "text-warm-ivory" },
  { bg: "bg-earth-10", text: "text-warm-ivory" },
  { bg: "bg-earth-11", text: "text-warm-ivory" },
  { bg: "bg-earth-12", text: "text-warm-ivory" },
];

export const PALETTE_SIZE = AVATAR_PALETTE.length;

export function avatarColor(index: number): string {
  const i = ((index % AVATAR_PALETTE.length) + AVATAR_PALETTE.length) % AVATAR_PALETTE.length;
  const c = AVATAR_PALETTE[i];
  return `${c.bg} ${c.text}`;
}

export function avatarColorDef(index: number): AvatarColorDef {
  const i = ((index % AVATAR_PALETTE.length) + AVATAR_PALETTE.length) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[i];
}

export function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const words = trimmed.split(/\s+/);
  if (words.length === 1) return words[0][0]?.toUpperCase() ?? "?";
  return (words[0][0] ?? "").toUpperCase() + (words[words.length - 1][0] ?? "").toUpperCase();
}

export function nextColorIndex(count: number): number {
  return count % AVATAR_PALETTE.length;
}
