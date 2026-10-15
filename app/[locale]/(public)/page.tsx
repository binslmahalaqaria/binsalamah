import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { OfferCard } from "@/components/OfferCard";
import { Hero } from "@/components/site/Hero";
import { SearchBar } from "@/components/site/SearchBar";
import { ProjectsMap } from "@/components/site/ProjectsMap";
import { RequestForm } from "@/components/site/RequestForm";
import { listPublishedOffers } from "@/lib/offers";
import { getPublicContactInfo } from "@/lib/settings";
import { withDemo } from "@/lib/demo-offers";
import { allDistricts, districtKey } from "@/lib/districts";

/**
 * Home: hero (rotating drone photos) → search card → selected properties → map → property request form.
 * Layout ideas taken from riva.sa, thiraa.sa, rakez.sa and Binghatti's landing
 * page, in the Bin Slmah identity (charcoal + gold, Darah Modern headings).
 */


export default async function HomePage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const [t, locale, live, { whatsappNumber }, sp] = await Promise.all([
    getTranslations("Site"),
    getLocale(),
    listPublishedOffers(),
    getPublicContactInfo(),
    searchParams,
  ]);
  const offers = withDemo(live, sp.demo);
  const ar = locale === "ar";

  const featured = [...offers].sort((a, b) => Number(b.featured) - Number(a.featured));
  const slides = featured.filter((o) => o.cover_image).slice(0, 6);
  const counts = new Map<string, number>();
  offers.forEach((o) => { const k = districtKey(o.district_ar); if (k) counts.set(k, (counts.get(k) || 0) + 1); });
  const districts = allDistricts([...counts.keys()]);
  const head = (title: string, sub: string) => (
    <div className="mb-10 flex flex-col gap-2">
      <span className="h-1 w-12 rounded-full bg-gold" />
      <h2 className="font-heading text-3xl font-bold text-navy">{title}</h2>
      <p className="text-navy/60">{sub}</p>
    </div>
  );

  return (
    <>
      <Hero slides={slides} />
      <SearchBar districts={districts} />

      {/* Selected properties */}
      <section className="mx-auto max-w-6xl px-6 pt-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          {head(t("featuredTitle"), t("featuredSub"))}
          {offers.length > 0 && <Link href="/offers" className="mb-10 text-sm font-medium text-gold hover:underline">{t("viewAll")} ←</Link>}
        </div>
        {featured.length ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.slice(0, 6).map((o) => <OfferCard key={o.id} offer={o} whatsappNumber={whatsappNumber} />)}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-navy/20 px-6 py-12 text-center text-navy/60">
            {t("emptyOffers")} <a href="#request" className="font-medium text-gold hover:underline">{t("request")}</a>
          </div>
        )}
      </section>

      {/* Map */}
      <section id="map" className="mx-auto max-w-6xl scroll-mt-20 px-6 pt-20">
        {head(t("mapTitle"), t("mapSub"))}
        <ProjectsMap points={Array.from(counts, ([district, count]) => ({ district, count }))} emptyText={t("mapEmpty")} />
      </section>

      <RequestForm districts={districts} />

    </>
  );
}
