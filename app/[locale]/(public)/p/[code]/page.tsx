import { notFound, redirect } from "next/navigation";
import { listPublishedOffers } from "@/lib/offers";

/**
 * Short property links for messages: binslmahre.com/p/<code> → the property
 * page. <code> is the unique tail of the slug (e.g. «mv9vsuhf»), so the link
 * stays short even for Arabic titles.
 */
export default async function ShortLink({ params }: { params: Promise<{ code: string; locale: string }> }) {
  const { code, locale } = await params;
  const c = decodeURIComponent(code).toLowerCase();
  const offers = await listPublishedOffers().catch(() => []);
  const o = offers.find((x) => x.slug.toLowerCase().endsWith("-" + c) || x.id === code);
  if (!o) notFound();
  redirect(`/${locale}/offers/${encodeURIComponent(o.slug)}`);
}
