import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OffersGrid } from "@/components/OffersGrid";
import { listPublishedOffers } from "@/lib/offers";
import { getPublicContactInfo } from "@/lib/settings";
import { withDemo } from "@/lib/demo-offers";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const ar = locale === "ar";
  return {
    title: ar ? "عقارات للبيع في الرياض" : "Properties for sale in Riyadh",
    description: ar ? "فلل وشقق وأدوار وتاون هاوس وبنتهاوس للبيع في الرياض من بن سلمه العقارية — ابحث حسب الحي والجهة والميزانية." : "Villas, apartments, floors, townhouses and penthouses for sale in Riyadh from Bin Slmah Real Estate.",
    alternates: { canonical: `/${locale}/offers`, languages: { ar: "/ar/offers", en: "/en/offers" } },
  };
}

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ demo?: string; type?: string; zone?: string; district?: string; districts?: string; price?: string }> }) {
  const [t, s, live, { whatsappNumber }, sp] = await Promise.all([
    getTranslations("Offers"),
    getTranslations("Site"),
    listPublishedOffers(),
    getPublicContactInfo(),
    searchParams,
  ]);
  const offers = withDemo(live, sp.demo);

  return (
    <>
      {/* Title band in the style of thiraa.sa: a shade darker than the header (so its rounded corners show), the mark pattern, centred text. */}
      <section className="relative isolate -mt-6 overflow-hidden bg-[#262524] px-6 pt-24 pb-28 text-center text-cream">
        <div aria-hidden className="absolute -inset-1/2 -z-10 -rotate-[18deg] bg-[url(/brand/pattern-footer.png)] bg-[length:96px_96px] opacity-60" />
        <div className="mx-auto max-w-3xl">
          <span className="text-sm tracking-[0.2em] text-[#b79579]">{s("heroKicker")}</span>
          <h1 className="mt-3 font-heading text-4xl font-bold sm:text-5xl">{t("title")}</h1>
          <p className="mt-3 text-cream/70">{s("featuredSub")}</p>
        </div>
      </section>
      <section className="relative z-10 mx-auto -mt-14 max-w-6xl px-4 pb-20 sm:px-6">
        <OffersGrid offers={offers} whatsappNumber={whatsappNumber} initial={{ type: sp.type, zone: sp.zone, districts: sp.districts || sp.district, price: sp.price }} />
      </section>
    </>
  );
}
