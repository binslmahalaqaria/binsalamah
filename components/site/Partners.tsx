/**
 * «شركاء النجاح»: partner logos scrolling continuously across the page. Logos
 * live in /public/partners (taken from each company's own site) and are shown
 * in one ink colour so the strip stays calm; hovering pauses and reveals.
 * Add a partner by dropping its logo in /public/partners and listing it here.
 */
const PARTNERS: { name: string; logo: string; h: number }[] = [
  { name: "دار الأركان", logo: "/partners/daralarkan.webp", h: 44 },
  { name: "الرمز", logo: "/partners/alramz.svg", h: 30 },
  { name: "سقيفة للتطوير العقاري", logo: "/partners/saqeefah.svg", h: 40 },
  { name: "رَواح للتطوير العقاري", logo: "/partners/rawah.webp", h: 42 },
  { name: "روز فيلا", logo: "/partners/rosevilla.webp", h: 46 },
];

export function Partners({ title }: { title: string }) {
  if (!PARTNERS.length) return null;
  // Repeat enough times to fill wide screens, then twice for a seamless loop.
  const row = Array.from({ length: Math.max(4, Math.ceil(12 / PARTNERS.length)) }, () => PARTNERS).flat();
  return (
    <section className="mx-auto max-w-6xl px-6 pt-20">
      <h2 className="mb-8 text-center text-2xl text-navy">{title}</h2>
      <div className="group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]" dir="ltr">
        <div className="flex w-max animate-[marquee_40s_linear_infinite] items-center gap-16 group-hover:[animation-play-state:paused]">
          {[...row, ...row].map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={p.logo} alt={p.name} title={p.name} style={{ height: p.h }}
              className="w-auto shrink-0 opacity-50 brightness-0 transition-opacity duration-300 hover:opacity-90" />
          ))}
        </div>
      </div>
    </section>
  );
}
