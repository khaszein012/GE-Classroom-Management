/**
 * PIN handling — the plaintext PIN exists only in memory at the moment of
 * creation/reset. Only a salted SHA-256 hash is ever persisted, so nobody
 * (including the teacher) can view an existing PIN — only reset it.
 */

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generatePin(): string {
  // 6-digit numeric PIN, cryptographically random, no leading-zero loss.
  const min = 100000;
  const max = 999999;
  const range = max - min + 1;
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(min + (buf[0] % range));
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomSalt();
  const hash = await sha256Hex(`${salt}:${pin}`);
  return `s1$${salt}$${hash}`;
}

export function suggestUsername(displayName: string): string {
  const cleaned = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
  return cleaned.length >= 3 ? cleaned : cleaned.padEnd(3, "x");
}
