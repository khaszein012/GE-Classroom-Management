/*
# Cosmetic price administration (teacher-only)

The premium avatar and name-style catalogs live in avatar_catalog and
name_bg_catalog, and the buy RPCs validate prices against them. Prices were
only changeable via SQL — this gives the teacher console a price editor.

SECURITY: the catalog tables have no UPDATE policy, and granting one would
let students change prices (they share the `authenticated` role — the same
reason display_name/equipped_avatar are RPC-gated). So price writes go
through these SECURITY DEFINER RPCs, which check the teacher claim and
bound the price to a sane range.

The STUDENT shop reads prices from these tables at load time, so a change
here applies to what students see and what the server charges — one source
of truth. New styles still ship through migrations (their visual art lives
in the client); this only tunes prices.
*/

-- ===== 1. update_avatar_price ===============================================

CREATE OR REPLACE FUNCTION public.update_avatar_price(p_id text, p_price integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.jwt() -> 'app_metadata' ->> 'student_id' IS NOT NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_price IS NULL OR p_price < 0 OR p_price > 1000000 THEN
    RAISE EXCEPTION 'Price must be between 0 and 1,000,000';
  END IF;

  UPDATE public.avatar_catalog SET price = p_price WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That avatar style does not exist';
  END IF;

  RETURN p_price;
END $$;

REVOKE EXECUTE ON FUNCTION public.update_avatar_price(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_avatar_price(text, integer) TO authenticated;

-- ===== 2. update_name_bg_price ==============================================

CREATE OR REPLACE FUNCTION public.update_name_bg_price(p_id text, p_price integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.jwt() -> 'app_metadata' ->> 'student_id' IS NOT NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_price IS NULL OR p_price < 0 OR p_price > 1000000 THEN
    RAISE EXCEPTION 'Price must be between 0 and 1,000,000';
  END IF;

  UPDATE public.name_bg_catalog SET price = p_price WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That name style does not exist';
  END IF;

  RETURN p_price;
END $$;

REVOKE EXECUTE ON FUNCTION public.update_name_bg_price(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_name_bg_price(text, integer) TO authenticated;