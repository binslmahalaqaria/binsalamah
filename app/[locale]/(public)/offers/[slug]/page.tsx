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
import { parseWarranties } from "@/lib/warranties";
import { IconArea, IconBath, IconBed, IconPin, IconSofa } from "@/components/site/icons";

const STAGE = { ready: { ar: "جاهز للسكن", en: "Ready to move in" }, under_construction: { ar: "تحت الإنشاء", en: "Under construction" }, off_plan: { ar: "بيع على الخارطة", en: "Off-plan" } } as const;

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="flex items-center gap-3 font-heading text-xl font-bold text-navy">{children}<span className="h-2 w-12 rounded-full bg-navy/20" /></h2>
);

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
  const enquiry = { title, district, city, type: t(`types.${offer.type}`), slug: offer.slug, priceFrom: offer.price_from, priceTo: offer.price_to,
    areaFrom: offer.area_from, areaTo: offer.area_to, rooms: offer.rooms };
  const waMessage = enquiryMessage(enquiry, undefined, ar);
  const range = (a: number, b: number | null) => (b && b !== a ? <><bdi>{num(a)}</bdi> <span className="text-[0.75em] font-normal text-navy/50">{s("to")}</span> <bdi>{num(b)}</bdi></> : <bdi>{num(a)}</bdi>);

  // Warranties are free text (one per line); older offers may still carry the structured list.
  const warrantyLines = ((!ar && offer.warranties_text_en) || offer.warranties_text || "").split("\n").map((l) => l.trim()).filter(Boolean)
    .concat(offer.warranties_text ? [] : (offer.warranties ?? []).map((w) => (ar ? `${w.item}: ${w.years} سنوات` : `${w.item}: ${w.years} years`)));
  // Each «item … N years» pair in the text becomes its own tile (see lib/warranties.ts).
  const warranties = parseWarranties(warrantyLines);
  const living = offer.living_rooms ?? (Math.max(0, ...(offer.units ?? []).map((u) => u.living_rooms ?? 0)) || null);
  const facts = [
    { icon: <IconArea />, label: ar ? "المساحة" : "Area", value: <>{range(offer.area_from, offer.area_to)} {s("area")}</> },
    offer.rooms ? { icon: <IconBed />, label: ar ? "الغرف" : "Bedrooms", value: offer.rooms } : null,
    living ? { icon: <IconSofa />, label: ar ? "الصالات" : "Living rooms", value: living } : null,
    offer.bathrooms ? { icon: <IconBath />, label: ar ? "دورات المياه" : "Bathrooms", value: offer.bathrooms } : null,
    { icon: <IconPin />, label: ar ? "الموقع" : "Location", value: district + (city ? (ar ? "، " : ", ") + city : "") },
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
              {offer.ribbon?.trim() && <span className="rounded-full bg-[#333333] px-3 py-1 text-xs font-semibold text-white">{offer.ribbon.trim()}</span>}
              {sold !== null && sold > 0 && sold < 100 && <span className="rounded-full bg-navy/5 px-3 py-1 text-xs text-navy/70">{ar ? "تم بيع " : "Sold "}{sold}%</span>}
            </div>
            <h1 className="font-heading text-3xl font-bold text-navy sm:text-4xl">{title}</h1>
            <p className="flex items-center gap-1.5 text-navy/60"><IconPin /> {district}{city ? (ar ? "، " : ", ") + city : ""}</p>
            {offer.ad_license_no && (
              <p className="text-xs text-navy/60">
                {ar ? "رقم ترخيص الإعلان: " : "Advertising licence: "}<bdi dir="ltr">{offer.ad_license_no}</bdi>
                {offer.ad_license_expiry && <>{ar ? " · ينتهي في " : " · expires "}<bdi dir="ltr">{offer.ad_license_expiry}</bdi></>}
              </p>
            )}
          </div>

          {/* One compact strip: key facts and project details together. */}
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-navy/10 bg-navy/10 sm:grid-cols-3 lg:grid-cols-4">
            {[
              ...facts.filter((f) => f.label !== (ar ? "الموقع" : "Location")).map((f) => [f.label, f.value, f.icon] as const),
              ...(offer.developer ? [[ar ? "المطوّر" : "Developer", (!ar && offer.developer_en) || offer.developer, null] as const] : []),
              ...(offer.stage ? [[ar ? "حالة المشروع" : "Status", ar ? STAGE[offer.stage].ar : STAGE[offer.stage].en, null] as const] : []),
              ...(offer.handover ? [[ar ? "موعد التسليم" : "Handover", (!ar && offer.handover_en) || offer.handover, null] as const] : []),
            ].map(([label, value, icon]) => (
              <div key={label} className="bg-white px-4 py-3">
                <dt className="flex items-center gap-1.5 text-xs text-navy/50">{icon ? <span className="text-gold">{icon}</span> : null}{label}</dt>
                <dd className="mt-0.5 font-heading font-bold text-navy">{value}</dd>
              </div>
            ))}
          </dl>

          {!!offer.units?.length && <UnitsTable units={offer.units} enquiry={enquiry} whatsappNumber={whatsappNumber} />}

          {description && (
            <div className="grid gap-2">
              <h2 className="font-heading text-lg font-bold text-navy">{ar ? "عن العقار" : "About this property"}</h2>
              {description.length > 320 ? (
                <details className="group">
                  <summary className="cursor-pointer list-none leading-loose text-navy/75 [&::-webkit-details-marker]:hidden">
                    <span className="whitespace-pre-line group-open:hidden">{description.slice(0, 300).trimEnd()}… </span>
                    <span className="text-sm font-semibold text-navy underline group-open:hidden">{ar ? "المزيد" : "Read more"}</span>
                  </summary>
                  <p className="whitespace-pre-line leading-loose text-navy/75">{description}</p>
                </details>
              ) : <p className="whitespace-pre-line leading-loose text-navy/75">{description}</p>}
            </div>
          )}

          {!!offer.features?.length && (
            <div className="grid gap-4">
              <SectionTitle>{ar ? "خصائص المشروع" : "Project features"}</SectionTitle>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {offer.features.map((k, i) => (
                  <li key={k + i} className="flex flex-col items-center gap-3 rounded-xl bg-navy/[0.04] px-3 py-5 text-center">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-navy text-white">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                    </span>
                    <span className="text-[13px] font-semibold leading-snug text-navy/70">{!ar && offer.features_en?.length === offer.features!.length ? offer.features_en[i] : k}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {warranties.length > 0 && (
            <div className="grid gap-4">
              <SectionTitle>{ar ? "الضمانات" : "Warranties"}</SectionTitle>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {warranties.map((w, i) => (
                  <li key={i} className="flex flex-col items-center gap-3 rounded-xl bg-navy/[0.04] px-3 py-5 text-center">
                    {w.years ? (
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-navy leading-none text-white">
                        <span><b className="block text-[15px]">{w.years}</b><span className="block text-[9px] opacity-80">{ar ? "سنوات" : "years"}</span></span>
                      </span>
                    ) : (
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-navy text-white">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                      </span>
                    )}
                    <span className="text-[13px] font-semibold leading-snug text-navy/70">{w.label}</span>
                  </li>
                ))}
              </ul>
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
              className="flex items-center justify-center gap-2 rounded-full bg-[#333333] px-5 py-3 font-medium text-white transition-opacity hover:opacity-90">
              {s("ctaWa")}
            </WhatsAppLink>
            <a href="#interest" className="rounded-full border border-navy px-5 py-3 text-center font-medium text-navy transition-colors hover:bg-navy hover:text-cream">{t("registerInterest")}</a>
            {/* The map location and the project file are not published: the client asks for the file and the team sends it. */}
            <WhatsAppLink whatsappNumber={whatsappNumber}
              message={(ar ? "السلام عليكم، أرغب بالحصول على ملف العقار: " + offer.title_ar : "Hello, I would like to receive the property file: " + (offer.title_en || offer.title_ar)) + "\nhttps://" + shortOfferUrl(offer.slug)}
              className="flex items-center justify-center gap-2 rounded-full border border-navy/20 px-5 py-3 text-center font-medium text-navy transition-colors hover:bg-navy/5">
              {ar ? "اطلب ملف العقار" : "Request the property file"}
            </WhatsAppLink>
            {offer.video_url && (
              <div className="grid gap-2 border-t border-navy/10 pt-4 text-sm">
                <a href={offer.video_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-navy hover:text-gold">{ar ? "مشاهدة الفيديو" : "Watch video"}</a>
              </div>
            )}
          </div>
          <RegisterInterestForm offerId={offer.id} offerTitle={offer.title_ar} offerLink={"https://" + shortOfferUrl(offer.slug)} />
        </aside>
      </div>
    </section>
  );
}
