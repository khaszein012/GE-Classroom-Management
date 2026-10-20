/*
# Add goal fields to students_safe view

The student home screen reads the goal through the same safe view as the rest
of the student's data. Because Postgres cannot reorder existing view columns,
the view is dropped and recreated with the new columns appended at the end.
The view is security_invoker, so RLS still scopes every row to the signed-in
student. No data changes, idempotent.
*/

DROP VIEW IF EXISTS public.students_safe;

CREATE VIEW public.students_safe
WITH (security_invoker = true) AS
SELECT
  s.id,
  s.display_name,
  s.avatar_emoji,
  s.avatar_color,
  public.class_behavior_currency() AS behavior_currency,
  COALESCE((
    SELECT sum(t.amount)::int
    FROM public.point_transactions t
    WHERE t.student_id = s.id AND t.is_undone = false
  ), 0) AS balance,
  COALESCE((
    SELECT sum(t.amount)::int
    FROM public.point_transactions t
    WHERE t.student_id = s.id AND t.is_undone = false AND t.amount > 0
  ), 0) AS lifetime_earned,
  s.goal_target,
  s.goal_label
FROM public.students s
WHERE s.user_id = auth.uid();

GRANT SELECT ON public.students_safe TO authenticated;
