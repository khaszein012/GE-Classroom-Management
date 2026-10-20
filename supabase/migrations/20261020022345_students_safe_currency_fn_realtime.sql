/*
# Fix students_safe currency lookup + enable realtime for student live updates

1. Fix: students_safe previously CROSS JOINed class_settings. Student sessions
   have no policy on class_settings, so the join filtered every row out and
   students would have seen nothing. The currency config now comes from
   class_behavior_currency(), a SECURITY DEFINER function that returns ONLY the
   behavior-currency JSON (name/icon/color) — safe to expose, no balances,
   no other class data.

2. New function
- `class_behavior_currency()` returns jsonb, SECURITY DEFINER, STABLE,
  search_path pinned. Reads class_settings row id=1 and returns
  behavior_currency. EXECUTE granted to authenticated, revoked from anon.
  The table-level RLS on class_settings is bypassed by the definer function,
  which is intentional and harmless: it exposes only the currency display
  name/icon/color that the whole class already sees on printed cards.

3. Realtime
- Add point_transactions to the supabase_realtime publication (idempotent),
  so a signed-in student receives INSERT/UPDATE events for their own
  transactions (Realtime enforces RLS, so only their own rows are delivered).

4. Safety
- No data changes, no destructive operations.
*/

CREATE OR REPLACE FUNCTION public.class_behavior_currency()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT behavior_currency FROM public.class_settings WHERE id = 1;
$$;

REVOKE EXECUTE ON FUNCTION public.class_behavior_currency() FROM anon;
GRANT EXECUTE ON FUNCTION public.class_behavior_currency() TO authenticated;

CREATE OR REPLACE VIEW public.students_safe
WITH (security_invoker = true) AS
SELECT
  s.id,
  s.display_name,
  s.avatar_emoji,
  s.avatar_color,
  public.class_behavior_currency() AS behavior_currency,
  COALESCE((
    SELECT sum(t.amount)::int
    FROM public.point_transactions t
    WHERE t.student_id = s.id AND t.is_undone = false
  ), 0) AS balance,
  COALESCE((
    SELECT sum(t.amount)::int
    FROM public.point_transactions t
    WHERE t.student_id = s.id AND t.is_undone = false AND t.amount > 0
  ), 0) AS lifetime_earned
FROM public.students s
WHERE s.user_id = auth.uid();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'point_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.point_transactions;
  END IF;
END $$;
