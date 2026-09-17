import type { Metadata } from "next";
import localFont from "next/font/local";
import { Rubik } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";

// Real brand font (2026-09-14 identity refresh) — not on Google Fonts, so
// self-hosted from the client-provided .otf files. See CLAUDE.md §2b.
const darahModern = localFont({
  src: [
    { path: "../../fonts/DarahModern-Regular.otf", weight: "400", style: "normal" },
    { path: "../../fonts/DarahModern-Medium.otf", weight: "500", style: "normal" },
  ],
  variable: "--font-darah-modern",
});

const rubik = Rubik({
  subsets: ["arabic", "latin"],
  variable: "--font-rubik",
  weight: ["400", "500", "700"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isArabic = locale === "ar";
  return {
    title: isArabic ? "بن سلمه العقارية" : "Bin Slmah Real Estate",
    description: isArabic
      ? "بن سلمه العقارية — نعرض لك أفضل العروض العقارية المتاحة حاليًا."
      : "Bin Slmah Real Estate — offers and services.",
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir}>
      <body
        className={`${darahModern.variable} ${rubik.variable} min-h-screen font-sans antialiased`}
      >
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
