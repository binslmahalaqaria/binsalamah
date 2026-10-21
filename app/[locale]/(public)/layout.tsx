import { Logo } from "@/components/Logo";
import { SiteHeader } from "@/components/SiteHeader";
import { FloatingWhatsApp, WhatsAppLink } from "@/components/WhatsAppButton";
import { Link } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getPublicContactInfo } from "@/lib/settings";
import { SOCIAL, organizationJsonLd } from "@/lib/seo";
import { IconInstagram, IconMail, IconPhone, IconPin, IconX } from "@/components/site/icons";
import { Splash } from "@/components/site/Splash";

/** Office: An Narjis, Othman Bin Affan Road, Riyadh. */
const MAP_URL = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("طريق عثمان بن عفان، حي النرجس، الرياض");

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const [{ whatsappNumber, contactEmail }, t, nav] = await Promise.all([
    getPublicContactInfo(),
    getTranslations("Site"),
    getTranslations("Nav"),
  ]);
  const ar = locale === "ar";

  return (
    <div className="site flex min-h-screen flex-col bg-cream text-navy">
      {/* Tells Google who we are (name, other spellings, logo, address) — for searches like «بن سلمه العقارية». */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd(whatsappNumber)) }} />
      <Splash />
      <SiteHeader whatsappNumber={whatsappNumber} />

      <main className="flex-1">{children}</main>

      {/* Footer in the style of thiraa.sa (with a pattern of our own mark): the lockup between two thin rules, a short
          «contact us» band (WhatsApp, email, office, CR) and the copyright — few links. */}
      <footer className="relative isolate overflow-hidden bg-[#2b2a28] px-6 pt-14 pb-8 text-sm text-cream/75">
        {/* Background: small Bin Slmah marks, alternating faint and dark, the whole layer tilted (public/brand/pattern-footer.png, built from the logo). */}
        <div aria-hidden className="absolute -inset-1/2 -z-10 -rotate-[18deg] bg-[url(/brand/pattern-footer.png)] bg-[length:96px_96px]" />
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-6">
            <span className="h-px flex-1 bg-cream/20" />
            <Logo variant="light" height={52} />
            <span className="h-px flex-1 bg-cream/20" />
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center leading-relaxed text-cream/60">{t("aboutBody")}</p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
            {whatsappNumber && (
              <WhatsAppLink whatsappNumber={whatsappNumber} className="flex items-center gap-3 transition-colors hover:text-cream">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-cream/25 text-cream"><IconPhone /></span>
                <bdi dir="ltr">+{whatsappNumber.replace(/\D/g, "")}</bdi>
              </WhatsAppLink>
            )}
            {contactEmail && (
              <a href={"mailto:" + contactEmail} className="flex items-center gap-3 transition-colors hover:text-cream">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-cream/25 text-cream"><IconMail /></span>
                <span dir="ltr">{contactEmail}</span>
              </a>
            )}
            <a href={MAP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 transition-colors hover:text-cream">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-cream/25 text-cream"><IconPin /></span>
              {t("address")}
            </a>
          </div>

          {/* Social accounts. */}
          <div className="mt-8 flex items-center justify-center gap-3">
            {SOCIAL.map((x) => (
              <a key={x.id} href={x.url} target="_blank" rel="noopener noreferrer" aria-label={x.label + " @" + x.handle} title={"@" + x.handle}
                className="grid h-10 w-10 place-items-center rounded-full border border-cream/25 text-[18px] text-cream transition-colors hover:border-cream hover:bg-cream hover:text-navy">
                {x.id === "instagram" ? <IconInstagram /> : <IconX />}
              </a>
            ))}
          </div>

          <div className="mx-auto mt-10 h-px max-w-xl bg-cream/15" />
          <div className="mt-6 flex flex-col items-center gap-2 text-xs text-cream/50">
            <span>© {new Date().getFullYear()} {ar ? "جميع الحقوق محفوظة لبن سلمه العقارية" : "All rights reserved — Bin Slmah Real Estate"}</span>
            <span className="flex gap-4">
              <Link href="/careers" className="hover:text-cream">{nav("careers")}</Link>
            </span>
          </div>
        </div>
      </footer>

      <FloatingWhatsApp whatsappNumber={whatsappNumber} />
    </div>
  );
}
