import { getLocale } from "next-intl/server";
import { Logo } from "@/components/Logo";
import { RequestForm } from "@/components/site/RequestForm";
import { IconInstagram, IconTikTok, IconX } from "@/components/site/icons";
import { allDistricts } from "@/lib/districts";
import { SOCIAL } from "@/lib/seo";

/**
 * "انتظرونا قريباً" — shown instead of the whole public site while COMING_SOON is on
 * (lib/site-mode.ts): the lockup, a short line, and the property request form only.
 */
export async function ComingSoon() {
  const ar = (await getLocale()) === "ar";
  return (
    <main className="flex min-h-screen flex-col">
      <section className="relative isolate overflow-hidden bg-[#2b2a28] px-6 pt-16 pb-28 text-center text-cream">
        <div aria-hidden className="absolute -inset-1/2 -z-10 -rotate-[18deg] bg-[url(/brand/pattern-footer.png)] bg-[length:96px_96px] opacity-60" />
        <div className="mx-auto flex max-w-2xl flex-col items-center">
          <Logo variant="light" layout="stack" height={96} link={false} />
          <div className="mt-10 flex w-full items-center gap-5">
            <span className="h-px flex-1 bg-cream/25" />
            <span className="text-xs tracking-[0.3em] text-cream/60">{ar ? "قريباً" : "COMING SOON"}</span>
            <span className="h-px flex-1 bg-cream/25" />
          </div>
          <h1 className="mt-6 font-heading text-4xl font-bold sm:text-5xl">{ar ? "انتظرونا قريباً" : "Coming soon"}</h1>
          <p className="mt-4 max-w-lg leading-relaxed text-cream/70">
            {ar
              ? "نعمل على إطلاق موقعنا الجديد. سجّل طلبك العقاري الآن، وسيتواصل معك أحد مستشارينا."
              : "Our new website is on its way. Register your property request now and one of our advisors will contact you."}
          </p>
          <a href="#request" className="mt-8 rounded-full bg-cream px-7 py-3 text-sm font-semibold text-navy transition-opacity hover:opacity-90">
            {ar ? "سجّل طلبك" : "Register your request"}
          </a>
        </div>
      </section>

      <div className="-mt-20 flex-1">
        <RequestForm districts={allDistricts([])} />
      </div>

      <footer className="flex flex-col items-center gap-4 border-t border-navy/10 px-6 py-8 text-xs text-navy/50">
        <div className="flex gap-3">
          {SOCIAL.map((x) => (
            <a key={x.id} href={x.url} target="_blank" rel="noopener noreferrer" aria-label={x.label + " @" + x.handle}
              className="grid h-10 w-10 place-items-center rounded-full border border-navy/15 text-[18px] text-navy transition-colors hover:bg-navy hover:text-cream">
              {x.id === "instagram" ? <IconInstagram /> : x.id === "tiktok" ? <IconTikTok /> : <IconX />}
            </a>
          ))}
        </div>
        <span>© {new Date().getFullYear()} {ar ? "جميع الحقوق محفوظة لبن سلمه العقارية" : "All rights reserved — Bin Slmah Real Estate"}</span>
      </footer>
    </main>
  );
}
