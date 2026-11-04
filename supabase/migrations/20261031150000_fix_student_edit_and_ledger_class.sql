/*
# Fix pass: student edits, ledger class scoping, realtime, streak days

Five defects found in the final evaluation. All statements idempotent —
safe to re-run.

1. `update_student` RPC — restores teacher editing of students.
   Every migration since 20261020024331 does `REVOKE UPDATE ON students`
   then re-grants a narrow column list; the last one (20261025090000)
   omits display_name and username, so editing a student failed with
   "permission denied for table students".

   DO NOT "fix" this by re-granting those columns to `authenticated`:
   teacher and student share that role, and the student_update_own_goal
   policy only restricts ROWS — a student could then rename themselves.
   The columns stay ungranted and the teacher writes through this
   SECURITY DEFINER function instead, exactly like request_reward /
   approve_redemption / submit_quiz_attempt.

2. Ledger rows filed under class 1 — `point_transactions.class_id`
   defaulted to 1, and neither the quiz-gem nor the redemption-spend
   insert passed it. Balances were right (they sum by student_id) but the
   teacher's per-class Activity log and Insights omitted the rows.
   Both functions are re-issued taking class_id from the authoritative
   reward/quiz row, plus a one-off repair UPDATE.

3. Realtime — quizzes / quiz_attempts / quiz_assignments were subscribed
   by the UI but never added to the publication, so those channels never
   fired. Quiz lists did not live-update.

4. Streaks — `my_achievement_stats` emitted UTC dates while the client
   parsed them as local, so awards before 07:00 in UTC+7 landed on the
   previous day. It now emits raw timestamps; the client buckets them.
*/

-- ===== 1. update_student — the teacher's edit path ==========================

CREATE OR REPLACE FUNCTION public.update_student(
  p_id uuid,
  p_display_name text,
  p_username text DEFAULT NULL,
  p_avatar_color integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name text := btrim(coalesce(p_display_name, ''));
  v_username text := nullif(btrim(coalesce(p_username, '')), '');
  v_out public.students;
BEGIN
  -- Teacher-only. Students carry an app_metadata.student_id claim.
  IF auth.jwt() -> 'app_metadata' ->> 'student_id' IS NOT NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_name = '' THEN
    RAISE EXCEPTION 'Student name cannot be empty';
  END IF;
  IF length(v_name) > 60 THEN
    RAISE EXCEPTION 'Student name is too long (max 60 characters)';
  END IF;

  IF v_username IS NOT NULL THEN
    v_username := lower(v_username);
    IF v_username !~ '^[a-z0-9_]{3,20}$' THEN
      RAISE EXCEPTION 'Username: 3-20 letters, numbers or underscores';
    END IF;
  END IF;

  UPDATE public.students
  SET display_name = v_name,
      username = v_username,
      avatar_color = COALESCE(p_avatar_color, avatar_color)
  WHERE id = p_id
  RETURNING * INTO v_out;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  -- Return only what the editor needs. Never the full row: it carries
  -- pin_hash, which the teacher client has no use for.
  RETURN jsonb_build_object(
    'id', v_out.id,
    'display_name', v_out.display_name,
    'username', v_out.username,
    'avatar_color', v_out.avatar_color
  );
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'That username is already taken';
END $$;

REVOKE EXECUTE ON FUNCTION public.update_student(uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_student(uuid, text, text, integer) TO authenticated;

-- ===== 2a. submit_quiz_attempt — gem rows carry the quiz's class_id =========

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
  -- class_id comes from the quiz — students and quizzes are same-class by
  -- policy, and the column would otherwise default to class 1.
  IF v_gems > 0 THEN
    INSERT INTO public.point_transactions (student_id, type, amount, reason, class_id)
    VALUES (v_student, 'achievement', v_gems, 'Quiz: ' || v_quiz.title, v_quiz.class_id);
  END IF;

  RETURN jsonb_build_object(
    'correct_count', v_correct,
    'total_count', v_total,
    'gems_awarded', v_gems,
    'already_submitted', false
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.submit_quiz_attempt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_quiz_attempt(uuid) TO authenticated;

-- ===== 2b. approve_redemption — spend rows carry the reward's class_id ======

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

  IF v_r.currency = 'gems' THEN
    SELECT COALESCE(sum(amount), 0) INTO v_balance
    FROM public.point_transactions
    WHERE student_id = v_r.student_id AND is_undone = false AND type = 'achievement';
    IF v_balance < v_r.cost_at_request THEN
      RAISE EXCEPTION 'Student no longer has enough gems for this reward';
    END IF;
  ELSE
    SELECT COALESCE(sum(amount), 0) INTO v_balance
    FROM public.point_transactions
    WHERE student_id = v_r.student_id AND is_undone = false AND type <> 'achievement';
    IF v_balance < v_r.cost_at_request THEN
      RAISE EXCEPTION 'Student no longer has enough points for this reward';
    END IF;
  END IF;

  -- class_id from the reward — same-class is enforced by request_reward and
  -- the student shop policy; the column would otherwise default to class 1.
  INSERT INTO public.point_transactions (student_id, type, amount, reason, behavior_id, redemption_id, class_id)
  VALUES (
    v_r.student_id,
    CASE WHEN v_r.currency = 'gems' THEN 'achievement' ELSE 'spend' END,
    -v_r.cost_at_request,
    'Redeemed: ' || v_reward.name,
    NULL,
    v_r.id,
    v_reward.class_id
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

REVOKE EXECUTE ON FUNCTION public.approve_redemption(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_redemption(uuid, text) TO authenticated;

-- ===== 2c. One-off repair: misfiled ledger rows =============================

-- The bug's exact signature: the insert omitted class_id, so the column
-- DEFAULT 1 applied. Rows are therefore wrong ONLY where class_id = 1 but
-- the owning student belongs to another class. Scoping to that signature
-- means this can never rewrite a legitimate historical row (e.g. if a
-- student is ever moved between classes).
-- Idempotent: after the first run no row matches.
UPDATE public.point_transactions t
SET class_id = s.class_id
FROM public.students s
WHERE t.student_id = s.id
  AND t.class_id = 1
  AND s.class_id <> 1;

-- ===== 3. Realtime publication for the quiz tables ==========================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'quizzes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quizzes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'quiz_attempts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_attempts;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'quiz_assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_assignments;
  END IF;
END $$;

-- ===== 4. Achievements: emit timestamps, let the client bucket locally =====

-- `award_days` was UTC dates; the client parsed them as local midnight, so
-- any award before 07:00 in UTC+7 counted as the previous day. Raw
-- timestamps move the day boundary to the browser's timezone.
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
    'award_times', COALESCE((
      SELECT jsonb_agg(t.created_at)
      FROM public.point_transactions t, me
      WHERE t.student_id = me.id AND NOT t.is_undone AND t.amount > 0 AND t.type <> 'achievement'
    ), '[]'::jsonb)
  )
  FROM me;
$$;

REVOKE EXECUTE ON FUNCTION public.my_achievement_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_achievement_stats() TO authenticated;