import { getTranslations } from "next-intl/server";

// Real company story/mission content is still pending from the client —
// see CLAUDE.md §8/§12. This is placeholder copy in the meantime.
export default async function AboutPage() {
  const t = await getTranslations("About");

  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-6 font-heading text-3xl font-bold text-navy">{t("title")}</h1>
      <p className="text-lg leading-relaxed text-navy/80">{t("body")}</p>
    </section>
  );
}
