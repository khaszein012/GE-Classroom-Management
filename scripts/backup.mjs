/**
 * Full class-data backup — writes every table to backups/<timestamp>/ as
 * JSON. Runs locally (`node --env-file=.env scripts/backup.mjs` with
 * TEACHER_EMAIL/TEACHER_PASSWORD set) and from the scheduled GitHub Action
 * (see .github/workflows/backup.yml).
 *
 * Files are complete table dumps: restore-ready and human-readable.
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const URL_ = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const EMAIL = process.env.TEACHER_EMAIL;
const PASSWORD = process.env.TEACHER_PASSWORD;

if (!URL_ || !ANON || !EMAIL || !PASSWORD) {
  console.error("Need VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, TEACHER_EMAIL, TEACHER_PASSWORD.");
  process.exit(2);
}

const supabase = createClient(URL_, ANON);

const { error: signInErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (signInErr) {
  console.error("Teacher sign-in failed:", signInErr.message);
  process.exit(1);
}

/** Fetch ALL rows of a table, paging past PostgREST's 1000-row default. */
async function fetchAll(table, order = "created_at") {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(order, { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
    from += pageSize;
  }
}

const TABLES = [
  "class_settings",
  // Multi-class structure + per-class goals. Without this a restore loses
  // the class list and every class goal.
  "classes",
  "students",
  "behaviors",
  "point_transactions",
  "rewards",
  "redemptions",
  "quizzes",
  "quiz_questions",
  "quiz_options",
  "quiz_assignments",
  "quiz_attempts",
  "quiz_answers",
];

// Each table's stable ordering column (they differ across the schema).
const ORDER_BY = {
  class_settings: "id",
  classes: "created_at",
  students: "created_at",
  behaviors: "created_at",
  point_transactions: "created_at",
  rewards: "created_at",
  redemptions: "requested_at",
  quizzes: "created_at",
  quiz_questions: "created_at",
  quiz_options: "created_at",
  quiz_assignments: "created_at",
  quiz_attempts: "started_at",
  quiz_answers: "answered_at",
};

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dir = join("backups", stamp);
mkdirSync(dir, { recursive: true });

for (const table of TABLES) {
  const rows = await fetchAll(table, ORDER_BY[table]);
  writeFileSync(join(dir, `${table}.json`), JSON.stringify(rows, null, 2));
  console.log(`  ${table}: ${rows.length} rows`);
}

writeFileSync(
  join(dir, "MANIFEST.txt"),
  `Genji Educator backup\nTaken: ${new Date().toISOString()}\nProject: ${URL_}\nTables: ${TABLES.join(", ")}\n` +
    `Restore: paste JSON rows into the matching Supabase tables (or supabase-db import).\n`,
);

console.log(`Backup written to ${dir}`);
