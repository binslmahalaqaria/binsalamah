"use client";

/**
 * Home hero: full-width drone shots of Riyadh villa neighbourhoods (no
 * branding; Unsplash licence, self-hosted in /public/hero) rotating every 6s
 * under a dark gradient, with the slogan and two calls to action. Featured
 * offers take turns in a small glass card linking to them.
 */
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Offer } from "@/lib/types";

/**
 * Background photos, all of Riyadh (Unsplash licence, self-hosted): villa
 * neighbourhoods from above, Al Faisaliah and the city centre, KAFD on the
 * skyline, Kingdom Centre at sunset, and the skyline at night. `pos` keeps the
 * important part in frame when the photo is cropped.
 */
const BACKGROUNDS = [
  { src: "/hero/riyadh-aerial-1.jpg", pos: "center 80%" },
  { src: "/hero/riyadh-5.jpg", pos: "center 60%" },
  { src: "/hero/riyadh-3.jpg", pos: "center 55%" },
  { src: "/hero/riyadh-4.jpg", pos: "center 30%" },
  { src: "/hero/riyadh-6.jpg", pos: "center 50%" },
  { src: "/hero/riyadh-2.jpg", pos: "center 60%" },
];

export function Hero({ slides }: { slides: Offer[] }) {
  const t = useTranslations("Site");
  const ar = useLocale() === "ar";
  const [i, setI] = useState(0);
  const n = BACKGROUNDS.length;
  useEffect(() => {
    if (n < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % n), 6000);
    return () => clearInterval(id);
  }, [n]);
  const cur = slides.length ? slides[i % slides.length] : null;

  return (
    <section className="relative isolate flex min-h-[100svh] overflow-hidden bg-navy text-cream">
      {BACKGROUNDS.map(({ src, pos }, k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt="" aria-hidden fetchPriority={k ? "low" : "high"} loading={k ? "lazy" : "eager"} style={{ objectPosition: pos }}
          className={"absolute inset-0 -z-20 h-full w-full object-cover transition-[opacity,transform] duration-[1500ms] " + (k === i ? "scale-105 opacity-100" : "scale-100 opacity-0")} />
      ))}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/75 via-black/35 to-black/85" />

      <div className="mx-auto flex w-full max-w-7xl flex-col justify-center gap-6 px-6 pb-44 pt-48 md:pt-64">
        <h1 className="max-w-3xl font-heading text-[2.6rem] leading-[1.2] font-medium sm:text-6xl">{t("heroTitle")}</h1>
        <p className="max-w-xl text-lg text-cream/80">{t("heroSubtitle")}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Link href="/offers" className="rounded-full border border-cream/30 bg-cream/10 px-8 py-3 text-[15px] text-cream backdrop-blur-md transition-colors hover:bg-cream hover:text-navy">{t("browse")}</Link>
          <a href="#request" className="rounded-full border border-cream/30 bg-cream/10 px-8 py-3 text-[15px] text-cream backdrop-blur-md transition-colors hover:bg-cream hover:text-navy">{t("request")}</a>
        </div>
      </div>

      {cur && (
        <Link href={`/offers/${cur.slug}`}
          className="absolute bottom-28 hidden w-80 rounded-2xl border border-cream/15 bg-black/35 p-5 backdrop-blur-md transition-colors hover:bg-black/50 xl:block ltr:right-8 rtl:left-8">
          <span className="text-xs text-gold">{ar ? cur.district_ar : cur.district_en || cur.district_ar}</span>
          <h3 className="mt-1 font-heading text-xl font-bold">{ar ? cur.title_ar : cur.title_en || cur.title_ar}</h3>
          <p className="mt-2 line-clamp-2 text-sm text-cream/75">{ar ? cur.description_ar : cur.description_en || cur.description_ar}</p>
          <span className="mt-3 inline-block text-sm font-medium text-gold">{t("details")} ←</span>
        </Link>
      )}
      {n > 1 && (
        <div className="absolute bottom-24 left-1/2 flex -translate-x-1/2 items-center gap-3">
          <button type="button" aria-label="السابق" onClick={() => setI((i - 1 + n) % n)} className="grid h-10 w-10 place-items-center rounded-full bg-cream/15 text-lg hover:bg-cream/30">‹</button>
          {BACKGROUNDS.map((b, k) => <button key={b.src} type="button" aria-label={String(k + 1)} onClick={() => setI(k)} className={"h-1.5 rounded-full transition-all " + (k === i ? "w-6 bg-cream" : "w-1.5 bg-cream/50")} />)}
          <button type="button" aria-label="التالي" onClick={() => setI((i + 1) % n)} className="grid h-10 w-10 place-items-center rounded-full bg-cream/15 text-lg hover:bg-cream/30">›</button>
        </div>
      )}
    </section>
  );
}
