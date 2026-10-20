/*
# Lock down anonymous access and add class_id for future multi-teacher support

1. Security changes
- Revoke ALL table privileges (SELECT, INSERT, UPDATE, DELETE) on the four app
  tables from the `anon` role. Previously `anon` held grants even though RLS
  policies only allowed `authenticated`; this removes access at the privilege
  level too, so an unauthenticated visitor can neither read nor write anything
  by any route. The `authenticated` role keeps full privileges, granted through
  RLS policies that require a valid session.

2. Schema changes (non-destructive)
- Add nullable `class_id integer` column to `students`, `behaviors`, and
  `point_transactions`, backfilled to 1 (the single class_settings row) for all
  existing rows. NO policy filters on it yet — it exists only to make a future
  multi-teacher/multi-class migration simple.
- The default class row id is guaranteed by class_settings' CHECK (id = 1).

3. Data safety
- No columns are dropped or retyped, no rows are deleted. Existing rows keep
  all data; class_id is purely additive.
- Statements are idempotent (IF EXISTS guards on the backfill DO block).

4. Notes
- RLS remains enabled on all four tables with `TO authenticated` policies only;
  the posture check after this migration verifies anon has zero grants.
*/

REVOKE ALL ON public.class_settings FROM anon;
REVOKE ALL ON public.students FROM anon;
REVOKE ALL ON public.behaviors FROM anon;
REVOKE ALL ON public.point_transactions FROM anon;

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS class_id integer;
ALTER TABLE public.behaviors ADD COLUMN IF NOT EXISTS class_id integer;
ALTER TABLE public.point_transactions ADD COLUMN IF NOT EXISTS class_id integer;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'class_id'
  ) THEN
    UPDATE public.students SET class_id = 1 WHERE class_id IS NULL;
    UPDATE public.behaviors SET class_id = 1 WHERE class_id IS NULL;
    UPDATE public.point_transactions SET class_id = 1 WHERE class_id IS NULL;
  END IF;
END $$;
