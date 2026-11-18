import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getPublishedOfferBySlug } from "@/lib/offers";
import { getPublicContactInfo } from "@/lib/settings";
import { demoOffer } from "@/lib/demo-offers";
import { enquiryMessage, shortOfferUrl } from "@/lib/seo";
import { districtPath, listingHeadline, listingJsonLd, listingSummary } from "@/lib/seo-listing";
import { WhatsAppLink } from "@/components/WhatsAppButton";
import { RegisterInterestForm } from "@/components/RegisterInterestForm";
import { Gallery } from "@/components/site/Gallery";
import { UnitsTable } from "@/components/site/UnitsTable";
import { parseWarranties } from "@/lib/warranties";
import { districtKey } from "@/lib/districts";
import { IconArea, IconBath, IconBed, IconPin, IconSofa } from "@/components/site/icons";

const STAGE = { ready: { ar: "جاهز للسكن", en: "Ready to move in" }, under_construction: { ar: "تحت الإنشاء", en: "Under construction" }, off_plan: { ar: "بيع على الخارطة", en: "Off-plan" } } as const;

/** Section heading (client 2026-11-18 «ودي تصير فخمة و مرتبه»): a small numbered eyebrow, a larger title and a hairline. */
const SectionTitle = ({ n, sub, children }: { n?: string; sub?: string; children: React.ReactNode }) => (
  <div className="grid gap-1.5">
    {n && <span className="num text-[11px] font-semibold tracking-[0.25em] text-navy/40">{n}</span>}
    <div className="flex items-center gap-4">
      <h2 className="shrink-0 font-heading text-2xl font-bold tracking-tight text-navy sm:text-[28px]">{children}</h2>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-navy/15" />
    </div>
    {sub && <p className="text-sm text-navy/50">{sub}</p>}
  </div>
);

const Check = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
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
  // «فلل الصحافة | 200م — فيلا للبيع في حي الصحافة، الرياض»: the name plus what people search for.
  const head = listingHeadline(o, ar);
  const own = (ar ? o.description_ar : o.description_en || o.description_ar).replace(/\s+/g, " ").trim();
  const description = (listingSummary(o, ar) + (own ? " " + own : "")).slice(0, 300);
  return {
    title: `${title} — ${head}`,
    description,
    alternates: { canonical: `/${locale}/offers/${o.slug}`, languages: { ar: `/ar/offers/${o.slug}`, en: `/en/offers/${o.slug}` } },
    openGraph: { title: `${title} — ${head}`, description, images: o.cover_image ? [{ url: o.cover_image }] : ["/og.jpg"] },
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
  let sec = 0;
  const nx = () => String(++sec).padStart(2, "0");
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
      {live && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listingJsonLd(offer, locale)) }} />}
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-navy/50">
        <Link href="/" className="hover:text-gold">{ar ? "الرئيسية" : "Home"}</Link><span>/</span>
        <Link href="/offers" className="hover:text-gold">{ar ? "العقارات" : "Properties"}</Link><span>/</span>
        {live && offer.district_ar && <><Link href={districtPath(offer.district_ar)} className="hover:text-gold">{ar ? "حي " + district : district}</Link><span>/</span></>}
        <span className="text-navy">{title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="grid min-w-0 content-start gap-12">
          <Gallery images={images} title={title} />

          <header className="grid gap-4 border-b border-navy/10 pb-8">
            <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium">
              <span className="rounded-full border border-navy/15 px-3 py-1 text-navy/70">{t(`types.${offer.type}`)}</span>
              <span className={"inline-flex items-center gap-1.5 rounded-full px-3 py-1 " + (sold === 100 ? "bg-red-600 text-white" : "border border-emerald-200 bg-emerald-50 text-emerald-700")}>
                {sold !== 100 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}{sold === 100 ? s("soldOut") : s("available")}
              </span>
              {offer.ribbon?.trim() && <span className="rounded-full bg-navy px-3 py-1 text-white">{offer.ribbon.trim()}</span>}
              {sold !== null && sold > 0 && sold < 100 && <span className="rounded-full bg-navy/5 px-3 py-1 text-navy/60">{ar ? "تم بيع " : "Sold "}<bdi>{sold}%</bdi></span>}
            </div>
            <h1 className="font-heading text-[34px] font-bold leading-[1.2] tracking-tight text-navy sm:text-5xl">{title}</h1>
            <p className="flex items-center gap-2 text-[15px] text-navy/55"><IconPin /> {ar ? "حي " + districtKey(district) : district}{city ? (ar ? "، " : ", ") + city : ""}</p>
            {offer.ad_license_no && (
              <p className="text-xs text-navy/45">
                {ar ? "رقم ترخيص الإعلان: " : "Advertising licence: "}<bdi dir="ltr">{offer.ad_license_no}</bdi>
                {offer.ad_license_expiry && <>{ar ? " · ينتهي في " : " · expires "}<bdi dir="ltr">{offer.ad_license_expiry}</bdi></>}
              </p>
            )}
          </header>

          {/* Key facts and project details: each a quiet tile with its icon, the value large, the label small. */}
          <dl className="flex flex-wrap gap-3">
            {[
              ...facts.filter((f) => f.label !== (ar ? "الموقع" : "Location")).map((f) => [f.label, f.value, f.icon] as const),
              ...(offer.developer ? [[ar ? "المطوّر" : "Developer", (!ar && offer.developer_en) || offer.developer, null] as const] : []),
              ...(offer.stage ? [[ar ? "حالة المشروع" : "Status", ar ? STAGE[offer.stage].ar : STAGE[offer.stage].en, null] as const] : []),
              ...(offer.handover ? [[ar ? "موعد التسليم" : "Handover", (!ar && offer.handover_en) || offer.handover, null] as const] : []),
            ].map(([label, value, icon]) => (
              <div key={label} className="flex flex-auto basis-[140px] items-center gap-3 rounded-2xl border border-navy/[0.08] bg-[#f7f7f6] px-4 py-4">
                {icon && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-navy shadow-[0_2px_8px_-3px_rgba(0,0,0,0.15)]">{icon}</span>}
                <div className="min-w-0">
                  <dt className="text-[12px] text-navy/50">{label}</dt>
                  <dd className={"mt-0.5 font-heading text-[17px] font-bold leading-snug text-navy " + (icon ? "whitespace-nowrap" : "")}>{value}</dd>
                </div>
              </div>
            ))}
          </dl>

          {!!offer.units?.length && (
            <div className="grid gap-5">
              <SectionTitle n={nx()}>{ar ? "الوحدات والأسعار" : "Units & prices"}</SectionTitle>
              <UnitsTable units={offer.units} enquiry={enquiry} whatsappNumber={whatsappNumber} />
            </div>
          )}

          {description && (
            <div className="grid gap-5">
              <SectionTitle n={nx()}>{ar ? "عن المشروع" : "About the project"}</SectionTitle>
              <div className="rounded-3xl border border-navy/[0.08] bg-[#f7f7f6] p-6 sm:p-8">
                {description.length > 420 ? (
                  <details className="group">
                    <summary className="cursor-pointer list-none text-[15.5px] leading-[2] text-navy/75 [&::-webkit-details-marker]:hidden">
                      <span className="whitespace-pre-line group-open:hidden">{description.slice(0, 400).trimEnd()}… </span>
                      <span className="text-sm font-semibold text-navy underline underline-offset-4 group-open:hidden">{ar ? "اقرأ المزيد" : "Read more"}</span>
                    </summary>
                    <p className="whitespace-pre-line text-[15.5px] leading-[2] text-navy/75">{description}</p>
                  </details>
                ) : <p className="whitespace-pre-line text-[15.5px] leading-[2] text-navy/75">{description}</p>}
              </div>
            </div>
          )}

          {!!offer.features?.length && (
            <div className="grid gap-5">
              <SectionTitle n={nx()}>{ar ? "مميزات المشروع" : "Project features"}</SectionTitle>
              <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                {offer.features.map((k, i) => (
                  <li key={k + i} className="flex items-start gap-3 border-b border-navy/[0.08] py-3.5">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-navy text-white"><Check /></span>
                    <span className="text-[14.5px] leading-relaxed text-navy/80">{!ar && offer.features_en?.length === offer.features!.length ? offer.features_en[i] : k}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {warranties.length > 0 && (
            <div className="grid gap-5">
              <SectionTitle n={nx()}>{ar ? "الضمانات" : "Warranties"}</SectionTitle>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {warranties.map((w, i) => (
                  <li key={i} className="grid content-start gap-2 rounded-2xl border border-navy/[0.08] bg-white p-5 shadow-[0_12px_30px_-24px_rgba(0,0,0,0.4)]">
                    {w.years ? (
                      <span className="flex items-baseline gap-1.5 text-navy">
                        <b className="num font-heading text-4xl font-bold leading-none">{w.years}</b>
                        <span className="text-sm text-navy/50">{ar ? (Number(w.years) > 10 || Number(w.years) <= 2 ? "سنة" : "سنوات") : "years"}</span>
                      </span>
                    ) : (
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-navy text-white"><Check /></span>
                    )}
                    <span className="h-px w-8 bg-navy/20" />
                    <span className="text-[13.5px] font-medium leading-snug text-navy/70">{w.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="grid content-start gap-4 lg:sticky lg:top-24 lg:self-start">
          <div className="relative isolate grid gap-4 overflow-hidden rounded-3xl bg-gradient-to-b from-[#3a3a3a] to-[#1f1f1f] p-6 text-white shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)]">
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[url(/brand/pattern-footer.png)] bg-[length:90px_90px] opacity-[.06]" />
            <div className="grid gap-1 border-b border-white/10 pb-4">
              <span className="text-[12px] tracking-wide text-white/55">{offer.price_to ? (ar ? "السعر" : "Price") : t("priceFrom")}</span>
              <div className="font-heading text-[26px] font-bold leading-tight [&_span]:!text-white/50">{range(offer.price_from, offer.price_to)} <span className="text-sm font-normal">{s("sar")}</span></div>
            </div>
            <WhatsAppLink whatsappNumber={whatsappNumber} message={waMessage}
              className="flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-navy transition-opacity hover:opacity-90">
              {s("ctaWa")}
            </WhatsAppLink>
            <a href="#interest" className="rounded-full border border-white/30 px-5 py-3 text-center font-medium text-white transition-colors hover:bg-white hover:text-navy">{t("registerInterest")}</a>
            {/* The map location and the project file are not published: the client asks for the file and the team sends it. */}
            <WhatsAppLink whatsappNumber={whatsappNumber}
              message={(ar ? "السلام عليكم، أرغب بالحصول على ملف العقار: " + offer.title_ar : "Hello, I would like to receive the property file: " + (offer.title_en || offer.title_ar)) + "\nhttps://" + shortOfferUrl(offer.slug)}
              className="flex items-center justify-center gap-2 rounded-full px-5 py-2 text-center text-sm font-medium text-white/75 underline-offset-4 transition-colors hover:text-white hover:underline">
              {ar ? "اطلب ملف العقار" : "Request the property file"}
            </WhatsAppLink>
            {offer.video_url && (
              <div className="grid gap-2 border-t border-white/10 pt-4 text-sm">
                <a href={offer.video_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-white/80 hover:text-white">{ar ? "مشاهدة الفيديو" : "Watch video"}</a>
              </div>
            )}
          </div>
          <RegisterInterestForm offerId={offer.id} offerTitle={offer.title_ar} offerLink={"https://" + shortOfferUrl(offer.slug)} />
        </aside>
      </div>
    </section>
  );
}
