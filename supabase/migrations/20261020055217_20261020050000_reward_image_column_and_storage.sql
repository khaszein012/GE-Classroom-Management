/*
# Add image_url to rewards and create reward-images storage bucket

## Summary
Adds an optional image to each reward. The teacher uploads an image
(jpg/png/webp, max 2MB) from the Rewards screen; students see it in the
shop. Archiving keeps the image; deleting removes it.

## 1. Schema changes
- `rewards.image_url` (text, nullable) — public URL of the uploaded image
  in the `reward-images` storage bucket. NULL means no image (placeholder
  shown instead).

## 2. Storage bucket
- New bucket `reward-images` (public read, teacher-only write).
- Policy: authenticated users can SELECT (read) any object — both
  teachers and students need to see reward images.
- Policy: only teachers (JWT has no `student_id` in app_metadata) can
  INSERT, UPDATE, DELETE objects. Students are blocked from uploading.

## 3. Security notes
- The `rewards` table RLS policies are unchanged. The new `image_url`
  column is writable by the teacher only (existing UPDATE policy).
- Students read `rewards` through the existing SELECT policy that
  already filters to active, non-archived rows.
- The storage bucket is public-read so image URLs work in <img> tags
  without per-request auth headers.
*/

ALTER TABLE rewards ADD COLUMN IF NOT EXISTS image_url text;

-- Create the storage bucket for reward images (public read).
INSERT INTO storage.buckets (id, name, public)
VALUES ('reward-images', 'reward-images', true)
ON CONFLICT (id) DO NOTHING;

-- SELECT: any signed-in user (teacher or student) can read images.
DROP POLICY IF EXISTS "reward_images_read" ON storage.objects;
CREATE POLICY "reward_images_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'reward-images');

-- INSERT: only teachers (no student_id in JWT) can upload.
DROP POLICY IF EXISTS "reward_images_teacher_insert" ON storage.objects;
CREATE POLICY "reward_images_teacher_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reward-images'
  AND ((auth.jwt() -> 'app_metadata'::text) ->> 'student_id'::text) IS NULL
);

-- UPDATE: only teachers can replace an image.
DROP POLICY IF EXISTS "reward_images_teacher_update" ON storage.objects;
CREATE POLICY "reward_images_teacher_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'reward-images'
  AND ((auth.jwt() -> 'app_metadata'::text) ->> 'student_id'::text) IS NULL
)
WITH CHECK (
  bucket_id = 'reward-images'
  AND ((auth.jwt() -> 'app_metadata'::text) ->> 'student_id'::text) IS NULL
);

-- DELETE: only teachers can delete an image.
DROP POLICY IF EXISTS "reward_images_teacher_delete" ON storage.objects;
CREATE POLICY "reward_images_teacher_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'reward-images'
  AND ((auth.jwt() -> 'app_metadata'::text) ->> 'student_id'::text) IS NULL
);
