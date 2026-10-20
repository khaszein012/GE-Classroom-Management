/*
# Monogram avatars: allow students to update their own avatar color

1. Background
- The `avatar_color` integer column already exists on `students` (default 0).
- Students previously had UPDATE privilege on only: pin_hash, failed_attempts,
  locked_until, class_id, goal_target, goal_label.
- The emoji avatar system is being replaced by monogram avatars (initials on
  a coloured circle). The teacher assigns a colour on creation/edit; the
  student can now also change their own colour from their dashboard.

2. Security change
- Add `avatar_color` to the column-level UPDATE grant on `students` for the
  `authenticated` role. The existing `student_update_own_goal` UPDATE policy
  already restricts row access to `user_id = auth.uid()`, so a student can
  only touch their own row. Combined with the column grant, a student can
  now update ONLY: goal_target, goal_label, avatar_color — nothing else.
  They still cannot write display_name, username, pin_hash, is_active,
  user_id, or any other student's row.

3. Data backfill
- Populate `avatar_color` for any existing students whose value is still the
  default 0, spreading them across the 12-colour palette by insertion order
  so adjacent students in the list differ. Uses `created_at` ordering to
  match the frontend's index-based assignment.
*/

-- Re-grant UPDATE with avatar_color added to the allowed column list.
REVOKE UPDATE ON public.students FROM authenticated;
GRANT UPDATE (pin_hash, failed_attempts, locked_until, class_id, goal_target, goal_label, avatar_color)
  ON public.students TO authenticated;

-- Backfill: assign colours 0..11 by creation order to any student still at default 0.
-- This is safe to re-run: only touches rows where avatar_color = 0.
DO $$
DECLARE
  rec RECORD;
  idx integer := 0;
BEGIN
  FOR rec IN
    SELECT id FROM public.students WHERE avatar_color = 0 ORDER BY created_at ASC, id ASC
  LOOP
    UPDATE public.students SET avatar_color = (idx % 12) WHERE id = rec.id;
    idx := idx + 1;
  END LOOP;
END $$;