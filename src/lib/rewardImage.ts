import { supabase } from "@/lib/supabase";

/**
 * Upload a reward image to the reward-images bucket.
 * Accepts a File (jpg/png/webp, max 2MB). Compresses and resizes
 * client-side to ~600px on the long edge before uploading.
 * Returns the public URL of the uploaded image.
 */
export async function uploadRewardImage(
  rewardId: string,
  file: File,
): Promise<string> {
  const validTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!validTypes.includes(file.type)) {
    throw new Error("Image must be JPG, PNG, or WebP");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Image must be 2 MB or smaller");
  }

  const blob = await compressImage(file, 600);
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${rewardId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("reward-images")
    .upload(path, blob, { upsert: true, contentType: file.type });

  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from("reward-images").getPublicUrl(path);
  return data.publicUrl;
}

/** Remove the image for a reward from storage. */
export async function removeRewardImage(imageUrl: string): Promise<void> {
  const path = imageUrl.split("/reward-images/").pop();
  if (!path) return;
  await supabase.storage.from("reward-images").remove([path]);
}

/**
 * Compress and resize an image file to maxDim on the long edge,
 * preserving aspect ratio. Output is always JPEG at 0.82 quality
 * for small file size (except PNG stays PNG for transparency).
 */
async function compressImage(file: File, maxDim: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image");
  ctx.drawImage(bitmap, 0, 0, w, h);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not compress image"))),
      "image/jpeg",
      0.82,
    );
  });
  bitmap.close();
  return blob;
}
