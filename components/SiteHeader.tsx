"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Logo } from "@/components/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { WhatsAppLink } from "@/components/WhatsAppButton";
import { Link, usePathname } from "@/i18n/navigation";


/**
 * Site header in the style of thiraa.sa / rakez.sa:
 *  - on the home page, over the hero photo: the official lockup centred between
 *    two thin gold rules, the menu centred underneath, all in white;
 *  - after scrolling (and on every other page): a compact white bar with the
 *    lockup at the start, the menu in the middle and the actions at the end.
 */
export function SiteHeader({ whatsappNumber }: { whatsappNumber: string }) {
  const t = useTranslations("Nav");
  const st = useTranslations("Site");
  const locale = useLocale();
  const ar = locale === "ar";
  const home = usePathname() === "/";
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 120);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const grand = home && !scrolled && !open;

  const links = [
    { href: "/", label: t("home") },
    { href: "/offers", label: t("offers") },
    { href: "/#map", label: st("map") },
    { href: "/about", label: t("about") },
    { href: "/#request", label: st("request") },
  ];
  const navLink = (light: boolean) =>
    "relative py-1 text-[14px] transition-colors after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:scale-x-0 after:bg-gold after:transition-transform hover:after:scale-x-100 " +
    (light ? "text-cream/90 hover:text-cream" : "text-navy/80 hover:text-navy");

  const burger = (light: boolean) => (
    <button type="button" onClick={() => setOpen((o) => !o)} aria-label={ar ? "القائمة" : "Menu"} aria-expanded={open}
      className={"flex h-10 w-10 items-center justify-center rounded-lg transition-colors lg:hidden " + (light ? "text-cream hover:bg-cream/10" : "text-navy hover:bg-navy/5")}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
        {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
      </svg>
    </button>
  );

  return (
    <>
      {grand ? (
        <header className="absolute inset-x-0 top-0 z-[1000]">
          <div className="mx-auto max-w-7xl px-6 pt-6">
            <div className="flex items-center gap-6">
              <span className="hidden h-px flex-1 bg-gold/60 lg:block" />
              <div className="flex flex-1 justify-start lg:flex-none lg:justify-center"><Logo variant="light" height={60} /></div>
              <span className="hidden h-px flex-1 bg-gold/60 lg:block" />
              {burger(true)}
            </div>
            <nav className="mt-5 hidden items-center justify-center gap-10 lg:flex">
              {links.map((l) => <Link key={l.href} href={l.href} className={navLink(true)}>{l.label}</Link>)}
              <WhatsAppLink whatsappNumber={whatsappNumber} className="rounded-full border border-gold/70 px-5 py-1.5 text-[13px] text-cream transition-colors hover:bg-gold hover:text-navy">{t("contact")}</WhatsAppLink>
              <LanguageSwitcher variant="light" />
            </nav>
          </div>
        </header>
      ) : (
        <header className={(home ? "fixed animate-[fadeDown_.35s_ease-out]" : "sticky") + " inset-x-0 top-0 z-[1000] border-b border-navy/10 bg-white/95 shadow-[0_10px_30px_-25px_rgba(0,0,0,0.4)] backdrop-blur"}>
          {/* Inner pages: a taller bar with a larger logo that eases down to the compact size once scrolled. */}
          <div className={"mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 transition-[padding] duration-300 " + (!home && !scrolled ? "py-5" : "py-3")}>
            <Logo variant="dark" height={!home && !scrolled ? 50 : 38} />
            <nav className="hidden items-center gap-8 lg:flex">
              {links.map((l) => <Link key={l.href} href={l.href} className={navLink(false)}>{l.label}</Link>)}
            </nav>
            <div className="hidden items-center gap-3 lg:flex">
              <WhatsAppLink whatsappNumber={whatsappNumber} className="rounded-full bg-navy px-5 py-2 text-[13px] text-cream transition-colors hover:bg-gold hover:text-navy">{t("contact")}</WhatsAppLink>
              <LanguageSwitcher />
            </div>
            {burger(false)}
          </div>
          {open && (
            <nav className="flex flex-col gap-1 border-t border-navy/10 bg-white px-6 py-4 text-sm lg:hidden">
              {links.map((l) => <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-2 py-3 text-navy hover:bg-navy/5">{l.label}</Link>)}
              <WhatsAppLink whatsappNumber={whatsappNumber} className="mt-2 rounded-full bg-navy px-4 py-2.5 text-center text-cream">{t("contact")}</WhatsAppLink>
              <div className="mt-2"><LanguageSwitcher /></div>
            </nav>
          )}
        </header>
      )}
    </>
  );
}
