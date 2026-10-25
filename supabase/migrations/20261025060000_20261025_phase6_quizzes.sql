/*
# Phase 6: Quizzes — tables, RLS, safe student reads, server-side scoring

## What this adds
Teacher-built quizzes (multiple choice + true/false) assigned to students.
One attempt per student per quiz, answers saved as they are selected,
scoring and gem awarding entirely server-side.

## New tables
- `quizzes` — title, optional description, max_gems (default 10), due_at,
  status ('draft' | 'published' | 'closed'), created_at.
- `quiz_questions` — quiz_id, body, type ('multiple_choice' | 'true_false'),
  position.
- `quiz_options` — question_id, body, is_correct, position.
- `quiz_assignments` — quiz_id, student_id (unique pair).
- `quiz_attempts` — quiz_id, student_id, started_at, submitted_at,
  correct_count, total_count, gems_awarded. UNIQUE (quiz_id, student_id)
  enforces one attempt per student per quiz.
- `quiz_answers` — attempt_id, question_id, selected_option_id, answered_at.
  UNIQUE (attempt_id, question_id) so answers upsert cleanly.

## Security model (same roles as before: teacher = no student claim)
- Teacher (JWT app_metadata.student_id IS NULL): full CRUD on all six tables.
- Students:
  - May SELECT a quiz row only when it is published, assigned to them, and
    either not yet due or they already have an attempt on it (so an
    in-progress student can resume past the due date).
  - Have NO policy at all on quiz_questions / quiz_options / quiz_assignments:
    direct reads return nothing. Questions and options reach students only
    through `my_quiz_questions()`, which NEVER emits is_correct — the correct
    flag cannot be obtained from any network response before (or even after)
    submission; post-submit review comes from `my_attempt_review()`.
  - quiz_attempts: SELECT own rows; INSERT allowed only on the two columns
    (quiz_id, student_id) via a column-level grant, and only when the quiz is
    published, assigned to them and not overdue. No UPDATE grant exists for
    anyone: submitted_at / correct_count / total_count / gems_awarded are
    written exclusively by `submit_quiz_attempt()` (SECURITY DEFINER).
  - quiz_answers: SELECT own attempt's rows; INSERT/UPDATE (column-limited)
    only while the attempt is open (unsubmitted), the quiz is still
    published, and the option belongs to the question being answered.
  - The quiz list students see (`my_quiz_list()`) additionally includes
    closed/overdue assigned quizzes with title/due/count/my-attempt only —
    that minimal metadata is what the "Missed" card renders; questions and
    options of such quizzes stay invisible.

## Server functions (all SECURITY DEFINER, search_path pinned, EXECUTE
   revoked from PUBLIC and anon, granted to authenticated)
- Helpers used by policies: quiz_student_id(), student_quiz_readable(),
  student_quiz_startable(), student_attempt_open(), student_attempt_mine(),
  student_answer_ok().
- `my_quiz_list()` — the signed-in student's assigned, non-draft quizzes with
  question count and their own attempt summary.
- `my_quiz_questions(p_quiz_id)` — questions + options without is_correct.
- `my_attempt_review(p_attempt_id)` — own SUBMITTED attempt only: per
  question their answer, the correct answer, and whether they were right.
- `submit_quiz_attempt(p_attempt_id)` — locks the attempt, refuses closed
  quizzes, computes correct_count / total_count, awards
  round(correct / total * max_gems) achievement gems as a point_transaction
  ("Quiz: <title>"), marks submitted — all in one transaction. Idempotent:
  a repeated call returns the recorded result and never awards twice.

## Gems are separate from the behavior currency
- `students_safe` is rebuilt: balance and lifetime_earned now EXCLUDE
  type='achievement' rows; a new gems_earned column sums exactly those rows.
  The goal, the shop balance display and every existing total are therefore
  untouched by gems.
- `request_reward()` and `approve_redemption()` now compute spendable
  balance excluding achievement rows — gems can never be spent in the shop.
- New `class_achievement_currency()` exposes only the achievement currency
  display settings to student sessions.

All statements idempotent (IF EXISTS / CREATE OR REPLACE guards).
*/

-- ===== 1. Tables ============================================================

CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) >= 1 AND length(title) <= 120),
  description text,
  max_gems integer NOT NULL DEFAULT 10 CHECK (max_gems >= 1 AND max_gems <= 1000),
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(btrim(body)) >= 1),
  type text NOT NULL CHECK (type IN ('multiple_choice','true_false')),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(btrim(body)) >= 1),
  is_correct boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  correct_count integer CHECK (correct_count IS NULL OR correct_count >= 0),
  total_count integer CHECK (total_count IS NULL OR total_count >= 0),
  gems_awarded integer CHECK (gems_awarded IS NULL OR gems_awarded >= 0),
  UNIQUE (quiz_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  selected_option_id uuid NOT NULL REFERENCES public.quiz_options(id) ON DELETE CASCADE,
  answered_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON public.quiz_questions(quiz_id, position);
CREATE INDEX IF NOT EXISTS idx_quiz_options_question ON public.quiz_options(question_id, position);
CREATE INDEX IF NOT EXISTS idx_quiz_assignments_quiz ON public.quiz_assignments(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_assignments_student ON public.quiz_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON public.quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student ON public.quiz_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_attempt ON public.quiz_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_answers_question ON public.quiz_answers(question_id);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;

-- ===== 2. Grants ============================================================

REVOKE ALL ON public.quizzes FROM anon;
REVOKE ALL ON public.quiz_questions FROM anon;
REVOKE ALL ON public.quiz_options FROM anon;
REVOKE ALL ON public.quiz_assignments FROM anon;
REVOKE ALL ON public.quiz_attempts FROM anon;
REVOKE ALL ON public.quiz_answers FROM anon;

-- quizzes / questions / options / assignments keep the default authenticated
-- grants: RLS gives students zero rows (no student policy exists on them).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_options TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_assignments TO authenticated;

-- quiz_attempts: students may read (policy: own) and start an attempt, but
-- ONLY by providing quiz_id + student_id. Every other column — including
-- submitted_at, correct_count, total_count, gems_awarded — is outside the
-- INSERT grant, and there is no UPDATE grant at all: those columns are
-- written exclusively by submit_quiz_attempt() as the table owner.
GRANT SELECT, DELETE ON public.quiz_attempts TO authenticated;
GRANT INSERT (quiz_id, student_id) ON public.quiz_attempts TO authenticated;

-- quiz_answers: students may read their own attempt's answers and upsert
-- (insert + update) only the option selection while the attempt is open.
GRANT SELECT, DELETE ON public.quiz_answers TO authenticated;
GRANT INSERT (attempt_id, question_id, selected_option_id) ON public.quiz_answers TO authenticated;
GRANT UPDATE (selected_option_id, answered_at) ON public.quiz_answers TO authenticated;

-- ===== 3. Policy helper functions ==========================================

-- The student id from the immutable JWT claim (NULL for the teacher).
CREATE OR REPLACE FUNCTION public.quiz_student_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'student_id', '')::uuid $$;

-- Student may READ the quiz: published, assigned to them, and either not
-- yet due or they already hold an attempt (resume / review past the due date).
CREATE OR REPLACE FUNCTION public.student_quiz_readable(p_quiz_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.quiz_student_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.quizzes z
    WHERE z.id = p_quiz_id
      AND z.status = 'published'
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

-- Student may START a new attempt: published, assigned, not overdue.
CREATE OR REPLACE FUNCTION public.student_quiz_startable(p_quiz_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.quiz_student_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.quizzes z
    WHERE z.id = p_quiz_id
      AND z.status = 'published'
      AND z.due_at > now()
      AND EXISTS (
        SELECT 1 FROM public.quiz_assignments a
        WHERE a.quiz_id = z.id AND a.student_id = public.quiz_student_id()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.student_attempt_mine(p_attempt_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.quiz_student_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.quiz_attempts t
    WHERE t.id = p_attempt_id AND t.student_id = public.quiz_student_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.student_attempt_open(p_attempt_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.quiz_student_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.quiz_attempts t
    WHERE t.id = p_attempt_id
      AND t.student_id = public.quiz_student_id()
      AND t.submitted_at IS NULL
  );
$$;

-- Full validity of an answer write: the attempt is the caller's and still
-- open, the quiz is still published (not closed), the question belongs to
-- that quiz, and the selected option belongs to that question.
CREATE OR REPLACE FUNCTION public.student_answer_ok(
  p_attempt_id uuid, p_question_id uuid, p_option_id uuid
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.quiz_student_id() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.quiz_attempts t
    JOIN public.quizzes z ON z.id = t.quiz_id AND z.status = 'published'
    JOIN public.quiz_questions q ON q.quiz_id = z.id AND q.id = p_question_id
    JOIN public.quiz_options o ON o.question_id = q.id AND o.id = p_option_id
    WHERE t.id = p_attempt_id
      AND t.student_id = public.quiz_student_id()
      AND t.submitted_at IS NULL
  );
$$;

-- ===== 4. Policies =========================================================

-- Teacher: full CRUD everywhere (same predicate style as every other table).
DROP POLICY IF EXISTS "teacher_read_quizzes" ON public.quizzes;
CREATE POLICY "teacher_read_quizzes" ON public.quizzes
  FOR SELECT TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_insert_quizzes" ON public.quizzes;
CREATE POLICY "teacher_insert_quizzes" ON public.quizzes
  FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_update_quizzes" ON public.quizzes;
CREATE POLICY "teacher_update_quizzes" ON public.quizzes
  FOR UPDATE TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL)
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_delete_quizzes" ON public.quizzes;
CREATE POLICY "teacher_delete_quizzes" ON public.quizzes
  FOR DELETE TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

-- Students: read a quiz only when readable per the helper above.
DROP POLICY IF EXISTS "student_read_assigned_quizzes" ON public.quizzes;
CREATE POLICY "student_read_assigned_quizzes" ON public.quizzes
  FOR SELECT TO authenticated
  USING (public.student_quiz_readable(id));

-- quiz_questions / quiz_options / quiz_assignments: teacher only. Students
-- have NO policy, so direct reads return nothing and drafts can never leak.
DROP POLICY IF EXISTS "teacher_read_quiz_questions" ON public.quiz_questions;
CREATE POLICY "teacher_read_quiz_questions" ON public.quiz_questions
  FOR SELECT TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_write_quiz_questions" ON public.quiz_questions;
CREATE POLICY "teacher_write_quiz_questions" ON public.quiz_questions
  FOR ALL TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL)
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_read_quiz_options" ON public.quiz_options;
CREATE POLICY "teacher_read_quiz_options" ON public.quiz_options
  FOR SELECT TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_write_quiz_options" ON public.quiz_options;
CREATE POLICY "teacher_write_quiz_options" ON public.quiz_options
  FOR ALL TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL)
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_all_quiz_assignments" ON public.quiz_assignments;
CREATE POLICY "teacher_all_quiz_assignments" ON public.quiz_assignments
  FOR ALL TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL)
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

-- quiz_attempts
DROP POLICY IF EXISTS "teacher_read_quiz_attempts" ON public.quiz_attempts;
CREATE POLICY "teacher_read_quiz_attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

-- Deleting a quiz or a student cascades here, so the teacher needs DELETE.
DROP POLICY IF EXISTS "teacher_delete_quiz_attempts" ON public.quiz_attempts;
CREATE POLICY "teacher_delete_quiz_attempts" ON public.quiz_attempts
  FOR DELETE TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "student_read_own_attempts" ON public.quiz_attempts;
CREATE POLICY "student_read_own_attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated
  USING (student_id = public.quiz_student_id());

DROP POLICY IF EXISTS "student_start_attempt" ON public.quiz_attempts;
CREATE POLICY "student_start_attempt" ON public.quiz_attempts
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = public.quiz_student_id()
    AND public.student_quiz_startable(quiz_id)
  );

-- quiz_answers
DROP POLICY IF EXISTS "teacher_read_quiz_answers" ON public.quiz_answers;
CREATE POLICY "teacher_read_quiz_answers" ON public.quiz_answers
  FOR SELECT TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_delete_quiz_answers" ON public.quiz_answers;
CREATE POLICY "teacher_delete_quiz_answers" ON public.quiz_answers
  FOR DELETE TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "student_read_own_answers" ON public.quiz_answers;
CREATE POLICY "student_read_own_answers" ON public.quiz_answers
  FOR SELECT TO authenticated
  USING (public.student_attempt_mine(attempt_id));

DROP POLICY IF EXISTS "student_insert_answer" ON public.quiz_answers;
CREATE POLICY "student_insert_answer" ON public.quiz_answers
  FOR INSERT TO authenticated
  WITH CHECK (public.student_answer_ok(attempt_id, question_id, selected_option_id));

DROP POLICY IF EXISTS "student_update_answer" ON public.quiz_answers;
CREATE POLICY "student_update_answer" ON public.quiz_answers
  FOR UPDATE TO authenticated
  USING (public.student_answer_ok(attempt_id, question_id, selected_option_id))
  WITH CHECK (public.student_answer_ok(attempt_id, question_id, selected_option_id));

-- ===== 5. Student-facing read functions ====================================

-- Everything the student's Quizzes tab needs in one call. Includes closed
-- and overdue assigned quizzes (minimal metadata only) so "Missed" cards can
-- render; drafts are NEVER included.
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
  ) q;
$$;

-- Questions + options for taking a quiz. NEVER includes is_correct.
CREATE OR REPLACE FUNCTION public.my_quiz_questions(p_quiz_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN public.student_quiz_readable(p_quiz_id)
    THEN COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'body', q.body,
          'type', q.type,
          'position', q.position,
          'options', (
            SELECT COALESCE(jsonb_agg(
              jsonb_build_object('id', o.id, 'body', o.body, 'position', o.position)
              ORDER BY o.position, o.created_at
            ), '[]'::jsonb)
            FROM public.quiz_options o WHERE o.question_id = q.id
          )
        )
        ORDER BY q.position, q.created_at
      )
      FROM public.quiz_questions q WHERE q.quiz_id = p_quiz_id
    ), '[]'::jsonb)
    ELSE '[]'::jsonb
  END;
$$;

-- Post-submit review, own attempt only. This is the single place a student
-- can learn correct answers, and only after submitting.
CREATE OR REPLACE FUNCTION public.my_attempt_review(p_attempt_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN public.quiz_student_id() IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.quiz_attempts t
       WHERE t.id = p_attempt_id
         AND t.student_id = public.quiz_student_id()
         AND t.submitted_at IS NOT NULL
     )
    THEN (
      SELECT jsonb_build_object(
        'attempt_id', t.id,
        'title', z.title,
        'correct_count', t.correct_count,
        'total_count', t.total_count,
        'gems_awarded', t.gems_awarded,
        'questions', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', q.id,
              'body', q.body,
              'type', q.type,
              'position', q.position,
              'my_option_id', ans.selected_option_id,
              'my_option_body', mo.body,
              'correct_option_id', co.id,
              'correct_option_body', co.body,
              'is_correct', ans.selected_option_id = co.id
            )
            ORDER BY q.position, q.created_at
          )
          FROM public.quiz_questions q
          LEFT JOIN public.quiz_answers ans
            ON ans.attempt_id = t.id AND ans.question_id = q.id
          LEFT JOIN public.quiz_options mo
            ON mo.id = ans.selected_option_id
          JOIN LATERAL (
            SELECT o.id, o.body FROM public.quiz_options o
            WHERE o.question_id = q.id AND o.is_correct
            LIMIT 1
          ) co ON true
          WHERE q.quiz_id = t.quiz_id
        ), '[]'::jsonb)
      )
      FROM public.quiz_attempts t
      JOIN public.quizzes z ON z.id = t.quiz_id
      WHERE t.id = p_attempt_id
    )
    ELSE NULL::jsonb
  END;
$$;

-- ===== 6. Scoring + gem award (server-side only) ===========================

CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(p_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_student uuid := public.quiz_student_id();
  v_attempt public.quiz_attempts;
  v_quiz public.quizzes;
  v_total int;
  v_correct int;
  v_gems int;
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'Only students can submit quizzes';
  END IF;

  -- Row lock serialises double-taps and duplicate requests.
  SELECT * INTO v_attempt FROM public.quiz_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF NOT FOUND OR v_attempt.student_id <> v_student THEN
    RAISE EXCEPTION 'Quiz attempt not found';
  END IF;

  -- Idempotent: a repeat submit returns the recorded result, never re-awards.
  IF v_attempt.submitted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'correct_count', v_attempt.correct_count,
      'total_count', v_attempt.total_count,
      'gems_awarded', v_attempt.gems_awarded,
      'already_submitted', true
    );
  END IF;

  SELECT * INTO v_quiz FROM public.quizzes WHERE id = v_attempt.quiz_id;
  IF v_quiz.status <> 'published' THEN
    RAISE EXCEPTION 'This quiz is closed and can no longer be submitted';
  END IF;

  SELECT count(*)::int INTO v_total
  FROM public.quiz_questions WHERE quiz_id = v_quiz.id;
  IF v_total = 0 THEN
    RAISE EXCEPTION 'This quiz has no questions';
  END IF;

  -- Unanswered questions simply have no row and therefore count as incorrect.
  SELECT count(*)::int INTO v_correct
  FROM public.quiz_answers ans
  JOIN public.quiz_options o
    ON o.id = ans.selected_option_id AND o.is_correct AND o.question_id = ans.question_id
  WHERE ans.attempt_id = p_attempt_id;

  v_gems := round(v_correct::numeric * v_quiz.max_gems / v_total)::int;

  UPDATE public.quiz_attempts
  SET submitted_at = now(),
      correct_count = v_correct,
      total_count = v_total,
      gems_awarded = v_gems
  WHERE id = p_attempt_id;

  -- The gems transaction: achievement type, referencing the quiz title.
  -- Achievement rows are excluded from every behavior-currency balance.
  IF v_gems > 0 THEN
    INSERT INTO public.point_transactions (student_id, type, amount, reason)
    VALUES (v_student, 'achievement', v_gems, 'Quiz: ' || v_quiz.title);
  END IF;

  RETURN jsonb_build_object(
    'correct_count', v_correct,
    'total_count', v_total,
    'gems_awarded', v_gems,
    'already_submitted', false
  );
END $$;

-- ===== 7. Function grants ==================================================

REVOKE EXECUTE ON FUNCTION public.quiz_student_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.student_quiz_readable(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.student_quiz_startable(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.student_attempt_mine(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.student_attempt_open(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.student_answer_ok(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_quiz_list() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_quiz_questions(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_attempt_review(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_quiz_attempt(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.quiz_student_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_quiz_readable(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_quiz_startable(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_attempt_mine(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_attempt_open(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_answer_ok(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_quiz_list() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_quiz_questions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_attempt_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_quiz_attempt(uuid) TO authenticated;

-- ===== 8. Gems separation ==================================================

-- Achievement currency display settings for student sessions (mirrors
-- class_behavior_currency: display metadata only, nothing sensitive).
CREATE OR REPLACE FUNCTION public.class_achievement_currency()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT achievement_currency FROM public.class_settings WHERE id = 1;
$$;

REVOKE EXECUTE ON FUNCTION public.class_achievement_currency() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_achievement_currency() TO authenticated;

-- Rebuild students_safe: behavior balances now EXCLUDE achievement rows, and
-- gems_earned (achievement rows only) is reported separately. Column order
-- preserved; new columns appended (Postgres cannot reorder view columns).
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
  COALESCE((
    SELECT sum(t.amount)::int
    FROM public.point_transactions t
    WHERE t.student_id = s.id AND t.is_undone = false AND t.type = 'achievement'
  ), 0) AS gems_earned
FROM public.students s
WHERE s.user_id = auth.uid();

GRANT SELECT ON public.students_safe TO authenticated;

-- Shop balance checks must ignore gems: patch both RPCs (full replacement,
-- identical bodies apart from the added type filter on the balance query).
CREATE OR REPLACE FUNCTION public.request_reward(p_reward_id uuid)
RETURNS public.redemptions
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_student public.students;
  v_reward public.rewards;
  v_pending_total int;
  v_balance int;
  v_out public.redemptions;
BEGIN
  IF auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL THEN
    RAISE EXCEPTION 'Only students can request rewards';
  END IF;

  SELECT * INTO v_student FROM public.students WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No student record for this session';
  END IF;

  SELECT * INTO v_reward FROM public.rewards
    WHERE id = p_reward_id AND is_active AND NOT is_archived
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This reward is not available right now';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.redemptions
    WHERE student_id = v_student.id AND reward_id = p_reward_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending request for this reward';
  END IF;

  SELECT COALESCE(sum(cost_at_request), 0) INTO v_pending_total
  FROM public.redemptions
  WHERE student_id = v_student.id AND status = 'pending';

  -- Spendable balance = behavior currency only; gems never count here.
  SELECT COALESCE(sum(amount), 0) INTO v_balance
  FROM public.point_transactions
  WHERE student_id = v_student.id AND is_undone = false AND type <> 'achievement';

  IF v_balance < v_pending_total + v_reward.cost THEN
    RAISE EXCEPTION 'Not enough points for this reward';
  END IF;

  INSERT INTO public.redemptions (student_id, reward_id, cost_at_request, status)
  VALUES (v_student.id, p_reward_id, v_reward.cost, 'pending')
  RETURNING * INTO v_out;

  RETURN v_out;
END $$;

CREATE OR REPLACE FUNCTION public.approve_redemption(p_id uuid, p_note text DEFAULT NULL)
RETURNS public.redemptions
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_r public.redemptions;
  v_reward public.rewards;
  v_balance int;
  v_clean_note text;
  v_out public.redemptions;
BEGIN
  IF auth.jwt() -> 'app_metadata' ->> 'student_id' IS NOT NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_r FROM public.redemptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF v_r.status <> 'pending' THEN
    RAISE EXCEPTION 'This request was already decided';
  END IF;

  PERFORM 1 FROM public.students WHERE id = v_r.student_id FOR UPDATE;

  SELECT * INTO v_reward FROM public.rewards WHERE id = v_r.reward_id FOR UPDATE;
  IF v_reward.stock IS NOT NULL AND v_reward.stock < 1 THEN
    RAISE EXCEPTION 'This reward is out of stock';
  END IF;

  -- Spendable balance = behavior currency only; gems never count here.
  SELECT COALESCE(sum(amount), 0) INTO v_balance
  FROM public.point_transactions
  WHERE student_id = v_r.student_id AND is_undone = false AND type <> 'achievement';
  IF v_balance < v_r.cost_at_request THEN
    RAISE EXCEPTION 'Student no longer has enough points for this reward';
  END IF;

  INSERT INTO public.point_transactions (student_id, type, amount, reason, behavior_id, redemption_id)
  VALUES (
    v_r.student_id, 'spend', -v_r.cost_at_request,
    'Redeemed: ' || v_reward.name, NULL, v_r.id
  );

  IF v_reward.stock IS NOT NULL THEN
    UPDATE public.rewards SET stock = stock - 1 WHERE id = v_reward.id;
  END IF;

  v_clean_note := CASE WHEN p_note IS NULL OR btrim(p_note) = '' THEN NULL ELSE btrim(p_note) END;

  UPDATE public.redemptions
  SET status = 'approved', decided_at = now(), note = v_clean_note
  WHERE id = v_r.id
  RETURNING * INTO v_out;

  RETURN v_out;
END $$;

REVOKE EXECUTE ON FUNCTION public.request_reward(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_redemption(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_reward(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_redemption(uuid, text) TO authenticated;
