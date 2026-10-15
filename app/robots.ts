import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/** Search engines: the public site is open; the CRM and APIs are not to be indexed. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/ar/admin", "/en/admin", "/api/"] }],
    sitemap: SITE_URL + "/sitemap.xml",
    host: SITE_URL,
  };
}
