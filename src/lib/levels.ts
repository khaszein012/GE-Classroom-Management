/**
 * Level curve — XP is the student's lifetime Dollars earned (spending never
 * reduces it), so levels are purely derived: nothing stored, nothing
 * student-writable, retroactive for existing students.
 *
 * Curve: quick early wins, then steady — reaching level L costs
 *   15, 20, 25, 30 (levels 2-5), then +35 per level.
 * L2 = 15, L3 = 35, L4 = 60, L5 = 90, L6 = 125, L7 = 160, ...
 */

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  let xp = 0;
  for (let l = 2; l <= level; l++) xp += l <= 5 ? 15 + 5 * (l - 2) : 35;
  return xp;
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}

export interface LevelProgress {
  level: number;
  /** XP already earned inside the current level. */
  into: number;
  /** XP still needed to reach the next level. */
  needed: number;
  /** 0-100 progress through the current level. */
  pct: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const into = Math.max(0, xp - floor);
  return {
    level,
    into,
    needed: Math.max(0, next - xp),
    pct: Math.min(100, Math.round((into / (next - floor)) * 100)),
  };
}
