import { Link } from "@/i18n/navigation";
import { districtPath } from "@/lib/seo-listing";

/** Links to each district's page (client 2026-11-08, SEO): lets visitors and Google reach every district page. */
export function DistrictLinks({ list, ar }: { list: [string, number][]; ar: boolean }) {
  if (!list.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-6 pb-20">
      <h2 className="mb-4 font-heading text-xl font-bold text-navy">{ar ? "تصفّح العقارات حسب الحي" : "Browse by district"}</h2>
      <div className="flex flex-wrap gap-2">
        {list.map(([d, n]) => (
          <Link key={d} href={districtPath(d)} className="rounded-full border border-navy/15 bg-white px-4 py-2 text-sm text-navy hover:border-navy/40">
            {ar ? "عقارات حي " + d : d} <span className="text-navy/50">({n})</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
