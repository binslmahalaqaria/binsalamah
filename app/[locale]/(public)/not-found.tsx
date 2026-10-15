import { Link } from "@/i18n/navigation";

/** Shown for unknown pages and for properties that are not (or no longer) published. */
export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-28 text-center">
      <span className="text-6xl font-bold text-navy/15">404</span>
      <h1 className="text-2xl text-navy">الصفحة غير موجودة</h1>
      <p className="text-navy/60">ربما تم بيع العقار أو تغيّر الرابط. تصفح العقارات المتاحة الآن.</p>
      <div className="flex gap-3">
        <Link href="/offers" className="rounded-full bg-navy px-6 py-2.5 text-cream">العقارات</Link>
        <Link href="/" className="rounded-full border border-navy/20 px-6 py-2.5 text-navy">الرئيسية</Link>
      </div>
    </section>
  );
}
