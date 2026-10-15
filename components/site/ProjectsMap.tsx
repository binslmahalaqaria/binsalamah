"use client";

/**
 * Map of north Riyadh with one gold pin per district that has offers, showing
 * how many; clicking a pin opens /offers filtered to that district. Leaflet is
 * loaded in the browser only (it touches `window`), on Esri's light-grey canvas (no key needed; OSM's own tile servers block sites like this).
 */
import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import "leaflet/dist/leaflet.css";
import { DISTRICTS } from "@/lib/districts";

export interface MapPoint { district: string; count: number }

export function ProjectsMap({ points, emptyText }: { points: MapPoint[]; emptyText: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const ar = locale === "ar";
  const key = points.map((p) => p.district + p.count).join("|");

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let dead = false;
    import("leaflet").then((L) => {
      if (dead || !ref.current) return;
      map = L.map(ref.current, { scrollWheelZoom: false, attributionControl: true, zoomControl: true }).setView([24.79, 46.66], 12);
      const esri = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/";
      L.tileLayer(esri + "World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", { maxZoom: 16, attribution: "Tiles &copy; Esri — Esri, HERE, Garmin, &copy; OpenStreetMap contributors" }).addTo(map);
      L.tileLayer(esri + "World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}", { maxZoom: 16 }).addTo(map);
      const pts = points.filter((p) => DISTRICTS[p.district]);
      const bounds: [number, number][] = [];
      for (const p of pts) {
        const d = DISTRICTS[p.district];
        bounds.push(d.at);
        const label = ar ? p.district : d.en;
        const icon = L.divIcon({
          className: "",
          iconSize: [0, 0],
          html: `<a href="/${locale}/offers?district=${encodeURIComponent(p.district)}" style="transform:translate(-50%,-50%);display:inline-flex;align-items:center;gap:6px;white-space:nowrap;background:#333;color:#fff;border-radius:999px;padding:4px 10px 4px 4px;font:600 12px/1 var(--font-crm-body),sans-serif;box-shadow:0 6px 18px -6px rgba(0,0,0,.45);text-decoration:none">
            <span style="display:grid;place-items:center;min-width:22px;height:22px;border-radius:999px;background:#b8b8b8;color:#333">${p.count}</span>${label}</a>`,
        });
        L.marker(d.at, { icon }).addTo(map);
      }
      // Measure again once the page has laid out, then frame the pins.
      const fit = () => {
        if (!map) return;
        map.invalidateSize();
        if (bounds.length > 1) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
        else if (bounds.length === 1) map.setView(bounds[0], 13);
      };
      fit();
      setTimeout(fit, 300);
    });
    return () => { dead = true; map?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, locale]);

  return (
    <div className="relative isolate overflow-hidden rounded-3xl border border-navy/10">
      <div ref={ref} dir="ltr" className="h-[420px] w-full bg-navy/5" />
      {!points.some((p) => DISTRICTS[p.district]) && (
        <div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center">
          <span className="rounded-full bg-white/90 px-4 py-2 text-sm text-navy/70 shadow">{emptyText}</span>
        </div>
      )}
    </div>
  );
}
