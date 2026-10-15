/**
 * Uploads an offer photo to Firebase Storage (offers/…, public read — see
 * storage.rules). Large photos are shrunk in the browser first (longest side
 * 2000px, JPEG ~82%) so the site stays fast; returns the public URL and path.
 */
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

async function shrink(file: File, max = 2000): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const out = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.82));
  return out && out.size < file.size ? out : file;
}

export async function uploadOfferImage(file: File): Promise<{ url: string; path: string }> {
  const blob = await shrink(file);
  const safe = file.name.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "-").slice(0, 40) || "photo";
  const path = `offers/${Date.now().toString(36)}-${safe}.jpg`;
  const r = ref(storage, path);
  await uploadBytes(r, blob, { contentType: blob.type || "image/jpeg", cacheControl: "public,max-age=31536000" });
  return { url: await getDownloadURL(r), path };
}
