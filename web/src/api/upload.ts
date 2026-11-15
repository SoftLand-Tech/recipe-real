/**
 * Image uploads (FOUNDATION OWNED).
 *
 * POST /api/uploads — multipart field `image` (jpg/png/webp, ≤4MB, authed),
 * returns the public URL of the stored file. The web version takes a real
 * browser File (mobile's uri juggling is RN-only): the browser's FormData
 * sets the multipart boundary itself, so the per-request Content-Type header
 * must be multipart/form-data and NOT carry a charset (a JSON default would
 * corrupt the boundary).
 */
import { post } from "@/api/http";

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("image", file, file.name || "photo.jpg");

  const data = await post<{ url?: string }>("/uploads", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  const url = data?.url;
  if (typeof url !== "string" || url.length === 0) {
    throw new Error("Upload failed: no URL returned");
  }
  return url;
}
