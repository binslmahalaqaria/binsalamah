import { getTranslations } from "next-intl/server";
import { CareerForm } from "@/components/site/CareerForm";

/**
 * Careers, in the spirit of thiraa.sa/join-us but in the Bin Slmah look: a
 * photo banner and the application form (saved as a CRM website enquiry).
 * Just the form — no positions, qualifications or benefits sections (owner's call).
 */
export default async function CareersPage() {
  const t = await getTranslations("Site");
  return (
    <>
      <section className="relative isolate overflow-hidden px-6 py-24 text-center text-cream sm:py-32">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero/riyadh-aerial-1.jpg" alt="" aria-hidden className="absolute inset-0 -z-20 h-full w-full object-cover object-[center_80%] grayscale" />
        <div className="absolute inset-0 -z-10 bg-black/70" />
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4">
          <span className="text-sm tracking-wide text-cream/70">{t("careersKicker")}</span>
          <h1 className="text-4xl sm:text-5xl">{t("careersTitle")}</h1>
          <p className="leading-relaxed text-cream/75">{t("careersSub")}</p>
          <a href="#apply" className="mt-3 rounded-full border border-cream/30 bg-cream/10 px-8 py-3 text-cream backdrop-blur-md transition-colors hover:bg-cream hover:text-navy">{t("careersApplyNow")}</a>
        </div>
      </section>

      <section id="apply" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-16 sm:px-6">
        <h2 className="text-center text-3xl text-navy">{t("careersForm")}</h2>
        <p className="mt-2 mb-8 text-center text-navy/60">{t("careersFormSub")}</p>
        <CareerForm />
      </section>
    </>
  );
}
