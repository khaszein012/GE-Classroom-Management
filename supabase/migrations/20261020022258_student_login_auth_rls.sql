/*
# Student login: server-side PIN auth, per-student RLS, lockout

1. New columns (non-destructive, additive only)
- `students.user_id uuid` — unique nullable FK to auth.users. Populated by the
  student-login edge function when a student signs in for the first time.
  NULL until then.
- `students.failed_attempts integer NOT NULL DEFAULT 0`
- `students.locked_until timestamptz NULL` — set server-side after 5 failures
  (60s), cleared on success or by the teacher resetting the PIN.
- No other schema changes. No data is dropped, deleted, or retyped.

2. Security model
- Students are real Supabase sessions created by an edge function after
  server-side PIN verification (salted SHA-256, never plaintext).
- Student JWTs carry `app_metadata.student_id`; teacher JWTs do not.
  - Teacher (no claim): full access to all four tables, as before.
  - Student (claim present): SELECT own student row via a safe view, SELECT own
    non-undone transactions only. Zero access to behaviors, class_settings, or
    any other student's data. No INSERT/UPDATE/DELETE anywhere.
- All former teacher_* policies are re-issued with the teacher predicate
  (no student_id claim) so student sessions are excluded from every
  teacher path.

3. Important notes
- The view `students_safe` is SECURITY INVOKER (an owner-rights view would
  bypass RLS and expose all rows to any signed-in user). It exposes only
  display name, avatar, the class currency definition, and the student's own
  balance/lifetime totals — no usernames, hashes, or lockout state.
- Idempotent: IF NOT EXISTS guards + DROP POLICY IF EXISTS before CREATE.
*/

-- 1. Columns ---------------------------------------------------------------

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS students_user_id_key ON public.students(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS locked_until timestamptz;

-- 2. Column privileges on students (defense in depth) -----------------------

REVOKE UPDATE ON public.students FROM authenticated;
GRANT UPDATE (display_name, avatar_emoji, avatar_color, username, pin_hash, failed_attempts, locked_until, class_id)
  ON public.students TO authenticated;

-- 3. Safe view for student self-reads ----------------------------------------

CREATE OR REPLACE VIEW public.students_safe
WITH (security_invoker = true) AS
SELECT
  s.id,
  s.display_name,
  s.avatar_emoji,
  s.avatar_color,
  cs.behavior_currency,
  COALESCE((
    SELECT sum(t.amount)::int
    FROM public.point_transactions t
    WHERE t.student_id = s.id AND t.is_undone = false
  ), 0) AS balance,
  COALESCE((
    SELECT sum(t.amount)::int
    FROM public.point_transactions t
    WHERE t.student_id = s.id AND t.is_undone = false AND t.amount > 0
  ), 0) AS lifetime_earned
FROM public.students s
CROSS JOIN public.class_settings cs
WHERE s.user_id = auth.uid();

GRANT SELECT ON public.students_safe TO authenticated;

-- 4. Teacher policies (teacher = authenticated session with NO student claim) --

DROP POLICY IF EXISTS "teacher_read_class_settings" ON class_settings;
CREATE POLICY "teacher_read_class_settings" ON class_settings
  FOR SELECT TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_insert_class_settings" ON class_settings;
CREATE POLICY "teacher_insert_class_settings" ON class_settings
  FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_update_class_settings" ON class_settings;
CREATE POLICY "teacher_update_class_settings" ON class_settings
  FOR UPDATE TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL)
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_delete_class_settings" ON class_settings;
CREATE POLICY "teacher_delete_class_settings" ON class_settings
  FOR DELETE TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_read_students" ON students;
CREATE POLICY "teacher_read_students" ON students
  FOR SELECT TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_insert_students" ON students;
CREATE POLICY "teacher_insert_students" ON students
  FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_update_students" ON students;
CREATE POLICY "teacher_update_students" ON students
  FOR UPDATE TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL)
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_delete_students" ON students;
CREATE POLICY "teacher_delete_students" ON students
  FOR DELETE TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_read_behaviors" ON behaviors;
CREATE POLICY "teacher_read_behaviors" ON behaviors
  FOR SELECT TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_insert_behaviors" ON behaviors;
CREATE POLICY "teacher_insert_behaviors" ON behaviors
  FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_update_behaviors" ON behaviors;
CREATE POLICY "teacher_update_behaviors" ON behaviors
  FOR UPDATE TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL)
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_delete_behaviors" ON behaviors;
CREATE POLICY "teacher_delete_behaviors" ON behaviors
  FOR DELETE TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_read_transactions" ON point_transactions;
CREATE POLICY "teacher_read_transactions" ON point_transactions
  FOR SELECT TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_insert_transactions" ON point_transactions;
CREATE POLICY "teacher_insert_transactions" ON point_transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_update_transactions" ON point_transactions;
CREATE POLICY "teacher_update_transactions" ON point_transactions
  FOR UPDATE TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL)
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_delete_transactions" ON point_transactions;
CREATE POLICY "teacher_delete_transactions" ON point_transactions
  FOR DELETE TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

-- 5. Student policies (self-only reads; nothing else) -------------------------

DROP POLICY IF EXISTS "student_read_own_row" ON students;
CREATE POLICY "student_read_own_row" ON students
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "student_read_own_transactions" ON point_transactions;
CREATE POLICY "student_read_own_transactions" ON point_transactions
  FOR SELECT TO authenticated
  USING (
    is_undone = false
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = point_transactions.student_id AND s.user_id = auth.uid()
    )
  );
