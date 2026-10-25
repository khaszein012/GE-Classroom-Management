/*
# Phase 7.2: Quiz archive / reopen

Purely additive — no existing behaviour changes for non-archived quizzes.

- `quizzes.archived_at` (timestamptz, NULL = not archived). Archiving is a
  separate axis from status: a quiz of any status can be archived, and
  restoring returns it to the status it had.
- The three student-facing helpers now exclude archived quizzes, so an
  archived quiz is invisible to students everywhere (list, questions,
  attempts) — the teacher keeps full access and all attempt history:
  * student_quiz_readable(): add `AND z.archived_at IS NULL`
  * student_quiz_startable(): same
  * my_quiz_list(): same
- Reopen is client-side only: setting status='published' with a fresh
  future due_at on a closed quiz. The one-attempt unique constraint still
  guards students who already attempted.

All statements idempotent.
*/

ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Student read: published, assigned, (not yet due OR already attempted),
-- and NOT archived.
CREATE OR REPLACE FUNCTION public.student_quiz_readable(p_quiz_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.quiz_student_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.quizzes z
    WHERE z.id = p_quiz_id
      AND z.status = 'published'
      AND z.archived_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.quiz_assignments a
        WHERE a.quiz_id = z.id AND a.student_id = public.quiz_student_id()
      )
      AND (
        z.due_at > now()
        OR EXISTS (
          SELECT 1 FROM public.quiz_attempts t
          WHERE t.quiz_id = z.id AND t.student_id = public.quiz_student_id()
        )
      )
  );
$$;

-- Student start: published, assigned, not overdue, NOT archived.
CREATE OR REPLACE FUNCTION public.student_quiz_startable(p_quiz_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.quiz_student_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.quizzes z
    WHERE z.id = p_quiz_id
      AND z.status = 'published'
      AND z.archived_at IS NULL
      AND z.due_at > now()
      AND EXISTS (
        SELECT 1 FROM public.quiz_assignments a
        WHERE a.quiz_id = z.id AND a.student_id = public.quiz_student_id()
      )
  );
$$;

-- Student quiz list: assigned, non-draft, NOT archived.
CREATE OR REPLACE FUNCTION public.my_quiz_list()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row_to_json(q) ORDER BY q.due_at), '[]'::jsonb)
  FROM (
    SELECT
      z.id AS quiz_id,
      z.title,
      z.due_at,
      z.status,
      z.max_gems,
      (SELECT count(*)::int FROM public.quiz_questions qq WHERE qq.quiz_id = z.id) AS question_count,
      t.id AS attempt_id,
      t.submitted_at,
      t.correct_count,
      t.total_count,
      t.gems_awarded,
      (SELECT count(*)::int FROM public.quiz_answers ans WHERE ans.attempt_id = t.id) AS answered_count
    FROM public.quizzes z
    JOIN public.quiz_assignments a
      ON a.quiz_id = z.id AND a.student_id = public.quiz_student_id()
    LEFT JOIN public.quiz_attempts t
      ON t.quiz_id = z.id AND t.student_id = public.quiz_student_id()
    WHERE public.quiz_student_id() IS NOT NULL
      AND z.status <> 'draft'
      AND z.archived_at IS NULL
  ) q;
$$;

REVOKE EXECUTE ON FUNCTION public.student_quiz_readable(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.student_quiz_startable(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_quiz_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_quiz_readable(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_quiz_startable(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_quiz_list() TO authenticated;
