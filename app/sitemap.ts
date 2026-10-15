import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { listPublishedOffers } from "@/lib/offers";

/** Every public page in both languages, plus each published property. Rebuilt hourly. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["", "/offers", "/about", "/careers"];
  const now = new Date();
  const entry = (path: string, priority: number, lastModified = now): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}/ar${path}`,
    lastModified,
    priority,
    alternates: { languages: { ar: `${SITE_URL}/ar${path}`, en: `${SITE_URL}/en${path}` } },
  });
  const offers = await listPublishedOffers().catch(() => []);
  return [
    ...pages.map((p, i) => entry(p, i === 0 ? 1 : 0.7)),
    ...offers.map((o) => entry(`/offers/${o.slug}`, 0.8, new Date(o.updated_at || Date.now()))),
  ];
}
