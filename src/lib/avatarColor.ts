interface AvatarColorDef {
  bg: string;
  text: string;
  ring: string;
}

export const AVATAR_PALETTE: readonly AvatarColorDef[] = [
  { bg: "bg-gradient-to-br from-[#1e3a5f] to-[#0c1f3a]", text: "text-white", ring: "ring-white/15" },
  { bg: "bg-gradient-to-br from-[#1a4d3a] to-[#0a2a1f]", text: "text-white", ring: "ring-white/15" },
  { bg: "bg-gradient-to-br from-[#3d2a5c] to-[#1d1336]", text: "text-white", ring: "ring-white/15" },
  { bg: "bg-gradient-to-br from-[#b8581f] to-[#7a3410]", text: "text-white", ring: "ring-white/15" },
  { bg: "bg-gradient-to-br from-[#8b1e3f] to-[#5a0f28]", text: "text-white", ring: "ring-white/15" },
  { bg: "bg-gradient-to-br from-[#0d6b6b] to-[#054040]", text: "text-white", ring: "ring-white/15" },
  { bg: "bg-gradient-to-br from-[#b8860b] to-[#7a5808]", text: "text-white", ring: "ring-white/15" },
  { bg: "bg-gradient-to-br from-[#9c4a7e] to-[#5e2a4c]", text: "text-white", ring: "ring-white/15" },
  { bg: "bg-gradient-to-br from-[#2c3e8c] to-[#16205a]", text: "text-white", ring: "ring-white/15" },
  { bg: "bg-gradient-to-br from-[#2d6a4f] to-[#143a2a]", text: "text-white", ring: "ring-white/15" },
  { bg: "bg-gradient-to-br from-[#6b2c5e] to-[#3d152e]", text: "text-white", ring: "ring-white/15" },
  { bg: "bg-gradient-to-br from-[#4a4a5e] to-[#23232f]", text: "text-white", ring: "ring-white/15" },
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
