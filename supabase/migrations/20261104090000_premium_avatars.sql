/*
# Premium avatars — gem-priced cosmetics with server-validated ownership

Students can already recolour their monogram (12-colour palette). This adds
a wardrobe of designed avatar styles bought with Gems.

## Why this is not a normal shop reward

A redemption is consumed: buy once, it is spent, gone. An avatar is owned
permanently and equipped/unequipped freely. Modelling it as a reward row
would delete it on use. So ownership lives in its own table.

## Security model

- `student_avatars` is the ownership ledger. Students READ their own rows
  and have NO write grant at all — only the RPCs write it.
- `buy_avatar(id)` validates price against the SERVER-SIDE catalog table,
  re-checks the gem balance under a row lock, debits gems as an
  `achievement` transaction, and records ownership. Idempotent: buying an
  owned avatar is refused, never double-charged.
- `equip_avatar(id)` validates ownership before setting the equipped id, so
  a student cannot equip something they never bought. Equipping the free
  "monogram" style is always allowed.
- `students.equipped_avatar` is NOT in the student column grant; only
  equip_avatar() writes it. This is the same lesson as display_name —
  a column grant on a shared role would let a student set anything.

## Currency

Gems only. Tickets compete with canteen vouchers and homework passes; gems
have no other meaningful sink, and quiz achievement is exactly the right
thing to spend on a cosmetic.
*/

-- ===== 1. Catalog (server-side source of truth for prices) ==================

CREATE TABLE IF NOT EXISTS public.avatar_catalog (
  id text PRIMARY KEY,
  name text NOT NULL,
  rarity text NOT NULL CHECK (rarity IN ('free', 'uncommon', 'rare')),
  price integer NOT NULL CHECK (price >= 0),
  sort_order integer NOT NULL DEFAULT 0
);

-- Prices live on the server so a tampered client cannot name its own price.
INSERT INTO public.avatar_catalog (id, name, rarity, price, sort_order) VALUES
  ('monogram',      'Classic',       'free',      0, 0),
  ('ink-scholar',   'Ink Scholar',   'uncommon', 15, 1),
  ('sea-glass',     'Sea Glass',     'uncommon', 15, 2),
  ('ember',         'Ember',         'uncommon', 15, 3),
  ('orchid',        'Orchid',        'uncommon', 15, 4),
  ('gilded-crown',  'Gilded Crown',  'rare',     45, 5),
  ('midnight-star', 'Midnight Star', 'rare',     45, 6),
  ('jade-dragon',   'Jade Dragon',   'rare',     60, 7),
  ('solar-flare',   'Solar Flare',   'rare',     60, 8)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      rarity = EXCLUDED.rarity,
      price = EXCLUDED.price,
      sort_order = EXCLUDED.sort_order;

ALTER TABLE public.avatar_catalog ENABLE ROW LEVEL SECURITY;

-- Everyone signed in may read the catalog (it is just a price list).
DROP POLICY IF EXISTS "read_avatar_catalog" ON public.avatar_catalog;
CREATE POLICY "read_avatar_catalog" ON public.avatar_catalog
  FOR SELECT TO authenticated USING (true);

-- No insert/update/delete policies: only migrations change the catalog.

-- ===== 2. Ownership table ===================================================

CREATE TABLE IF NOT EXISTS public.student_avatars (
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  avatar_id text NOT NULL REFERENCES public.avatar_catalog(id) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (student_id, avatar_id)
);

CREATE INDEX IF NOT EXISTS idx_student_avatars_student ON public.student_avatars(student_id);

ALTER TABLE public.student_avatars ENABLE ROW LEVEL SECURITY;

-- Students see only their own wardrobe. Teachers need no access (the roster
-- renders via students.equipped_avatar, which is teacher-readable already).
DROP POLICY IF EXISTS "student_read_own_avatars" ON public.student_avatars;
CREATE POLICY "student_read_own_avatars" ON public.student_avatars
  FOR SELECT TO authenticated
  USING (
    student_id = (SELECT s.id FROM public.students s WHERE s.user_id = auth.uid())
  );

-- Deliberately NO INSERT/UPDATE/DELETE policies or grants: the RPCs
-- (SECURITY DEFINER) are the only writers.

-- ===== 3. Equipped avatar on students =======================================

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS equipped_avatar text NOT NULL DEFAULT 'monogram';

-- Loose FK so a catalog change can never brick a student row.
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_equipped_avatar_fk;
ALTER TABLE public.students ADD CONSTRAINT students_equipped_avatar_fk
  FOREIGN KEY (equipped_avatar) REFERENCES public.avatar_catalog(id);

-- Re-grant UPDATE on students, deliberately INCLUDING every previously
-- granted column but NOT equipped_avatar. Keep this list in sync with
-- 20261025090000 + 20261020043101.
REVOKE UPDATE ON public.students FROM authenticated;
GRANT UPDATE (pin_hash, failed_attempts, locked_until, class_id,
              goal_target, goal_label, goal_currency, theme, avatar_color)
  ON public.students TO authenticated;

-- ===== 4. students_safe: expose the equipped avatar =========================

DROP VIEW IF EXISTS public.students_safe;

CREATE VIEW public.students_safe
WITH (security_invoker = true) AS
SELECT
  s.id,
  s.display_name,
  s.avatar_emoji,
  s.avatar_color,
  s.equipped_avatar,
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

-- ===== 5. buy_avatar — server-priced, locked, idempotent ====================

CREATE OR REPLACE FUNCTION public.buy_avatar(p_avatar_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_student public.students;
  v_item public.avatar_catalog;
  v_balance int;
  v_already boolean;
BEGIN
  IF auth.jwt() -> 'app_metadata' ->> 'student_id' IS NULL THEN
    RAISE EXCEPTION 'Only students can buy avatars';
  END IF;

  -- Lock the student row: serialises concurrent purchases so two taps
  -- cannot both pass the balance check.
  SELECT * INTO v_student FROM public.students WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No student record for this session';
  END IF;

  SELECT * INTO v_item FROM public.avatar_catalog WHERE id = p_avatar_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That avatar does not exist';
  END IF;
  IF v_item.price <= 0 THEN
    RAISE EXCEPTION 'That avatar is free — just equip it';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.student_avatars
    WHERE student_id = v_student.id AND avatar_id = p_avatar_id
  ) INTO v_already;
  IF v_already THEN
    RAISE EXCEPTION 'You already own this avatar';
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO v_balance
  FROM public.point_transactions
  WHERE student_id = v_student.id AND is_undone = false AND type = 'achievement';

  IF v_balance < v_item.price THEN
    RAISE EXCEPTION 'Not enough gems for this avatar';
  END IF;

  -- Debit as an achievement row so it hits the gem side only. Gems spent
  -- never reduce lifetime gems (that counts positive rows only).
  INSERT INTO public.point_transactions (student_id, type, amount, reason, class_id)
  VALUES (v_student.id, 'achievement', -v_item.price, 'Avatar: ' || v_item.name, v_student.class_id);

  INSERT INTO public.student_avatars (student_id, avatar_id)
  VALUES (v_student.id, p_avatar_id);

  RETURN jsonb_build_object(
    'avatar_id', p_avatar_id,
    'price', v_item.price,
    'gems_remaining', v_balance - v_item.price
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.buy_avatar(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_avatar(text) TO authenticated;

-- ===== 6. equip_avatar — ownership enforced server-side =====================

CREATE OR REPLACE FUNCTION public.equip_avatar(p_avatar_id text)
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
    RAISE EXCEPTION 'Only students can equip avatars';
  END IF;

  SELECT * INTO v_student FROM public.students WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No student record for this session';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.avatar_catalog WHERE id = p_avatar_id) THEN
    RAISE EXCEPTION 'That avatar does not exist';
  END IF;

  SELECT (price = 0) INTO v_is_free FROM public.avatar_catalog WHERE id = p_avatar_id;

  IF NOT v_is_free THEN
    SELECT EXISTS (
      SELECT 1 FROM public.student_avatars
      WHERE student_id = v_student.id AND avatar_id = p_avatar_id
    ) INTO v_owns;
    IF NOT v_owns THEN
      RAISE EXCEPTION 'You do not own this avatar yet';
    END IF;
  END IF;

  UPDATE public.students SET equipped_avatar = p_avatar_id WHERE id = v_student.id;

  RETURN p_avatar_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.equip_avatar(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.equip_avatar(text) TO authenticated;

-- ===== 7. Backfill: everyone owns the free style ============================

INSERT INTO public.student_avatars (student_id, avatar_id)
SELECT s.id, 'monogram' FROM public.students s
ON CONFLICT DO NOTHING;