/**
 * Uploads an offer photo to Firebase Storage (offers/…, public read — see
 * storage.rules, which accept images under 10 MB). Photos are re-encoded in the
 * browser as JPEG (longest side 3200px, then smaller if still too big), so large
 * camera and drone photos fit. Failures come back as a short Arabic reason.
 */
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

const LIMIT = 9.5 * 1024 * 1024; // under the 10 MB storage rule
const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
const isHeic = (f: File) => /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);

/** Decodes the photo; falls back to an <img> when createImageBitmap refuses it (very large photos, some formats). */
async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number } | null> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (bmp) return bmp;
  // iPhone photos: Chrome and Edge can't read HEIC, so decode it here (loaded only when needed).
  if (isHeic(file)) {
    const { heicTo } = await import("heic-to/next");
    return heicTo({ blob: file, type: "bitmap" }).catch(() => null);
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight });
  } catch {
    return null;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

async function encode(src: CanvasImageSource & { width: number; height: number }, max: number, q: number): Promise<Blob | null> {
  const k = Math.min(1, max / Math.max(src.width, src.height));
  const c = document.createElement("canvas");
  c.width = Math.round(src.width * k);
  c.height = Math.round(src.height * k);
  const g = c.getContext("2d");
  if (!g) return null;
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, c.width, c.height);
  return new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", q));
}

async function shrink(file: File): Promise<Blob> {
  if (file.type === "image/gif" && file.size < LIMIT) return file;
  const src = await decode(file);
  if (!src) {
    if (isHeic(file)) throw new Error("ما قدرت أحوّل صورة الآيفون (HEIC)");
    if (file.size < LIMIT) return file;
    throw new Error("ما قدرت أقرأ الصورة وحجمها " + mb(file.size) + " م.ب");
  }
  // Best quality first, then smaller steps until it fits under the limit.
  for (const [max, q] of [[3200, 0.93], [2600, 0.88], [2000, 0.82]] as const) {
    const out = await encode(src, max, q);
    if (out && out.size < LIMIT) return out.size < file.size || file.size >= LIMIT ? out : file;
  }
  throw new Error("الصورة كبيرة جداً (" + mb(file.size) + " م.ب)");
}

function reason(e: unknown, size: number) {
  const code = (e as { code?: string })?.code || "";
  if (code === "storage/unauthorized") return size >= LIMIT ? "الصورة أكبر من 10 م.ب" : "الرفع مرفوض: تأكد إن حسابك مفعّل في النظام";
  if (code === "storage/quota-exceeded") return "تجاوز حد التخزين في Firebase، راجع الفوترة";
  if (code === "storage/unauthenticated") return "انتهت جلستك، سجّل دخول مرة ثانية";
  if (code === "storage/retry-limit-exceeded" || code === "storage/canceled" || code === "storage/unknown") return "انقطع الاتصال أثناء الرفع، جرّب مرة ثانية";
  return e instanceof Error && e.message ? e.message : "خطأ غير معروف";
}

export async function uploadOfferImage(file: File): Promise<{ url: string; path: string }> {
  const blob = await shrink(file);
  const safe = file.name.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "-").slice(0, 40) || "photo";
  const path = `offers/${Date.now().toString(36)}-${safe}.jpg`;
  const r = ref(storage, path);
  try {
    await uploadBytes(r, blob, { contentType: blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg", cacheControl: "public,max-age=31536000" });
    return { url: await getDownloadURL(r), path };
  } catch (e) {
    throw new Error(reason(e, blob.size));
  }
}

/** Project file (PDF) for sending to clients on WhatsApp — stored under offers/files/, up to 15 MB. */
export async function uploadOfferPdf(file: File): Promise<{ url: string; path: string }> {
  const safe = file.name.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "-").slice(0, 40) || "project";
  const path = `offers/files/${Date.now().toString(36)}-${safe}.pdf`;
  const r = ref(storage, path);
  try {
    await uploadBytes(r, file, { contentType: "application/pdf" });
    return { url: await getDownloadURL(r), path };
  } catch (e) {
    throw new Error(reason(e, file.size));
  }
}
