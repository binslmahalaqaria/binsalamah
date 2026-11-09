"use client";

import Script from "next/script";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Meta Pixel for the public site only (not mounted in /admin).
 * - PageView on first load and on every client-side route change.
 * - «Contact» event whenever a visitor taps a WhatsApp link (wa.me / api.whatsapp.com) anywhere on the site,
 *   so the WhatsApp links themselves need no changes.
 * The Pixel ID is not a secret; it can be overridden with NEXT_PUBLIC_META_PIXEL_ID.
 */
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "1798642051341660";

type Fbq = (...args: unknown[]) => void;
declare global {
  interface Window {
    fbq?: Fbq;
    __metaPixelReady?: boolean;
  }
}

export function MetaPixel() {
  const pathname = usePathname();

  // PageView on client-side navigation (the first one is fired by the init script below).
  useEffect(() => {
    if (typeof window.fbq === "function" && window.__metaPixelReady) window.fbq("track", "PageView");
  }, [pathname]);

  // WhatsApp taps -> Contact.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      const href = a?.getAttribute("href") ?? "";
      if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)\b/i.test(href) && typeof window.fbq === "function") {
        window.fbq("track", "Contact");
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!PIXEL_ID) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${PIXEL_ID}');
fbq('track','PageView');
window.__metaPixelReady=true;
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img height="1" width="1" style={{ display: "none" }} alt="" src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`} />
      </noscript>
    </>
  );
}
