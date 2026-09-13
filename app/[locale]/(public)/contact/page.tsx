import { getTranslations } from "next-intl/server";
import { WhatsAppLink } from "@/components/WhatsAppButton";
import { getPublicContactInfo } from "@/lib/settings";

export default async function ContactPage() {
  const t = await getTranslations("Contact");
  const { whatsappNumber, contactEmail, contactPhone } = await getPublicContactInfo();

  return (
    <section className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-8 font-heading text-3xl font-bold text-navy">{t("title")}</h1>
      <div className="flex flex-col gap-4">
        <WhatsAppLink
          whatsappNumber={whatsappNumber}
          className="flex items-center justify-between rounded-2xl bg-navy/5 p-4 font-medium text-navy transition-colors hover:bg-navy/10"
        >
          <span>{t("whatsapp")}</span>
          <span className="text-gold">{whatsappNumber}</span>
        </WhatsAppLink>

        {contactEmail && (
          <a
            href={`mailto:${contactEmail}`}
            className="flex items-center justify-between rounded-2xl bg-navy/5 p-4 font-medium text-navy transition-colors hover:bg-navy/10"
          >
            <span>{t("email")}</span>
            <span className="text-gold">{contactEmail}</span>
          </a>
        )}

        {contactPhone && (
          <a
            href={`tel:${contactPhone}`}
            className="flex items-center justify-between rounded-2xl bg-navy/5 p-4 font-medium text-navy transition-colors hover:bg-navy/10"
          >
            <span>{t("phone")}</span>
            <span className="text-gold">{contactPhone}</span>
          </a>
        )}
      </div>
    </section>
  );
}
