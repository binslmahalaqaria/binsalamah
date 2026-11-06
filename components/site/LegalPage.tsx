import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/Logo";
import { COMPANY, PRIVACY_VERSION, type LegalDoc } from "@/lib/legal";

/** One legal document. Lives outside the public layout so it stays reachable while the site shows «قريباً». */
export function LegalPage({ doc, ar }: { doc: LegalDoc; ar: boolean }) {
  return (
    <div className="site min-h-screen bg-cream text-navy">
      <header className="flex items-center justify-center border-b border-navy/10 px-6 py-5">
        <Logo height={44} />
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-heading text-3xl font-bold">{doc.title}</h1>
        <p className="mt-2 text-sm text-navy/50">{ar ? "آخر تحديث: " : "Last updated: "}<span dir="ltr">{PRIVACY_VERSION}</span></p>
        <p className="mt-6 leading-loose text-navy/80">{doc.intro}</p>
        {doc.sections.map((s) => (
          <section key={s.h} className="mt-8">
            <h2 className="font-heading text-xl font-bold">{s.h}</h2>
            {s.li && <ul className="mt-3 list-disc space-y-2 ps-6 leading-loose text-navy/80">{s.li.map((x) => <li key={x}>{x}</li>)}</ul>}
            {s.p?.map((x) => <p key={x} className="mt-3 leading-loose text-navy/80">{x}</p>)}
          </section>
        ))}
      </main>
      <LegalFooter ar={ar} className="border-t border-navy/10 px-6 py-8 text-navy/50" />
    </div>
  );
}

/** Company registration details and legal links, shown in every footer. */
export function LegalFooter({ ar, className }: { ar: boolean; className?: string }) {
  return (
    <div className={"flex flex-col items-center gap-2 text-center text-xs " + (className || "")}>
      <span>
        {ar ? "سجل تجاري: " : "CR: "}<bdi dir="ltr">{COMPANY.cr}</bdi>
        {" · "}{ar ? "الرقم الضريبي: " : "VAT: "}<bdi dir="ltr">{COMPANY.vat}</bdi>
        {COMPANY.falNo && <>{" · "}{ar ? "رخصة فال: " : "FAL licence: "}<bdi dir="ltr">{COMPANY.falNo}</bdi></>}
      </span>
      <span className="flex gap-4">
        <Link href="/privacy" className="underline-offset-2 hover:underline">{ar ? "سياسة الخصوصية" : "Privacy Policy"}</Link>
        <Link href="/terms" className="underline-offset-2 hover:underline">{ar ? "شروط الاستخدام" : "Terms of Use"}</Link>
      </span>
    </div>
  );
}
