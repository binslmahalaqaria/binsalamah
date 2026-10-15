"use client";

/** Property photos: one large image with arrows and a counter, thumbnails underneath to switch. */
import { useState } from "react";

export function Gallery({ images, title }: { images: string[]; title: string }) {
  const [i, setI] = useState(0);
  const n = images.length;
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
      <div className="relative aspect-[16/10] overflow-hidden rounded-3xl bg-navy/5">
        {images.map((src, k) => (
          // Plain <img>: offer photos are arbitrary external URLs (CLAUDE.md §12).
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src + k} src={src} alt={k === i ? title : ""} aria-hidden={k !== i}
            className={"absolute inset-0 h-full w-full object-cover transition-opacity duration-500 " + (k === i ? "opacity-100" : "opacity-0")} />
        ))}
        {n > 1 && (
          <>
            <button type="button" aria-label="السابق" onClick={() => go(-1)} className="absolute top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-xl text-navy shadow hover:bg-white ltr:left-3 rtl:right-3">‹</button>
            <button type="button" aria-label="التالي" onClick={() => go(1)} className="absolute top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-xl text-navy shadow hover:bg-white ltr:right-3 rtl:left-3">›</button>
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
    </div>
  );
}
