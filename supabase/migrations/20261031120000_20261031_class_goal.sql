/*
# Class goal — a shared target the whole class works toward

- `class_settings.class_goal_target` (integer, NULL = no goal set) and
  `.class_goal_label` (text) — teacher-managed in Settings.
- Progress = total positive, non-undone, non-achievement Transactions across
  the whole class (behaviour earnings only; quiz gems are a separate score
  and never feed the class goal — consistent with every other seal).
- `class_goal_progress()` — SECURITY DEFINER, exposes ONLY the aggregate
  earned figure + label + target to student sessions (they cannot read
  class_settings or each other's transactions). Teacher reads progress from
  the ledger directly.

No conversion, no spending effect: earned figures only ever rise with
positive behaviour awards, exactly like the individual XP curve.
*/

ALTER TABLE public.class_settings ADD COLUMN IF NOT EXISTS class_goal_target integer;
ALTER TABLE public.class_settings ADD COLUMN IF NOT EXISTS class_goal_label text;

ALTER TABLE public.class_settings DROP CONSTRAINT IF EXISTS class_settings_goal_target_check;
ALTER TABLE public.class_settings ADD CONSTRAINT class_settings_goal_target_check
  CHECK (class_goal_target IS NULL OR class_goal_target >= 1);

CREATE OR REPLACE FUNCTION public.class_goal_progress()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'target', cs.class_goal_target,
    'label', cs.class_goal_label,
    'earned', COALESCE((
      SELECT sum(t.amount)::int
      FROM public.point_transactions t
      WHERE t.is_undone = false
        AND t.amount > 0
        AND t.type <> 'achievement'
    ), 0)
  )
  FROM public.class_settings cs
  WHERE cs.id = 1;
$$;

REVOKE EXECUTE ON FUNCTION public.class_goal_progress() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_goal_progress() TO authenticated;
