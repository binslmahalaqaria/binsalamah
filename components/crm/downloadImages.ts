/**
 * «تنزيل كل الصور» (client 2026-10-25): every photo of a property in one ZIP file, numbered in their order
 * (the cover first). Photos are fetched through /api/img (staff only) because their hosts block direct reads.
 */
import { zipSync } from "fflate";
import { auth } from "@/lib/firebase";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic" };

export async function downloadAllImages(urls: string[], name: string): Promise<{ ok: number; failed: number }> {
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
  const n = Object.keys(files).length;
  if (!n) return { ok: 0, failed };
  const zip = zipSync(files, { level: 0 });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
  a.download = (name.replace(/[\/:*?"<>|]+/g, " ").trim() || "صور العقار") + ".zip";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  return { ok: n, failed };
}
