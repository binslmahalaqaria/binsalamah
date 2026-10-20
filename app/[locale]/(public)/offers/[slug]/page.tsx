import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getPublishedOfferBySlug } from "@/lib/offers";
import { getPublicContactInfo } from "@/lib/settings";
import { demoOffer } from "@/lib/demo-offers";
import { enquiryMessage, shortOfferUrl } from "@/lib/seo";
import { WhatsAppLink } from "@/components/WhatsAppButton";
import { RegisterInterestForm } from "@/components/RegisterInterestForm";
import { Gallery } from "@/components/site/Gallery";
import { UnitsTable } from "@/components/site/UnitsTable";
import { IconArea, IconBath, IconBed, IconCheck, IconPin, IconSofa, IconShield } from "@/components/site/icons";

const STAGE = { ready: { ar: "جاهز للسكن", en: "Ready to move in" }, under_construction: { ar: "تحت الإنشاء", en: "Under construction" }, off_plan: { ar: "بيع على الخارطة", en: "Off-plan" } } as const;

const num = (n: number) => n.toLocaleString("en-US");
const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

/**
 * One property: breadcrumb, photo gallery, title and location, key facts,
 * the units table (each unit's price, area and status), project information
 * with the written warranties, features, description and sold progress; the side card also links
 * the map location, brochure and video when given; a sticky side card with the price range,
 * WhatsApp and the "register interest" form (which creates a CRM lead).
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string; locale: string }> }): Promise<Metadata> {
  const { slug: raw, locale } = await params;
  const slug = safeDecode(raw);
  const o = (await getPublishedOfferBySlug(slug).catch(() => null)) ?? demoOffer(slug);
  if (!o) return {};
  const ar = locale === "ar";
  const title = ar ? o.title_ar : o.title_en || o.title_ar;
  const where = ar ? `${o.district_ar}، ${o.city_ar}` : `${o.district_en || o.district_ar}, ${o.city_en || o.city_ar}`;
  const description = (ar ? o.description_ar : o.description_en || o.description_ar).slice(0, 160) || where;
  return {
    title: `${title} — ${where}`,
    description,
    alternates: { canonical: `/${locale}/offers/${o.slug}`, languages: { ar: `/ar/offers/${o.slug}`, en: `/en/offers/${o.slug}` } },
    openGraph: { title, description, images: o.cover_image ? [{ url: o.cover_image }] : ["/og.jpg"] },
    // Sample offers (demo=1) must never show up in search results.
    ...(o.id.startsWith("d") && o.slug.startsWith("demo-") ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function OfferDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params;
  const slug = safeDecode(raw); // Arabic slugs arrive percent-encoded
  const [live, locale, t, s, { whatsappNumber }] = await Promise.all([
    getPublishedOfferBySlug(slug),
    getLocale(),
    getTranslations("Offers"),
    getTranslations("Site"),
    getPublicContactInfo(),
  ]);
  const offer = live ?? demoOffer(slug);
  if (!offer) notFound();

  const ar = locale === "ar";
  const title = ar ? offer.title_ar : offer.title_en || offer.title_ar;
  const city = ar ? offer.city_ar : offer.city_en || offer.city_ar;
  const district = ar ? offer.district_ar : offer.district_en || offer.district_ar;
  const description = ar ? offer.description_ar : offer.description_en || offer.description_ar;
  const images = [...offer.images].sort((a, b) => a.order - b.order).map((i) => i.url).filter(Boolean);
  if (!images.length && offer.cover_image) images.push(offer.cover_image);
  const sold = typeof offer.sold_percentage === "number" ? Math.min(100, offer.sold_percentage) : null;
  const waMessage = enquiryMessage({ title, district, slug: offer.slug }, undefined, ar);
  const range = (a: number, b: number | null) => (b && b !== a ? <><bdi>{num(a)}</bdi> <span className="text-[0.75em] font-normal text-navy/50">{s("to")}</span> <bdi>{num(b)}</bdi></> : <bdi>{num(a)}</bdi>);

  // Warranties are free text (one per line); older offers may still carry the structured list.
  const warrantyLines = (offer.warranties_text || "").split("\n").map((l) => l.trim()).filter(Boolean)
    .concat(offer.warranties_text ? [] : (offer.warranties ?? []).map((w) => (ar ? `${w.item}: ${w.years} سنوات` : `${w.item}: ${w.years} years`)));
  const living = offer.living_rooms ?? (Math.max(0, ...(offer.units ?? []).map((u) => u.living_rooms ?? 0)) || null);
  const facts = [
    { icon: <IconArea />, label: ar ? "المساحة" : "Area", value: <>{range(offer.area_from, offer.area_to)} {s("area")}</> },
    offer.rooms ? { icon: <IconBed />, label: ar ? "الغرف" : "Bedrooms", value: offer.rooms } : null,
    living ? { icon: <IconSofa />, label: ar ? "الصالات" : "Living rooms", value: living } : null,
    offer.bathrooms ? { icon: <IconBath />, label: ar ? "دورات المياه" : "Bathrooms", value: offer.bathrooms } : null,
    { icon: <IconPin />, label: ar ? "الموقع" : "Location", value: district + (city ? "، " + city : "") },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; value: React.ReactNode }[];

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-navy/50">
        <Link href="/" className="hover:text-gold">{ar ? "الرئيسية" : "Home"}</Link><span>/</span>
        <Link href="/offers" className="hover:text-gold">{ar ? "العقارات" : "Properties"}</Link><span>/</span>
        <span className="text-navy">{title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-8">
          <Gallery images={images} title={title} />

          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-navy px-3 py-1 text-xs font-semibold text-cream">{t(`types.${offer.type}`)}</span>
              <span className={"rounded-full px-3 py-1 text-xs font-semibold " + (sold === 100 ? "bg-red-600 text-white" : "bg-gold/20 text-navy")}>{sold === 100 ? s("soldOut") : s("available")}</span>
            </div>
            <h1 className="font-heading text-3xl font-bold text-navy sm:text-4xl">{title}</h1>
            <p className="flex items-center gap-1.5 text-navy/60"><IconPin /> {district}{city ? "، " + city : ""}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {facts.map((f) => (
              <div key={f.label} className="flex flex-col gap-1.5 rounded-2xl border border-navy/10 bg-white p-4">
                <span className="flex items-center gap-1.5 text-xs text-navy/50"><span className="text-gold">{f.icon}</span>{f.label}</span>
                <span className="font-heading text-lg font-bold text-navy">{f.value}</span>
              </div>
            ))}
          </div>

          {!!offer.units?.length && <UnitsTable units={offer.units} offerTitle={title} offerSlug={offer.slug} whatsappNumber={whatsappNumber} />}

          {description && (
            <div className="grid gap-3">
              <h2 className="font-heading text-xl font-bold text-navy">{ar ? "عن العقار" : "About this property"}</h2>
              <p className="whitespace-pre-line leading-loose text-navy/75">{description}</p>
            </div>
          )}

          {(offer.developer || offer.stage || offer.handover || warrantyLines.length > 0) && (
            <div className="grid gap-3">
              <h2 className="font-heading text-xl font-bold text-navy">{ar ? "معلومات المشروع" : "Project information"}</h2>
              {(offer.developer || offer.stage || offer.handover) && <dl className="grid gap-px overflow-hidden rounded-2xl border border-navy/10 bg-navy/10 sm:grid-cols-3">
                {[
                  offer.developer ? [ar ? "المطوّر" : "Developer", offer.developer] : null,
                  offer.stage ? [ar ? "حالة المشروع" : "Status", ar ? STAGE[offer.stage].ar : STAGE[offer.stage].en] : null,
                  offer.handover ? [ar ? "موعد التسليم" : "Handover", offer.handover] : null,
                ].filter(Boolean).map((r) => (
                  <div key={r![0]} className="bg-white p-4"><dt className="text-xs text-navy/50">{r![0]}</dt><dd className="mt-1 font-semibold text-navy">{r![1]}</dd></div>
                ))}
              </dl>}
              {warrantyLines.length > 0 && (
                <div className="rounded-2xl border border-navy/10 bg-white p-5">
                  <h3 className="mb-2 flex items-center gap-2 font-bold text-navy"><span className="text-gold"><IconShield /></span>{ar ? "الضمانات" : "Warranties"}</h3>
                  <ul className="grid gap-1.5 text-navy/75">
                    {warrantyLines.map((l, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />{l}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {!!offer.features?.length && (
            <div className="grid gap-3">
              <h2 className="font-heading text-xl font-bold text-navy">{ar ? "المميزات" : "Features"}</h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {offer.features.map((x) => (
                  <li key={x} className="flex items-center gap-2 text-navy/80"><span className="grid h-6 w-6 place-items-center rounded-full bg-gold/15 text-sm text-gold"><IconCheck /></span>{x}</li>
                ))}
              </ul>
            </div>
          )}

          {sold !== null && (
            <div className="grid gap-2 rounded-2xl bg-navy/[0.03] p-5">
              <div className="flex justify-between text-sm"><span className="text-navy/60">{ar ? "نسبة البيع" : "Sold"}</span><b className="text-navy">{sold}%</b></div>
              <div className="h-2 overflow-hidden rounded-full bg-navy/10"><div className="h-full rounded-full bg-gold" style={{ width: `${sold}%` }} /></div>
            </div>
          )}
        </div>

        <aside className="grid content-start gap-4 lg:sticky lg:top-24 lg:self-start">
          <div className="grid gap-4 rounded-3xl border border-navy/10 bg-white p-6 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.35)]">
            <div>
              <span className="text-xs text-navy/50">{offer.price_to ? (ar ? "السعر" : "Price") : t("priceFrom")}</span>
              <div className="font-heading text-2xl font-bold text-navy">{range(offer.price_from, offer.price_to)} <span className="text-sm font-normal text-navy/50">{s("sar")}</span></div>
            </div>
            <WhatsAppLink whatsappNumber={whatsappNumber} message={waMessage}
              className="flex items-center justify-center gap-2 rounded-full bg-[#25d366] px-5 py-3 font-medium text-white transition-opacity hover:opacity-90">
              {s("ctaWa")}
            </WhatsAppLink>
            <a href="#interest" className="rounded-full border border-navy px-5 py-3 text-center font-medium text-navy transition-colors hover:bg-navy hover:text-cream">{t("registerInterest")}</a>
            {(offer.map_url || offer.brochure_url || offer.video_url) && (
              <div className="grid gap-2 border-t border-navy/10 pt-4 text-sm">
                {offer.map_url && <a href={offer.map_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-navy hover:text-gold"><IconPin /> {ar ? "الموقع على الخريطة" : "Location on map"}</a>}
                {offer.brochure_url && <a href={offer.brochure_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-navy hover:text-gold">📄 {ar ? "تحميل الملف التعريفي" : "Download brochure"}</a>}
                {offer.video_url && <a href={offer.video_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-navy hover:text-gold">▶ {ar ? "مشاهدة الفيديو" : "Watch video"}</a>}
              </div>
            )}
          </div>
          <RegisterInterestForm offerId={offer.id} offerTitle={offer.title_ar} offerLink={"https://" + shortOfferUrl(offer.slug)} />
        </aside>
      </div>
    </section>
  );
}
