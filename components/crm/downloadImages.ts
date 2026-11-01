/**
 * «تنزيل كل الصور» / «مشاركة الملف» (client 2026-10-25, 2026-11-01): every photo of a property in one ZIP file, numbered in
 * their order (the cover first) and named after the property. Photos are fetched through /api/img (staff only) because
 * their hosts block direct reads. Sharing uses the phone's share sheet (WhatsApp, Mail, AirDrop…); on a computer, or where
 * file sharing is not supported, the ZIP is downloaded instead so it can be attached by hand.
 */
import { zipSync } from "fflate";
import { auth } from "@/lib/firebase";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic" };

export async function buildImagesZip(urls: string[], name: string) {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error("سجّل الدخول من جديد ثم أعد المحاولة.");
  const files: Record<string, Uint8Array> = {};
  let failed = 0;
  for (let i = 0; i < urls.length; i++) {
    try {
      const r = await fetch("/api/img?u=" + encodeURIComponent(urls[i]), { headers: { Authorization: "Bearer " + token } });
      if (!r.ok) throw new Error();
      const type = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
      files[String(i + 1).padStart(2, "0") + "." + (EXT[type] || "jpg")] = new Uint8Array(await r.arrayBuffer());
    } catch { failed++; }
  }
  const ok = Object.keys(files).length;
  const fileName = (name.replace(/[\/:*?"<>|]+/g, " ").trim() || "صور العقار") + ".zip";
  const blob = ok ? new Blob([zipSync(files, { level: 0 }) as BlobPart], { type: "application/zip" }) : null;
  return { blob, fileName, ok, failed };
}

function save(blob: Blob, fileName: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

export async function downloadAllImages(urls: string[], name: string): Promise<{ ok: number; failed: number }> {
  const { blob, fileName, ok, failed } = await buildImagesZip(urls, name);
  if (blob) save(blob, fileName);
  return { ok, failed };
}

/** Opens the share sheet with the ZIP; falls back to a download. `shared` tells which one happened. */
export async function shareAllImages(urls: string[], name: string): Promise<{ ok: number; failed: number; shared: boolean }> {
  const { blob, fileName, ok, failed } = await buildImagesZip(urls, name);
  if (!blob) return { ok: 0, failed, shared: false };
  const file = new File([blob], fileName, { type: "application/zip" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: fileName.replace(/\.zip$/, "") });
      return { ok, failed, shared: true };
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return { ok, failed, shared: true }; // the person closed the share sheet
    }
  }
  save(blob, fileName);
  return { ok, failed, shared: false };
}
