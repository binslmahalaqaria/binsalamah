import type { Metadata } from "next";
import localFont from "next/font/local";
import { Alexandria, IBM_Plex_Sans_Arabic, Rubik } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { DESC_AR, DESC_EN, KEYWORDS, NAME_AR, NAME_EN, SITE_URL } from "@/lib/seo";
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

// CRM-only fonts, kept from the original artifact CRM at the client's
// request (2026-10-10): Alexandria for headings, IBM Plex Sans Arabic for
// body text. Applied via the .crm scope in globals.css.
const alexandria = Alexandria({
  subsets: ["arabic", "latin"],
  variable: "--font-crm-display",
  weight: ["500", "600", "700"],
});
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  variable: "--font-crm-body",
  weight: ["300", "400", "500", "600", "700"],
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
  const ar = locale === "ar";
  const name = ar ? NAME_AR : NAME_EN;
  const description = ar ? DESC_AR : DESC_EN;
  return {
    metadataBase: new URL(SITE_URL),
    // «بن سلمه العقارية» leads every title so a search for the name finds the site.
    title: { default: ar ? `${NAME_AR} | عقارات للبيع في الرياض` : `${NAME_EN} | Property in Riyadh`, template: `%s | ${name}` },
    description,
    keywords: KEYWORDS,
    applicationName: name,
    alternates: { canonical: `/${locale}`, languages: { ar: "/ar", en: "/en", "x-default": "/ar" } },
    openGraph: {
      type: "website",
      siteName: name,
      title: name,
      description,
      url: `/${locale}`,
      locale: ar ? "ar_SA" : "en_US",
      images: [{ url: "/og.jpg", width: 1200, height: 630, alt: name }],
    },
    twitter: { card: "summary_large_image", title: name, description, images: ["/og.jpg"] },
    robots: { index: true, follow: true },
    // Google Search Console ownership token goes here once the owner verifies the domain.
    verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } : undefined,
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
        className={`${darahModern.variable} ${rubik.variable} ${alexandria.variable} ${plexArabic.variable} min-h-screen font-sans antialiased`}
      >
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
