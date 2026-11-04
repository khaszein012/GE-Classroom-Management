/*
# Realtime for the students table

Cosmetic purchases (avatars, name styles) write to `students` — but the
table was not in the realtime publication, so the teacher console never
heard about it: a student could buy and equip a new look and the teacher's
roster kept showing the old one until a manual refresh.

Adding `students` to supabase_realtime lets the teacher console refetch the
roster the moment any student changes. Realtime respects RLS, so students
still only ever receive events for rows they are allowed to read (their own
student-read policy); the teacher session reads all rows.

Idempotent, matching the guard pattern used for the other tables.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'students'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
  END IF;
END $$;