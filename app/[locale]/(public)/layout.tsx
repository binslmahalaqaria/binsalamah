import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { WhatsAppLink, FloatingWhatsApp } from "@/components/WhatsAppButton";
import { Link } from "@/i18n/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { getPublicContactInfo } from "@/lib/settings";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("Nav");
  const locale = await getLocale();
  const { whatsappNumber } = await getPublicContactInfo();

  return (
    <div className="flex min-h-screen flex-col bg-cream text-navy">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-navy/10 bg-cream/95 px-6 py-4 backdrop-blur">
        <Logo locale={locale} />
        <nav className="flex items-center gap-6 font-sans text-sm font-medium">
          <Link href="/" className="transition-colors hover:text-gold">
            {t("home")}
          </Link>
          <Link href="/offers" className="transition-colors hover:text-gold">
            {t("offers")}
          </Link>
          <Link href="/about" className="transition-colors hover:text-gold">
            {t("about")}
          </Link>
          <WhatsAppLink
            whatsappNumber={whatsappNumber}
            className="rounded-full bg-navy px-4 py-2 text-cream transition-colors hover:bg-gold"
          >
            {t("contact")}
          </WhatsAppLink>
          <LanguageSwitcher />
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-navy px-6 py-10 font-sans text-cream/80">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center">
          <Logo variant="light" locale={locale} />
          <p className="text-sm">
            © {new Date().getFullYear()}{" "}
            {locale === "ar" ? "بن سلمه العقارية" : "Bin Salmah Real Estate"}
          </p>
        </div>
      </footer>

      <FloatingWhatsApp whatsappNumber={whatsappNumber} />
    </div>
  );
}
