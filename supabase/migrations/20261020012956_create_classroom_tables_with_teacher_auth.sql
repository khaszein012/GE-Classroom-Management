/*
# Classroom data tables with teacher-only access

1. New Tables
- `class_settings` — single row of class-wide configuration.
  - `id` (integer, primary key, always 1 — enforces exactly one row)
  - `class_name` (text, not null, default 'My Class')
  - `behavior_currency` (jsonb, not null — {singular, plural, icon, color})
  - `achievement_currency` (jsonb, not null — {singular, plural, icon, color})
  - `created_at` (timestamptz, default now)
- `students` — one row per student.
  - `id` (uuid, primary key, default gen_random_uuid)
  - `display_name` (text, not null)
  - `avatar_emoji` (text, not null, default '😀')
  - `avatar_color` (integer, not null, default 0 — index into the 12-hue palette)
  - `username` (text, unique, not null when set — lowercase, no spaces)
  - `pin_hash` (text, nullable — salted SHA-256 hash; never a plain PIN)
  - `pin_plain` (text, nullable — intentionally NOT created; the PIN is shown once
    at creation/reset time in the UI and never persisted in readable form)
  - `is_active` (boolean, not null, default true)
  - `created_at` (timestamptz, default now)
- `behaviors` — tap-to-award behavior definitions.
  - `id` (uuid, primary key, default gen_random_uuid)
  - `label` (text, not null)
  - `emoji` (text, not null)
  - `points` (integer, not null — can be negative)
  - `is_active` (boolean, not null, default true)
  - `created_at` (timestamptz, default now)
- `point_transactions` — every award/deduction event.
  - `id` (uuid, primary key, default gen_random_uuid)
  - `student_id` (uuid, not null, FK to students ON DELETE CASCADE)
  - `type` (text, not null, check in 'behavior'|'achievement'|'spend'|'adjustment')
  - `amount` (integer, not null — can be negative)
  - `reason` (text, not null, default '')
  - `behavior_id` (uuid, nullable, FK to behaviors ON DELETE SET NULL — deleting a
    behavior keeps its past transactions, which still render via `reason`)
  - `is_undone` (boolean, not null, default false)
  - `created_at` (timestamptz, default now)
  - Indexes on `student_id` and `created_at` for fast totals and log queries.

2. Security
- RLS enabled on all four tables.
- All policies scoped TO authenticated only — unauthenticated visitors (the anon
  role) can read and write nothing. Only a signed-in teacher sees the data.
- Simple `USING (true)` / `WITH CHECK (true)` predicates for the authenticated
  role: this app is single-classroom by design; every authenticated user is the
  teacher (student accounts do not exist yet — students never sign in).

3. Important notes
- Point totals are NEVER stored. They are calculated from point_transactions
  where is_undone = false. Lifetime earned = sum of positive non-undone rows.
- PINs are stored only as salted hashes (pin_hash). Plaintext PINs are never
  persisted; the teacher can only reset a PIN, never view an existing one.
- No destructive operations; all statements are idempotent.
*/

CREATE TABLE IF NOT EXISTS class_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  class_name text NOT NULL DEFAULT 'My Class',
  behavior_currency jsonb NOT NULL DEFAULT '{"singular":"Star","plural":"Stars","icon":"Star","color":"amber"}'::jsonb,
  achievement_currency jsonb NOT NULL DEFAULT '{"singular":"Gem","plural":"Gems","icon":"Gem","color":"violet"}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  avatar_emoji text NOT NULL DEFAULT '😀',
  avatar_color integer NOT NULL DEFAULT 0,
  username text UNIQUE,
  pin_hash text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT username_format CHECK (username IS NULL OR (username = lower(username) AND username !~ '\s' AND length(username) >= 3))
);

CREATE TABLE IF NOT EXISTS behaviors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  emoji text NOT NULL DEFAULT '⭐',
  points integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('behavior','achievement','spend','adjustment')),
  amount integer NOT NULL,
  reason text NOT NULL DEFAULT '',
  behavior_id uuid REFERENCES behaviors(id) ON DELETE SET NULL,
  is_undone boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_point_transactions_student ON point_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_created ON point_transactions(created_at);

ALTER TABLE class_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE behaviors ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teacher_read_class_settings" ON class_settings;
CREATE POLICY "teacher_read_class_settings" ON class_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "teacher_insert_class_settings" ON class_settings;
CREATE POLICY "teacher_insert_class_settings" ON class_settings
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "teacher_update_class_settings" ON class_settings;
CREATE POLICY "teacher_update_class_settings" ON class_settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "teacher_delete_class_settings" ON class_settings;
CREATE POLICY "teacher_delete_class_settings" ON class_settings
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "teacher_read_students" ON students;
CREATE POLICY "teacher_read_students" ON students
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "teacher_insert_students" ON students;
CREATE POLICY "teacher_insert_students" ON students
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "teacher_update_students" ON students;
CREATE POLICY "teacher_update_students" ON students
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "teacher_delete_students" ON students;
CREATE POLICY "teacher_delete_students" ON students
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "teacher_read_behaviors" ON behaviors;
CREATE POLICY "teacher_read_behaviors" ON behaviors
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "teacher_insert_behaviors" ON behaviors;
CREATE POLICY "teacher_insert_behaviors" ON behaviors
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "teacher_update_behaviors" ON behaviors;
CREATE POLICY "teacher_update_behaviors" ON behaviors
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "teacher_delete_behaviors" ON behaviors;
CREATE POLICY "teacher_delete_behaviors" ON behaviors
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "teacher_read_transactions" ON point_transactions;
CREATE POLICY "teacher_read_transactions" ON point_transactions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "teacher_insert_transactions" ON point_transactions;
CREATE POLICY "teacher_insert_transactions" ON point_transactions
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "teacher_update_transactions" ON point_transactions;
CREATE POLICY "teacher_update_transactions" ON point_transactions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "teacher_delete_transactions" ON point_transactions;
CREATE POLICY "teacher_delete_transactions" ON point_transactions
  FOR DELETE TO authenticated USING (true);
