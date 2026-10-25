/*
# Phase 6.2: Gem-priced rewards — two sealed currencies

## What this adds
Rewards can now be priced in Dollars or Gems. Gems become spendable, tracked
as two figures: gems_balance (spendable) and gems_lifetime (achievement
score, never reduced by spending).

## Schema changes (all additive)
- `rewards.currency` — 'dollars' | 'gems', default 'dollars'. Every existing
  reward stays a dollar reward, unchanged.
- `redemptions.currency` — snapshot of the reward's currency at request
  time (like cost_at_request), so history stays truthful even if a reward's
  price or currency later changes. All historical rows are dollars.
- `students.goal_currency` — 'dollars' | 'gems' | NULL, so a personal goal
  can target either currency. Added to the student's column-level goal
  grant (goal_target, goal_label, goal_currency remain the only
  student-writable goal columns).

## Currency guard
- BEFORE UPDATE trigger on `rewards`: changing `currency` while any pending
  request exists for that reward raises with a plain-English message, so a
  pending "15 Gems" request can never morph into a "15 Dollars" one.

## students_safe (rebuilt)
- `balance` / `lifetime_earned` — behavior-currency only (unchanged rule:
  exclude achievement rows).
- `gems_balance` — spendable gems: sum of achievement rows (quiz awards
  minus gem spends), is_undone = false.
- `gems_lifetime` — lifetime gems: sum of POSITIVE achievement rows only,
  so spending never reduces it.
- `goal_currency` exposed alongside goal_target / goal_label.

## RPC changes (request_reward, approve_redemption)
Both re-issued currency-aware:
- Pending-request totals are summed per currency, so a pending dollar
  request never eats into gem headroom or vice versa.
- Affordability is checked against the matching balance: dollars →
  sum(type <> 'achievement'); gems → sum(type = 'achievement').
- Approval spends in the reward's own currency: dollars insert a negative
  'spend' transaction, gems insert a negative 'achievement' transaction.
  decline_redemption and undo_redemption need no change: undo refunds by
  marking the linked transaction undone, and that transaction already
  carries the right currency — refunds always return the original
  currency.

No conversion path exists anywhere: no exchange, transfer, or top-up
function is created, and the two balances are never summed.

All statements idempotent.
*/

-- ===== 1. Columns ==========================================================

ALTER TABLE public.rewards ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'dollars';
ALTER TABLE public.rewards DROP CONSTRAINT IF EXISTS rewards_currency_check;
ALTER TABLE public.rewards ADD CONSTRAINT rewards_currency_check
  CHECK (currency IN ('dollars','gems'));

ALTER TABLE public.redemptions ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'dollars';
ALTER TABLE public.redemptions DROP CONSTRAINT IF EXISTS redemptions_currency_check;
ALTER TABLE public.redemptions ADD CONSTRAINT redemptions_currency_check
  CHECK (currency IN ('dollars','gems'));

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS goal_currency text;
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_goal_currency_check;
ALTER TABLE public.students ADD CONSTRAINT students_goal_currency_check
  CHECK (goal_currency IS NULL OR goal_currency IN ('dollars','gems'));

-- Students may write their own goal currency alongside the other goal fields.
REVOKE UPDATE ON public.students FROM authenticated;
GRANT UPDATE (pin_hash, failed_attempts, locked_until, class_id, goal_target, goal_label, goal_currency)
  ON public.students TO authenticated;

-- ===== 2. Currency-change guard ============================================

CREATE OR REPLACE FUNCTION public.rewards_guard_currency_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.currency IS DISTINCT FROM NEW.currency AND EXISTS (
    SELECT 1 FROM public.redemptions r
    WHERE r.reward_id = OLD.id AND r.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'This reward has pending requests, so its currency cannot change until they are decided';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_rewards_guard_currency ON public.rewards;
CREATE TRIGGER trg_rewards_guard_currency
  BEFORE UPDATE ON public.rewards
  FOR EACH ROW
  EXECUTE FUNCTION public.rewards_guard_currency_change();

-- ===== 3. students_safe: split gems figures ================================

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

-- ===== 4. Currency-aware shop RPCs =========================================

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

  -- Pending requests may never jointly exceed the balance IN THE SAME
  -- currency; dollars and gems never borrow from each other.
  SELECT COALESCE(sum(cost_at_request), 0) INTO v_pending_total
  FROM public.redemptions
  WHERE student_id = v_student.id
    AND status = 'pending'
    AND currency = v_reward.currency;

  IF v_reward.currency = 'gems' THEN
    SELECT COALESCE(sum(amount), 0) INTO v_balance
    FROM public.point_transactions
    WHERE student_id = v_student.id AND is_undone = false AND type = 'achievement';
  ELSE
    SELECT COALESCE(sum(amount), 0) INTO v_balance
    FROM public.point_transactions
    WHERE student_id = v_student.id AND is_undone = false AND type <> 'achievement';
  END IF;

  IF v_balance < v_pending_total + v_reward.cost THEN
    IF v_reward.currency = 'gems' THEN
      RAISE EXCEPTION 'Not enough gems for this reward';
    ELSE
      RAISE EXCEPTION 'Not enough points for this reward';
    END IF;
  END IF;

  INSERT INTO public.redemptions (student_id, reward_id, cost_at_request, status, currency)
  VALUES (v_student.id, p_reward_id, v_reward.cost, 'pending', v_reward.currency)
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

  -- Affordability against the matching, sealed balance.
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

  -- Spend in the reward's own currency. Gem spends are negative
  -- achievement rows, so every existing gems computation stays consistent.
  INSERT INTO public.point_transactions (student_id, type, amount, reason, behavior_id, redemption_id)
  VALUES (
    v_r.student_id,
    CASE WHEN v_r.currency = 'gems' THEN 'achievement' ELSE 'spend' END,
    -v_r.cost_at_request,
    'Redeemed: ' || v_reward.name,
    NULL,
    v_r.id
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
