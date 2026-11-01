"use client";

/** Property photos: one large image with arrows and a counter, thumbnails underneath to switch.
 *  Click the photo (or ⤢) to open it full-screen: arrows / keyboard ← → / swipe to browse, Esc or ✕ to close. */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function Gallery({ images, title }: { images: string[]; title: string }) {
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(false);
  const touchX = useRef<number | null>(null);
  const n = images.length;
  const step = useCallback((d: number) => setI((x) => (x + d + n) % n), [n]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      else if (e.key === "ArrowRight") step(document.dir === "rtl" ? -1 : 1);
      else if (e.key === "ArrowLeft") step(document.dir === "rtl" ? 1 : -1);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, step]);
  if (!n) {
    return (
      <div className="grid aspect-[16/10] place-items-center rounded-3xl bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.05),transparent_70%)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-mark-hd-dark.png" alt="" className="h-20 opacity-40" />
      </div>
    );
  }
  const go = (d: number) => setI((i + d + n) % n);
  return (
    <div className="grid gap-3">
      <div className="relative aspect-[16/10] cursor-zoom-in overflow-hidden rounded-3xl bg-navy/5" onClick={() => setOpen(true)}>
        {images.map((src, k) => (
          // Plain <img>: offer photos are arbitrary external URLs (CLAUDE.md §12).
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src + k} src={src} alt={k === i ? title : ""} aria-hidden={k !== i}
            className={"absolute inset-0 h-full w-full object-cover transition-opacity duration-500 " + (k === i ? "opacity-100" : "opacity-0")} />
        ))}
        <button type="button" aria-label="تكبير الصورة" onClick={(e) => { e.stopPropagation(); setOpen(true); }} className="absolute top-3 grid h-9 w-9 place-items-center rounded-full bg-white/85 text-lg text-navy shadow hover:bg-white ltr:right-3 rtl:left-3">⤢</button>
        {n > 1 && (
          <>
            <button type="button" aria-label="السابق" onClick={(e) => { e.stopPropagation(); go(-1); }} className="absolute top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-xl text-navy shadow hover:bg-white ltr:left-3 rtl:right-3">‹</button>
            <button type="button" aria-label="التالي" onClick={(e) => { e.stopPropagation(); go(1); }} className="absolute top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-xl text-navy shadow hover:bg-white ltr:right-3 rtl:left-3">›</button>
            <span className="absolute bottom-3 rounded-full bg-black/55 px-3 py-1 text-xs text-white ltr:right-3 rtl:left-3" dir="ltr">{i + 1} / {n}</span>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {images.slice(0, 10).map((src, k) => (
            <button key={src + k} type="button" onClick={() => setI(k)} aria-label={String(k + 1)}
              className={"aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-xl ring-2 transition sm:w-28 " + (k === i ? "ring-gold" : "ring-transparent opacity-70 hover:opacity-100")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/92" role="dialog" aria-modal="true" aria-label={title}
          onClick={() => setOpen(false)}
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => { const x = touchX.current; touchX.current = null; if (x == null) return; const dx = e.changedTouches[0].clientX - x; if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1); }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[i]} alt={title} className="max-h-[92vh] max-w-[96vw] select-none object-contain" onClick={(e) => e.stopPropagation()} />
          <button type="button" aria-label="إغلاق" onClick={() => setOpen(false)} className="absolute top-4 grid h-11 w-11 place-items-center rounded-full bg-white/20 text-2xl text-white hover:bg-white/35 ltr:right-4 rtl:left-4">✕</button>
          {n > 1 && (
            <>
              <button type="button" aria-label="السابق" onClick={(e) => { e.stopPropagation(); step(-1); }} className="absolute top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/25 text-3xl text-white hover:bg-white/40 ltr:left-3 rtl:right-3">‹</button>
              <button type="button" aria-label="التالي" onClick={(e) => { e.stopPropagation(); step(1); }} className="absolute top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/25 text-3xl text-white hover:bg-white/40 ltr:right-3 rtl:left-3">›</button>
              <span className="absolute bottom-4 rounded-full bg-white/15 px-4 py-1.5 text-sm text-white" dir="ltr">{i + 1} / {n}</span>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
