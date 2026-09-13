"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { WhatsAppLink } from "@/components/WhatsAppButton";
import { Link } from "@/i18n/navigation";

export function SiteHeader({ whatsappNumber }: { whatsappNumber: string }) {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  const linkClass = "transition-colors hover:text-gold";

  return (
    <header className="sticky top-0 z-40 border-b border-navy/10 bg-cream/95 backdrop-blur">
      <div className="flex items-center justify-between px-6 py-4">
        <Logo locale={locale} />

        <nav className="hidden items-center gap-6 font-sans text-sm font-medium md:flex">
          <Link href="/" className={linkClass}>
            {t("home")}
          </Link>
          <Link href="/offers" className={linkClass}>
            {t("offers")}
          </Link>
          <Link href="/about" className={linkClass}>
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

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={locale === "ar" ? "القائمة" : "Menu"}
          aria-expanded={open}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-navy transition-colors hover:bg-navy/5 md:hidden"
        >
          {open ? (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-navy/10 px-6 py-4 font-sans text-sm font-medium md:hidden">
          <Link href="/" onClick={() => setOpen(false)} className="rounded-lg px-2 py-2.5 transition-colors hover:bg-navy/5">
            {t("home")}
          </Link>
          <Link href="/offers" onClick={() => setOpen(false)} className="rounded-lg px-2 py-2.5 transition-colors hover:bg-navy/5">
            {t("offers")}
          </Link>
          <Link href="/about" onClick={() => setOpen(false)} className="rounded-lg px-2 py-2.5 transition-colors hover:bg-navy/5">
            {t("about")}
          </Link>
          <WhatsAppLink
            whatsappNumber={whatsappNumber}
            className="mt-2 rounded-full bg-navy px-4 py-2.5 text-center text-cream transition-colors hover:bg-gold"
          >
            {t("contact")}
          </WhatsAppLink>
          <div className="mt-2">
            <LanguageSwitcher />
          </div>
        </nav>
      )}
    </header>
  );
}
