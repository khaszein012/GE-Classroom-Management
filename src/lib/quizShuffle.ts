/**
 * Deterministic per-student shuffling for quizzes.
 *
 * The seed is the attempt id, which is unique per student per quiz: the same
 * student always sees the same order (even after a reload), while different
 * students get different orders.
 */

/** Small, well-distributed string hash (cyrb128, first 32 bits). */
function hashSeed(str: string): number {
  let h1 = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h1 = (h1 << 13) | (h1 >>> 19);
  }
  return h1 >>> 0;
}

/** mulberry32 PRNG — deterministic for a given seed. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle driven by the seed — same seed, same order. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const rand = mulberry32(hashSeed(seed));
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
