/*
# Phase 7: Colour theme preferences

Purely additive preference fields — no feature, permission, balance or
calculation changes anywhere.

- `class_settings.teacher_theme` — the (single) teacher's console theme.
  Only the teacher can read or write class_settings (students have no table
  policy on it; the safe currency functions expose display settings only).
- `students.theme` — each student's own theme. Added to the student's
  column-level UPDATE grant (own row only, enforced by the existing
  student_update_own_goal policy that scopes rows to user_id = auth.uid()).
- `students_safe` is recreated to expose `theme` to the owning student.
  A student's theme is a personal preference: it never affects the
  teacher's console, another student's view, or any shared data.

Default for everyone (existing and new) is Genji — both columns are NULL
until chosen, and NULL renders as Genji.
*/

ALTER TABLE public.class_settings ADD COLUMN IF NOT EXISTS teacher_theme text;
ALTER TABLE public.class_settings DROP CONSTRAINT IF EXISTS class_settings_teacher_theme_check;
ALTER TABLE public.class_settings ADD CONSTRAINT class_settings_teacher_theme_check
  CHECK (teacher_theme IS NULL OR teacher_theme IN ('genji','indigo','sage','plum'));

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS theme text;
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_theme_check;
ALTER TABLE public.students ADD CONSTRAINT students_theme_check
  CHECK (theme IS NULL OR theme IN ('genji','indigo','sage','plum'));

REVOKE UPDATE ON public.students FROM authenticated;
GRANT UPDATE (pin_hash, failed_attempts, locked_until, class_id, goal_target, goal_label, goal_currency, theme)
  ON public.students TO authenticated;

DROP VIEW IF EXISTS public.students_safe;

CREATE VIEW public.students_safe
WITH (security_invoker = true) AS
SELECT
  s.id,
  s.display_name,
  s.avatar_emoji,
  s.avatar_color,
  public.class_behavior_currency() AS behavior_currency,
  public.class_achievement_currency() AS achievement_currency,
  COALESCE((
    SELECT sum(t.amount)::int
    FROM public.point_transactions t
    WHERE t.student_id = s.id AND t.is_undone = false AND t.type <> 'achievement'
  ), 0) AS balance,
  COALESCE((
    SELECT sum(t.amount)::int
    FROM public.point_transactions t
    WHERE t.student_id = s.id AND t.is_undone = false AND t.amount > 0 AND t.type <> 'achievement'
  ), 0) AS lifetime_earned,
  s.goal_target,
  s.goal_label,
  s.goal_currency,
  s.theme,
  COALESCE((
    SELECT sum(t.amount)::int
    FROM public.point_transactions t
    WHERE t.student_id = s.id AND t.is_undone = false AND t.type = 'achievement'
  ), 0) AS gems_balance,
  COALESCE((
    SELECT sum(t.amount)::int
    FROM public.point_transactions t
    WHERE t.student_id = s.id AND t.is_undone = false AND t.amount > 0 AND t.type = 'achievement'
  ), 0) AS gems_lifetime
FROM public.students s
WHERE s.user_id = auth.uid();

GRANT SELECT ON public.students_safe TO authenticated;
