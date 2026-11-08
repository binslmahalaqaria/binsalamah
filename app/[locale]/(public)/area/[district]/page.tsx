import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DistrictLinks } from "@/components/site/DistrictLinks";
import { OffersGrid } from "@/components/OffersGrid";
import { listPublishedOffers } from "@/lib/offers";
import { getPublicContactInfo } from "@/lib/settings";
import { districtJsonLd, districtPath, districtsOf, typeWord } from "@/lib/seo-listing";
import type { Offer } from "@/lib/types";

/** Rebuilt hourly, like the sitemap, so a new listing gets its district page soon. */
export const revalidate = 3600;

const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
const inDistrict = (all: Offer[], d: string) => all.filter((o) => o.district_ar?.trim() === d);
/** «فلل وأدوار» from the types present. */
function typesLabel(list: Offer[], ar: boolean) {
  const ts = Array.from(new Set(list.map((o) => o.type)));
  const words = ts.map((t) => typeWord(t, ar, true));
  if (!words.length || ts.length > 3) return ar ? "عقارات" : "Properties";
  return ar ? words.join(" و") : words.join(" & ");
}

/**
 * One district's listings (client 2026-11-08, SEO): a page per district with published listings, so a search such as
 * «فلل للبيع في الملقا» can land on it. Only districts that have listings exist; any other gives 404.
 */
export async function generateMetadata({ params }: { params: Promise<{ district: string; locale: string }> }): Promise<Metadata> {
  const { district: raw, locale } = await params;
  const d = safeDecode(raw);
  const list = inDistrict(await listPublishedOffers().catch(() => []), d);
  if (!list.length) return { robots: { index: false } };
  const ar = locale === "ar";
  const what = typesLabel(list, ar);
  const title = ar ? `${what} للبيع في حي ${d}، الرياض` : `${what} for sale in ${d}, Riyadh`;
  const prices = list.map((o) => o.price_from).filter(Boolean);
  const from = prices.length ? Math.min(...prices).toLocaleString("en-US") : "";
  const description = ar
    ? `${list.length} ${list.length > 2 && list.length < 11 ? "عروض" : "عرض"} ${what} للبيع في حي ${d} بالرياض${from ? "، تبدأ من " + from + " ريال" : ""}. صور ومساحات وأسعار الوحدات، وتواصل مباشر مع بن سلمه العقارية.`
    : `${list.length} ${what.toLowerCase()} for sale in ${d}, Riyadh${from ? ", from SAR " + from : ""}. Photos, areas and unit prices from Bin Slmah Real Estate.`;
  const path = districtPath(d);
  return {
    title, description,
    alternates: { canonical: `/${locale}${path}`, languages: { ar: `/ar${path}`, en: `/en${path}` } },
    openGraph: { title, description, images: list[0].cover_image ? [{ url: list[0].cover_image }] : ["/og.jpg"] },
  };
}

export default async function DistrictPage({ params }: { params: Promise<{ district: string }> }) {
  const { district: raw } = await params;
  const d = safeDecode(raw);
  const [all, locale, { whatsappNumber }] = await Promise.all([listPublishedOffers().catch(() => []), getLocale(), getPublicContactInfo()]);
  const list = inDistrict(all, d);
  if (!list.length) notFound();
  const ar = locale === "ar";
  const what = typesLabel(list, ar);
  const others = districtsOf(all).filter(([x]) => x !== d);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(districtJsonLd(d, list, locale)) }} />
      <section className="relative isolate -mt-6 overflow-hidden bg-[#262524] px-6 pt-24 pb-28 text-center text-cream">
        <div aria-hidden className="absolute -inset-1/2 -z-10 -rotate-[18deg] bg-[url(/brand/pattern-footer.png)] bg-[length:96px_96px] opacity-60" />
        <div className="mx-auto max-w-3xl">
          <nav className="mb-4 flex flex-wrap items-center justify-center gap-2 text-sm text-cream/60">
            <Link href="/" className="hover:text-cream">{ar ? "الرئيسية" : "Home"}</Link><span>/</span>
            <Link href="/offers" className="hover:text-cream">{ar ? "العقارات" : "Properties"}</Link>
          </nav>
          <h1 className="font-heading text-3xl font-bold sm:text-5xl">{ar ? `${what} للبيع في حي ${d}` : `${what} for sale in ${d}`}</h1>
          <p className="mt-3 text-cream/70">{ar ? `${list.length} ${list.length > 2 && list.length < 11 ? "عروض" : "عرض"} في حي ${d} بالرياض من بن سلمه العقارية` : `${list.length} listings in ${d}, Riyadh, from Bin Slmah Real Estate`}</p>
        </div>
      </section>
      <section className="relative z-10 mx-auto -mt-14 max-w-6xl px-4 pb-12 sm:px-6">
        <OffersGrid offers={list} whatsappNumber={whatsappNumber} />
      </section>
      {others.length > 0 && <DistrictLinks list={others} ar={ar} />}
    </>
  );
}

