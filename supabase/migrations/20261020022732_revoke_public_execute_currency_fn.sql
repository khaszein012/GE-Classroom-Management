/*
# Tighten EXECUTE grants on class_behavior_currency()

The security linter flagged that public.class_behavior_currency() was
executable by anon (Postgres grants EXECUTE on functions to PUBLIC by default).
The function intentionally exposes only the class currency display config
(name/icon/color) to signed-in users, so:

- REVOKE EXECUTE from PUBLIC and anon (closing the anonymous route).
- Keep the explicit GRANT to authenticated, which the students_safe view and
  the student home screen rely on.

No data changes. Idempotent.
*/

REVOKE EXECUTE ON FUNCTION public.class_behavior_currency() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.class_behavior_currency() FROM anon;
GRANT EXECUTE ON FUNCTION public.class_behavior_currency() TO authenticated;
