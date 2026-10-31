import type { CurrencyConfig, PointTransaction } from "@/types";
import { suggestUsername } from "@/lib/pin";
import { nextColorIndex } from "@/lib/avatarColor";
import {
  addBehavior,
  addStudent,
  insertTransactionsRaw,
  isUsernameTaken,
  saveCurrencyConfig,
} from "@/lib/storage";

const MIGRATION_KEY = "cr_migrated_v1";
const LEGACY_KEYS = {
  students: "cr_students",
  behaviors: "cr_behaviors",
  transactions: "cr_transactions",
  currency: "cr_currency",
} as const;

interface LegacyStudent {
  id: string;
  displayName: string;
  avatarEmoji: string;
  createdAt: number;
}

interface LegacyBehavior {
  id: string;
  label: string;
  emoji: string;
  points: number;
  createdAt: number;
}

interface LegacyTransaction {
  studentId: string;
  type: PointTransaction["type"];
  amount: number;
  reason: string;
  isUndone: boolean;
  createdAt: number;
}

function readLegacy<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function legacyCurrencyConfig(): CurrencyConfig | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEYS.currency);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CurrencyConfig>;
    if (parsed.behavior && parsed.achievement) return parsed as CurrencyConfig;
  } catch {
    // ignore
  }
  return null;
}

function hasLegacyData(): boolean {
  return (
    readLegacy<LegacyStudent>(LEGACY_KEYS.students).length > 0 ||
    readLegacy<LegacyBehavior>(LEGACY_KEYS.behaviors).length > 0 ||
    readLegacy<LegacyTransaction>(LEGACY_KEYS.transactions).length > 0 ||
    legacyCurrencyConfig() !== null
  );
}

async function uniqueUsername(base: string): Promise<string> {
  let candidate = suggestUsername(base);
  let suffix = 1;
  while (await isUsernameTaken(candidate)) {
    suffix += 1;
    candidate = `${suggestUsername(base)}${suffix}`;
  }
  return candidate;
}

/**
 * One-time import of legacy localStorage data into the database.
 * Runs at most once per browser (guarded by a localStorage flag).
 * Imported students get an auto-generated username and no PIN —
 * the Students list flags them with a "Needs PIN" badge.
 */
export async function migrateLegacyData(): Promise<string | null> {
  if (localStorage.getItem(MIGRATION_KEY)) return null;
  if (!hasLegacyData()) {
    localStorage.setItem(MIGRATION_KEY, "1");
    return null;
  }

  const students = readLegacy<LegacyStudent>(LEGACY_KEYS.students);
  const behaviors = readLegacy<LegacyBehavior>(LEGACY_KEYS.behaviors);
  const transactions = readLegacy<LegacyTransaction>(LEGACY_KEYS.transactions);
  const currency = legacyCurrencyConfig();

  const parts: string[] = [];

  try {
    if (currency) await saveCurrencyConfig(currency);

    // Map old behavior ids to new ones so transactions can re-link.
    const behaviorIdMap = new Map<string, string>();
    for (const b of behaviors) {
      const created = await addBehavior(b.label, b.emoji, b.points, 1);
      behaviorIdMap.set(b.id, created.id);
    }
    if (behaviors.length > 0) parts.push(`${behaviors.length} behaviors`);

    const studentIdMap = new Map<string, string>();
    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      const username = await uniqueUsername(s.displayName);
      const created = await addStudent({
        classId: 1,
        displayName: s.displayName,
        avatarColor: nextColorIndex(i),
        username,
        pin: null,
      });
      studentIdMap.set(s.id, created.id);
    }
    if (students.length > 0) parts.push(`${students.length} students`);

    const rows = transactions
      .filter((t) => studentIdMap.has(t.studentId))
      .map((t) => ({
        student_id: studentIdMap.get(t.studentId)!,
        type: t.type,
        amount: t.amount,
        reason: t.reason,
        is_undone: t.isUndone,
        created_at: new Date(t.createdAt).toISOString(),
      }));
    await insertTransactionsRaw(rows);
    if (rows.length > 0) parts.push(`${rows.length} transactions`);

    localStorage.setItem(MIGRATION_KEY, "1");
    return parts.length > 0 ? `Imported ${parts.join(", ")}` : null;
  } catch (e) {
    // Don't mark done on failure — retry on next sign-in.
    console.error("Migration failed", e);
    return e instanceof Error ? `Migration failed: ${e.message}` : "Migration failed";
  }
}
