import { Logo } from "@/components/Logo";
import { SiteHeader } from "@/components/SiteHeader";
import { FloatingWhatsApp } from "@/components/WhatsAppButton";
import { getLocale } from "next-intl/server";
import { getPublicContactInfo } from "@/lib/settings";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const { whatsappNumber } = await getPublicContactInfo();

  return (
    <div className="flex min-h-screen flex-col bg-cream text-navy">
      <SiteHeader whatsappNumber={whatsappNumber} />

      <main className="flex-1">{children}</main>

      <footer className="bg-navy px-6 py-10 font-sans text-cream/80">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center">
          <Logo variant="light" locale={locale} />
          <p className="text-sm">
            © {new Date().getFullYear()}{" "}
            {locale === "ar" ? "بن سلمه العقارية" : "Bin Slmah Real Estate"}
          </p>
        </div>
      </footer>

      <FloatingWhatsApp whatsappNumber={whatsappNumber} />
    </div>
  );
}
