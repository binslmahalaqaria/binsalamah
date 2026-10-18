import type { MetadataRoute } from "next";

/**
 * Web app manifest: lets staff install the CRM on a phone or computer
 * ("Add to Home Screen" / "Install app"); it then opens full-screen on the CRM
 * like a native app.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/ar/admin",
    name: "بن سلمه العقارية — النظام",
    short_name: "بن سلمه",
    description: "نظام بن سلمه العقارية: العملاء والطلبات والعقارات والواتساب",
    start_url: "/ar/admin",
    scope: "/",
    display: "standalone",
    orientation: "any",
    dir: "rtl",
    lang: "ar",
    background_color: "#ffffff",
    theme_color: "#333333",
    icons: [
      { src: "/app/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "واتساب", url: "/ar/admin/whatsapp" },
      { name: "الطلبات", url: "/ar/admin/requests" },
      { name: "العملاء", url: "/ar/admin/clients" },
    ],
  };
}
