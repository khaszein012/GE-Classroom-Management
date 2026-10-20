/*
# Student personal goal: columns + the only student write path

1. New columns on `students` (additive, non-destructive)
- `goal_target integer NULL` — the student's personal target balance, e.g. 150.
- `goal_label text NULL` — what the goal is for, e.g. 'canteen voucher'.
  Both NULL = no goal set. The teacher UI does not use these columns.

2. Security
- Students previously had ZERO write privileges anywhere. The feature needs
  exactly one write: the signed-in student may set/edit/clear their own goal.
- New UPDATE policy `student_update_own_goal` on students, TO authenticated:
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()).
  The policy restricts ROWS; COLUMNS are restricted by privileges (below).
- CRITICAL column-privilege scoping: UPDATE on students is now granted on only:
    (pin_hash, failed_attempts, locked_until, class_id)  — teacher paths
    (goal_target, goal_label)                            — student path
  A student therefore can never write display_name, avatar_emoji, avatar_color,
  username, is_active, or user_id — and students have no write path at all to
  point_transactions, behaviors, or class_settings (verified after deploy).
- The goal constraint bounds the target to 1..1,000,000 to keep the value
  sane even if someone calls the data API directly.

3. Important notes
- The first attempt at this migration failed (GRANT before ADD COLUMN) and was
  never applied; this is the corrected statement order. Idempotent.
*/

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS goal_target integer;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS goal_label text;

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_goal_target_check;
ALTER TABLE public.students ADD CONSTRAINT students_goal_target_check
  CHECK (goal_target IS NULL OR (goal_target >= 1 AND goal_target <= 1000000));

REVOKE UPDATE ON public.students FROM authenticated;

GRANT UPDATE (pin_hash, failed_attempts, locked_until, class_id, goal_target, goal_label)
  ON public.students TO authenticated;

DROP POLICY IF EXISTS "student_update_own_goal" ON public.students;
CREATE POLICY "student_update_own_goal" ON public.students
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
