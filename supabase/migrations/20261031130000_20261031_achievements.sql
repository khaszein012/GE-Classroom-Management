/*
# Achievements & streaks — computed from the ledger, nothing student-writable

`my_achievement_stats()` — SECURITY DEFINER, returns ONLY aggregate stats for
the signed-in student: award counts, lifetime earned, quiz attempts (incl.
perfect scores), rewards redeemed, and the list of distinct award DATES.
Streaks are computed client-side from those dates so day boundaries follow
the student's local timezone, not the server's.

Everything here is derived — no new tables, no writes, retroactive.
*/

CREATE OR REPLACE FUNCTION public.my_achievement_stats()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (
    SELECT id FROM public.students WHERE user_id = auth.uid()
  )
  SELECT jsonb_build_object(
    'total_awards', (
      SELECT count(*)::int FROM public.point_transactions t, me
      WHERE t.student_id = me.id AND NOT t.is_undone AND t.amount > 0 AND t.type <> 'achievement'
    ),
    'lifetime_earned', (
      SELECT COALESCE(sum(t.amount), 0)::int FROM public.point_transactions t, me
      WHERE t.student_id = me.id AND NOT t.is_undone AND t.amount > 0 AND t.type <> 'achievement'
    ),
    'quizzes_taken', (
      SELECT count(*)::int FROM public.quiz_attempts t, me
      WHERE t.student_id = me.id AND t.submitted_at IS NOT NULL
    ),
    'perfect_quizzes', (
      SELECT count(*)::int FROM public.quiz_attempts t, me
      WHERE t.student_id = me.id AND t.submitted_at IS NOT NULL
        AND t.total_count > 0 AND t.correct_count = t.total_count
    ),
    'rewards_redeemed', (
      SELECT count(*)::int FROM public.redemptions t, me
      WHERE t.student_id = me.id AND t.status = 'approved'
    ),
    'award_days', COALESCE((
      SELECT jsonb_agg(DISTINCT (t.created_at AT TIME ZONE 'utc')::date)
      FROM public.point_transactions t, me
      WHERE t.student_id = me.id AND NOT t.is_undone AND t.amount > 0 AND t.type <> 'achievement'
    ), '[]'::jsonb)
  )
  FROM me;
$$;

REVOKE EXECUTE ON FUNCTION public.my_achievement_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_achievement_stats() TO authenticated;
