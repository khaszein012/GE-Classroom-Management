/*
# Phase 4: Reward shop — rewards, redemptions, server-side request/decision logic

## What this adds
A shop where students spend their points on rewards, and where the teacher
manages the shop and decides requests.

## New tables
- `rewards` — items the teacher puts up for sale.
  - `id` uuid PK, `name` text (1-80 chars), `description` text (nullable)
  - `cost` integer >= 1 (points price)
  - `stock` integer >= 0, NULL = unlimited
  - `is_active` boolean (inactive items stay in the teacher list, hidden from students)
  - `is_archived` boolean (archived instead of deleted, so history is kept)
  - `sort_order` integer, `created_at`
- `redemptions` — one row per student request.
  - `id` uuid PK, `student_id` FK students, `reward_id` FK rewards
  - `cost_at_request` integer >= 1 — snapshot of the price when requested;
    later price changes never affect existing requests
  - `status` in ('pending','approved','declined','cancelled'), default 'pending'
  - `requested_at`, `decided_at` (nullable), `note` (teacher's optional note)
  - Indexes on `student_id` and `status` (also `reward_id`).

## Modified table
- `point_transactions`: new nullable `redemption_id` column (FK redemptions) so an
  approval's spend transaction can be found and refunded exactly on undo.
  Purely additive; existing rows keep NULL.

## Security model (unchanged roles: teacher = no student claim, student = claim)
- `rewards`: teacher full CRUD via teacher-only policies. Students get a SELECT
  policy limited to active, non-archived rows — and NO write policy at all.
- `redemptions`: table grants are the first defense:
  - anon: nothing. authenticated: SELECT + UPDATE(status) ONLY.
  - No INSERT/DELETE grant for anyone — every write goes through a
    SECURITY DEFINER function below, which re-checks the caller.
  - Student SELECT policy: own rows only. Teacher SELECT policy: all rows.
  - Student UPDATE policy: own pending -> cancelled ONLY (WITH CHECK pins
    status='cancelled'), so a student can never set approved/declined, never
    touch cost, stock, note, decided_at, or another student's request.
- Server-side functions (all SECURITY DEFINER, search_path pinned,
  EXECUTE revoked from PUBLIC and anon):
  - `request_reward(reward_id)` — student-only. Derives the student from the
    session (never a parameter), snapshots the CURRENT price server-side,
    refuses inactive/archived rewards, refuses a second pending request for
    the same reward, and refuses when balance < current pending total + cost
    (so two pending requests can never jointly exceed the balance).
    Creates a pending redemption. No points are deducted.
  - `approve_redemption(id, note)` — teacher-only. Locks the request and the
    student row, then atomically: verifies pending status, verifies stock,
    verifies the balance still covers cost_at_request, inserts a negative
    `spend` point_transaction ("Redeemed: <name>") linked via redemption_id,
    decrements stock (unless unlimited), sets approved + decided_at + note.
    Any failure raises and approves nothing.
  - `decline_redemption(id, note)` — teacher-only. Pending -> declined.
    Never touches points or stock.
  - `undo_redemption(id)` — teacher-only. Approved -> cancelled, marks the
    linked spend transaction undone (refund), restores stock if not
    unlimited. Idempotent-safe if the spend was already undone manually.
- `decided_at` is auto-filled by a BEFORE UPDATE trigger on the pending ->
  decided transitions (so student cancels and teacher RPCs both stay consistent).

## Realtime
`rewards` and `redemptions` added to `supabase_realtime` (Realtime enforces
RLS: students receive only their own redemption rows, teachers receive all).

## Seed
Three example rewards inserted only if the table is empty:
Homework pass (25, unlimited), Choose the music (15, stock 3),
Canteen voucher (100, stock 1).

All statements idempotent (IF NOT EXISTS guards, DROP POLICY IF EXISTS,
CREATE OR REPLACE, DROP TRIGGER IF EXISTS).
*/

-- ===== 1. Tables ============================================================

CREATE TABLE IF NOT EXISTS public.rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) >= 1 AND length(name) <= 80),
  description text,
  cost integer NOT NULL CHECK (cost >= 1),
  stock integer CHECK (stock IS NULL OR stock >= 0),
  is_active boolean NOT NULL DEFAULT true,
  is_archived boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES public.rewards(id),
  cost_at_request integer NOT NULL CHECK (cost_at_request >= 1),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  note text
);

CREATE INDEX IF NOT EXISTS idx_redemptions_student ON public.redemptions(student_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_status ON public.redemptions(status);
CREATE INDEX IF NOT EXISTS idx_redemptions_reward ON public.redemptions(reward_id);

ALTER TABLE public.point_transactions ADD COLUMN IF NOT EXISTS redemption_id uuid REFERENCES public.redemptions(id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_redemption
  ON public.point_transactions(redemption_id) WHERE redemption_id IS NOT NULL;

ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;

-- ===== 2. Grants (column level — the first gate) ===========================

REVOKE ALL ON public.rewards FROM anon;
REVOKE ALL ON public.redemptions FROM anon;
REVOKE ALL ON public.redemptions FROM authenticated;

-- Rewards: full CRUD for the authenticated role, but RLS below denies every
-- write for student sessions (no student write policy exists on rewards).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rewards TO authenticated;

-- Redemptions: reads are policy-scoped (teacher: all; student: own rows).
GRANT SELECT ON public.redemptions TO authenticated;
-- Students may cancel their own pending request — and ONLY the status column;
-- the policy's WITH CHECK pins the new value to 'cancelled'.
GRANT UPDATE (status) ON public.redemptions TO authenticated;
-- No INSERT/DELETE grant for any role: requests and decisions are made
-- exclusively by the SECURITY DEFINER functions.

-- ===== 3. Policies =========================================================

DROP POLICY IF EXISTS "teacher_read_rewards" ON public.rewards;
CREATE POLICY "teacher_read_rewards" ON public.rewards
  FOR SELECT TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_insert_rewards" ON public.rewards;
CREATE POLICY "teacher_insert_rewards" ON public.rewards
  FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_update_rewards" ON public.rewards;
CREATE POLICY "teacher_update_rewards" ON public.rewards
  FOR UPDATE TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL)
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "teacher_delete_rewards" ON public.rewards;
CREATE POLICY "teacher_delete_rewards" ON public.rewards
  FOR DELETE TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

-- Students see the shop: active, non-archived rewards only. No other access.
DROP POLICY IF EXISTS "student_read_active_rewards" ON public.rewards;
CREATE POLICY "student_read_active_rewards" ON public.rewards
  FOR SELECT TO authenticated
  USING (is_active AND NOT is_archived);

DROP POLICY IF EXISTS "teacher_read_redemptions" ON public.redemptions;
CREATE POLICY "teacher_read_redemptions" ON public.redemptions
  FOR SELECT TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL);

DROP POLICY IF EXISTS "student_read_own_redemptions" ON public.redemptions;
CREATE POLICY "student_read_own_redemptions" ON public.redemptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = redemptions.student_id AND s.user_id = auth.uid()
    )
  );

-- A student may move ONLY their OWN PENDING request to cancelled. The
-- WITH CHECK pins the resulting status, so approving via this path is
-- impossible, and other columns are blocked by the column grant above.
DROP POLICY IF EXISTS "student_cancel_own_pending" ON public.redemptions;
CREATE POLICY "student_cancel_own_pending" ON public.redemptions
  FOR UPDATE TO authenticated
  USING (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = redemptions.student_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    status = 'cancelled'
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = redemptions.student_id AND s.user_id = auth.uid()
    )
  );

-- ===== 4. decided_at trigger ==============================================

CREATE OR REPLACE FUNCTION public.redemptions_set_decided_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status <> 'pending' AND NEW.decided_at IS NULL THEN
    NEW.decided_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_redemptions_decided_at ON public.redemptions;
CREATE TRIGGER trg_redemptions_decided_at
  BEFORE UPDATE ON public.redemptions
  FOR EACH ROW WHEN (OLD.status = 'pending')
  EXECUTE FUNCTION public.redemptions_set_decided_at();

-- ===== 5. Server-side functions ============================================

-- Student requests a reward. Price snapshot and all checks server-side.
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
  -- Students only; a teacher session must never create requests.
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

  -- One pending request per reward per student.
  IF EXISTS (
    SELECT 1 FROM public.redemptions
    WHERE student_id = v_student.id AND reward_id = p_reward_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending request for this reward';
  END IF;

  -- Pending requests may never jointly exceed the balance.
  SELECT COALESCE(sum(cost_at_request), 0) INTO v_pending_total
  FROM public.redemptions
  WHERE student_id = v_student.id AND status = 'pending';

  SELECT COALESCE(sum(amount), 0) INTO v_balance
  FROM public.point_transactions
  WHERE student_id = v_student.id AND is_undone = false;

  IF v_balance < v_pending_total + v_reward.cost THEN
    RAISE EXCEPTION 'Not enough points for this reward';
  END IF;

  INSERT INTO public.redemptions (student_id, reward_id, cost_at_request, status)
  VALUES (v_student.id, p_reward_id, v_reward.cost, 'pending')
  RETURNING * INTO v_out;

  RETURN v_out;
END;
$$;

-- Teacher approves: one atomic operation, all checks re-run at decide time.
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

  -- Serialize per student: concurrent approvals cannot double-spend.
  PERFORM 1 FROM public.students WHERE id = v_r.student_id FOR UPDATE;

  SELECT * INTO v_reward FROM public.rewards WHERE id = v_r.reward_id FOR UPDATE;
  IF v_reward.stock IS NOT NULL AND v_reward.stock < 1 THEN
    RAISE EXCEPTION 'This reward is out of stock';
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO v_balance
  FROM public.point_transactions
  WHERE student_id = v_r.student_id AND is_undone = false;
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
END;
$$;

-- Teacher declines: status only, never points, never stock.
CREATE OR REPLACE FUNCTION public.decline_redemption(p_id uuid, p_note text DEFAULT NULL)
RETURNS public.redemptions
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_r public.redemptions;
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

  v_clean_note := CASE WHEN p_note IS NULL OR btrim(p_note) = '' THEN NULL ELSE btrim(p_note) END;

  UPDATE public.redemptions
    SET status = 'declined', decided_at = now(), note = v_clean_note
    WHERE id = v_r.id
    RETURNING * INTO v_out;

  RETURN v_out;
END;
$$;

-- Teacher undoes an approval: refund the points, restore stock, cancel.
CREATE OR REPLACE FUNCTION public.undo_redemption(p_id uuid)
RETURNS public.redemptions
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_r public.redemptions;
  v_tx uuid;
  v_out public.redemptions;
BEGIN
  IF auth.jwt() -> 'app_metadata' ->> 'student_id' IS NOT NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_r FROM public.redemptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF v_r.status <> 'approved' THEN
    RAISE EXCEPTION 'Only approvals can be undone';
  END IF;

  -- Refund: mark the linked spend transaction undone (it stops counting
  -- toward the balance, exactly like a teacher undo in the activity log).
  SELECT id INTO v_tx FROM public.point_transactions
    WHERE redemption_id = p_id AND is_undone = false
    FOR UPDATE;
  IF v_tx IS NOT NULL THEN
    UPDATE public.point_transactions SET is_undone = true WHERE id = v_tx;
  END IF;

  -- Restore stock unless the reward is unlimited.
  UPDATE public.rewards SET stock = stock + 1
    WHERE id = v_r.reward_id AND stock IS NOT NULL;

  UPDATE public.redemptions
    SET status = 'cancelled', decided_at = now()
    WHERE id = p_id
    RETURNING * INTO v_out;

  RETURN v_out;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_reward(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_redemption(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.decline_redemption(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.undo_redemption(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_reward(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_redemption(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_redemption(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_redemption(uuid) TO authenticated;

-- ===== 6. Realtime =========================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rewards'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rewards;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'redemptions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.redemptions;
  END IF;
END $$;

-- ===== 7. Seed (only when the shop is empty) ===============================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.rewards) THEN
    INSERT INTO public.rewards (name, description, cost, stock, sort_order) VALUES
      ('Homework pass', 'Skip one homework assignment, no questions asked.', 25, NULL, 1),
      ('Choose the music', 'Pick the soundtrack for the next work session.', 15, 3, 2),
      ('Canteen voucher', 'A voucher for the school canteen.', 100, 1, 3);
  END IF;
END $$;
