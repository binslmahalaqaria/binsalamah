"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { WhatsAppLink } from "@/components/WhatsAppButton";
import type { Offer } from "@/lib/types";
import { enquiryMessage } from "@/lib/seo";
import { IconArea, IconBath, IconBed } from "@/components/site/icons";

const num = (n: number) => n.toLocaleString("en-US");
/** "1,050,000 إلى 1,580,000" — each number isolated so the order reads right in Arabic. */
const Range = ({ a, b, to }: { a: number; b: number | null | undefined; to: string }) =>
  b && b !== a ? <><bdi>{num(a)}</bdi> <span className="text-[0.8em] font-normal text-navy/50">{to}</span> <bdi>{num(b)}</bdi></> : <bdi>{num(a)}</bdi>;

/**
 * Property card: photo with availability + type badges, district, title, the
 * price range, a specs row (rooms / baths / area) and the sold bar, then
 * "details" and WhatsApp. Shared by the home page and /offers.
 */
export function OfferCard({ offer, whatsappNumber }: { offer: Offer; whatsappNumber: string }) {
  const t = useTranslations("Offers");
  const s = useTranslations("Site");
  const ar = useLocale() === "ar";

  const title = ar ? offer.title_ar : offer.title_en || offer.title_ar;
  const district = ar ? offer.district_ar : offer.district_en || offer.district_ar;
  const city = ar ? offer.city_ar : offer.city_en || offer.city_ar;
  const typeLabel = t(`types.${offer.type}`);
  const sold = typeof offer.sold_percentage === "number" ? Math.min(100, offer.sold_percentage) : null;
  const soldOut = sold === 100;
  // Short, tidy message with the property's short link so the team knows exactly which one.
  const waMessage = enquiryMessage({ title, district, slug: offer.slug }, undefined, ar);
  const href = `/offers/${offer.slug}`;

  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-navy/10 bg-white transition-shadow hover:shadow-[0_18px_50px_-20px_rgba(0,0,0,0.3)]">
      <Link href={href} className="relative block aspect-[4/3] overflow-hidden bg-navy/5">
        {offer.cover_image ? (
          // Plain <img>: offer photos are arbitrary external URLs (CLAUDE.md §12).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={offer.cover_image} alt={title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.05),transparent_70%)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mark-hd-dark.png" alt="" className="h-16 opacity-40" />
          </div>
        )}
        <span className={"absolute start-3 top-3 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur " + (soldOut ? "bg-red-600/85 text-white" : "bg-white/85 text-navy")}>
          {soldOut ? s("soldOut") : s("available")}
        </span>
        <span className="absolute end-3 top-3 rounded-full bg-navy/80 px-3 py-1 text-xs font-semibold text-cream backdrop-blur">{typeLabel}</span>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <p className="text-xs text-gold">{district}{city ? "، " + city : ""}</p>
          <Link href={href}><h3 className="mt-1 font-heading text-lg leading-snug font-bold text-navy">{title}</h3></Link>
        </div>

        <div className="font-heading text-navy">
          <span className="text-xs font-normal text-navy/50">{offer.price_to ? s("from") + " " : t("priceFrom") + " "}</span>
          <span className="text-lg font-bold"><Range a={offer.price_from} b={offer.price_to} to={s("to")} /></span>
          <span className="text-xs font-normal text-navy/50"> {s("sar")}</span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-y border-navy/10 py-2.5 text-[13px] text-navy/75">
          {offer.rooms ? <span className="flex items-center gap-1.5"><IconBed /> {offer.rooms} {s("rooms")}</span> : null}
          {offer.bathrooms ? <span className="flex items-center gap-1.5"><IconBath /> {offer.bathrooms} {s("baths")}</span> : null}
          <span className="flex items-center gap-1.5"><IconArea /> <Range a={offer.area_from} b={offer.area_to} to={s("to")} /> {s("area")}</span>
        </div>

        {!!offer.units?.length && (
          <p className="text-[13px] text-navy/60">
            <b className="text-navy">{offer.units.filter((u) => u.status === "available").length}</b> {ar ? "وحدات متاحة من" : "available of"} {offer.units.length}
          </p>
        )}

        {sold !== null && (
          <div className="flex items-center gap-2 text-xs text-navy/60">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-navy/10">
              <div className="h-full rounded-full bg-gold" style={{ width: `${sold}%` }} />
            </div>
            <span>{s("sold")} {sold}%</span>
          </div>
        )}

        <div className="mt-auto flex gap-2 pt-1">
          <Link href={href} className="flex-1 rounded-full bg-navy px-3 py-2.5 text-center text-sm font-medium text-cream transition-colors hover:bg-navy/85">{s("details")}</Link>
          <WhatsAppLink whatsappNumber={whatsappNumber} message={waMessage}
            className="rounded-full border border-navy/20 px-4 py-2.5 text-center text-sm font-medium text-navy transition-colors hover:border-[#25d366] hover:text-[#1da851]">
            {t("contactUs")}
          </WhatsAppLink>
        </div>
      </div>
    </article>
  );
}
