"use client";

/**
 * «تنزيل الصور» at the bottom of a property page (client 2026-11-01): every photo of the offer in one ZIP file named
 * after the offer. Photos come through /api/offer-img (our own Storage bucket only); a photo hosted elsewhere is skipped.
 */
import { useState } from "react";
import { zipSync } from "fflate";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

export function PhotosDownload({ images, title, ar }: { images: string[]; title: string; ar: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!images.length) return null;

  async function run() {
    setBusy(true); setMsg(null);
    const files: Record<string, Uint8Array> = {};
    let failed = 0;
    for (let i = 0; i < images.length; i++) {
      try {
        const r = await fetch("/api/offer-img?u=" + encodeURIComponent(images[i]));
        if (!r.ok) throw new Error();
        const type = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
        files[String(i + 1).padStart(2, "0") + "." + (EXT[type] || "jpg")] = new Uint8Array(await r.arrayBuffer());
      } catch { failed++; }
    }
    const n = Object.keys(files).length;
    if (!n) { setMsg(ar ? "تعذّر تنزيل الصور، حاول لاحقاً." : "Could not download the photos, please try again later."); setBusy(false); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([zipSync(files, { level: 0 }) as BlobPart], { type: "application/zip" }));
    a.download = (title.replace(/[/\\:*?"<>|]+/g, " ").trim() || (ar ? "صور العقار" : "Property photos")) + ".zip";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    if (failed) setMsg(ar ? `نُزّلت ${n} صورة، وتعذّر ${failed}.` : `${n} photos downloaded, ${failed} failed.`);
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-navy/10 pt-6">
      <button type="button" onClick={run} disabled={busy}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-navy/25 px-5 py-2 text-sm font-semibold text-navy transition-colors hover:bg-navy/5 disabled:opacity-50">
        <span aria-hidden>⬇</span>
        {busy ? (ar ? "جارٍ تجهيز الملف…" : "Preparing…") : ar ? `تنزيل الصور (${images.length})` : `Download photos (${images.length})`}
      </button>
      {msg && <span className="text-sm text-navy/60">{msg}</span>}
    </div>
  );
}
