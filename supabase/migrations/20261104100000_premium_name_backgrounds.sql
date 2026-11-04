/*
# Premium name backgrounds — gem-priced nameplates for the student dashboard

Second cosmetic slot, same rails as the avatars migration (20261104090000):
a server-priced catalog, an ownership table, an equip RPC that validates
ownership, and a student column that students themselves cannot write.

Prices escalate with rarity — uncommon 10, rare 25, epic 50/80 — so the
"more premium, more expensive" ladder the teacher asked for is visible in
both the shop and the server checks.

Deliberately dashboard-only: the equipped nameplate renders on the
student's own dashboard header, not in the teacher roster — the roster is
a work surface and must stay scannable.

Free tier ("none") is the plain name, so no one's name looks worse than it
does today and nothing is lost by not purchasing.
*/

-- ===== 1. Catalog (server-side source of truth for prices) ==================

CREATE TABLE IF NOT EXISTS public.name_bg_catalog (
  id text PRIMARY KEY,
  name text NOT NULL,
  rarity text NOT NULL CHECK (rarity IN ('free', 'uncommon', 'rare', 'epic')),
  price integer NOT NULL CHECK (price >= 0),
  sort_order integer NOT NULL DEFAULT 0
);

INSERT INTO public.name_bg_catalog (id, name, rarity, price, sort_order) VALUES
  ('none',    'Classic', 'free',      0,  0),
  ('skyline', 'Skyline', 'uncommon', 10,  1),
  ('meadow',  'Meadow',  'uncommon', 10,  2),
  ('blush',   'Blush',   'uncommon', 10,  3),
  ('slate',   'Slate',   'uncommon', 10,  4),
  ('sunset',  'Sunset',  'rare',     25,  5),
  ('ocean',   'Ocean',   'rare',     25,  6),
  ('forest',  'Forest',  'rare',     25,  7),
  ('gilded',  'Gilded',  'epic',     50,  8),
  ('royal',   'Royal',   'epic',     80,  9)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      rarity = EXCLUDED.rarity,
      price = EXCLUDED.price,
      sort_order = EXCLUDED.sort_order;

ALTER TABLE public.name_bg_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_name_bg_catalog" ON public.name_bg_catalog;
CREATE POLICY "read_name_bg_catalog" ON public.name_bg_catalog
  FOR SELECT TO authenticated USING (true);

-- ===== 2. Ownership table ===================================================

CREATE TABLE IF NOT EXISTS public.student_name_backgrounds (
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  name_bg_id text NOT NULL REFERENCES public.name_bg_catalog(id) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, name_bg_id)
);

CREATE INDEX IF NOT EXISTS idx_student_name_bgs_student
  ON public.student_name_backgrounds(student_id);

ALTER TABLE public.student_name_backgrounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_read_own_name_bgs" ON public.student_name_backgrounds;
CREATE POLICY "student_read_own_name_bgs" ON public.student_name_backgrounds
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT s.id FROM public.students s WHERE s.user_id = auth.uid())
  );

-- No write policies or grants: the RPCs are the only writers.

-- ===== 3. Equipped nameplate on students ====================================

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS equipped_name_bg text NOT NULL DEFAULT 'none';

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_equipped_name_bg_fk;
ALTER TABLE public.students ADD CONSTRAINT students_equipped_name_bg_fk
  FOREIGN KEY (equipped_name_bg) REFERENCES public.name_bg_catalog(id);

-- NOTE: no change to the UPDATE column grant — equipped_name_bg, like
-- display_name, is deliberately NOT student-writable. Only the RPC sets it.

-- ===== 4. students_safe: expose the equipped nameplate ======================

DROP VIEW IF EXISTS public.students_safe;

CREATE VIEW public.students_safe
WITH (security_invoker = true) AS
SELECT
  s.id,
  s.display_name,
  s.avatar_emoji,
  s.avatar_color,
  s.equipped_avatar,
  s.equipped_name_bg,
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

-- ===== 5. buy_name_background — server-priced, locked, idempotent ==========

CREATE OR REPLACE FUNCTION public.buy_name_background(p_name_bg_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_student public.students;
  v_item public.name_bg_catalog;
  v_balance int;
  v_already boolean;
BEGIN
  IF auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL THEN
    RAISE EXCEPTION 'Only students can buy name styles';
  END IF;

  -- Lock the student row: serialises concurrent purchases.
  SELECT * INTO v_student FROM public.students WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No student record for this session';
  END IF;

  SELECT * INTO v_item FROM public.name_bg_catalog WHERE id = p_name_bg_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That name style does not exist';
  END IF;
  IF v_item.price <= 0 THEN
    RAISE EXCEPTION 'That name style is free — just equip it';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.student_name_backgrounds
    WHERE student_id = v_student.id AND name_bg_id = p_name_bg_id
  ) INTO v_already;
  IF v_already THEN
    RAISE EXCEPTION 'You already own this name style';
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO v_balance
  FROM public.point_transactions
  WHERE student_id = v_student.id AND is_undone = false AND type = 'achievement';

  IF v_balance < v_item.price THEN
    RAISE EXCEPTION 'Not enough gems for this name style';
  END IF;

  INSERT INTO public.point_transactions (student_id, type, amount, reason, class_id)
  VALUES (v_student.id, 'achievement', -v_item.price, 'Name style: ' || v_item.name, v_student.class_id);

  INSERT INTO public.student_name_backgrounds (student_id, name_bg_id)
  VALUES (v_student.id, p_name_bg_id);

  RETURN jsonb_build_object(
    'name_bg_id', p_name_bg_id,
    'price', v_item.price,
    'gems_remaining', v_balance - v_item.price
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.buy_name_background(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_name_background(text) TO authenticated;

-- ===== 6. equip_name_background — ownership enforced server-side ============

CREATE OR REPLACE FUNCTION public.equip_name_background(p_name_bg_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_student public.students;
  v_is_free boolean;
  v_owns boolean;
BEGIN
  IF auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL THEN
    RAISE EXCEPTION 'Only students can equip name styles';
  END IF;

  SELECT * INTO v_student FROM public.students WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No student record for this session';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.name_bg_catalog WHERE id = p_name_bg_id) THEN
    RAISE EXCEPTION 'That name style does not exist';
  END IF;

  SELECT (price = 0) INTO v_is_free FROM public.name_bg_catalog WHERE id = p_name_bg_id;

  IF NOT v_is_free THEN
    SELECT EXISTS (
      SELECT 1 FROM public.student_name_backgrounds
      WHERE student_id = v_student.id AND name_bg_id = p_name_bg_id
    ) INTO v_owns;
    IF NOT v_owns THEN
      RAISE EXCEPTION 'You do not own this name style yet';
    END IF;
  END IF;

  UPDATE public.students SET equipped_name_bg = p_name_bg_id WHERE id = v_student.id;

  RETURN p_name_bg_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.equip_name_background(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.equip_name_background(text) TO authenticated;