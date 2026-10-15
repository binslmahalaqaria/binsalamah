import { getTranslations } from "next-intl/server";

const MAP_URL = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("طريق عثمان بن عفان، حي النرجس، الرياض");

/** About: the company summary, the office address with a map link, . */
export default async function AboutPage() {
  const t = await getTranslations("Site");
  return (
    <section className="mx-auto grid max-w-3xl gap-6 px-6 py-16">
      <h1 className="text-3xl text-navy">{t("aboutTitle")}</h1>
      <p className="text-lg leading-loose text-navy/80">{t("aboutBody")}</p>
      <div className="grid gap-2 rounded-2xl border border-navy/10 bg-white p-5">
        <span className="text-sm text-navy/50">{t("footerContact")}</span>
        <a href={MAP_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy hover:text-gold">{t("address")}</a>
        <a href={MAP_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-gold hover:underline">{t("mapLink")} ←</a>
      </div>
    </section>
  );
}
