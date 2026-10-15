"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { OfferCard } from "@/components/OfferCard";
import { SEARCH_TYPES } from "@/components/site/SearchBar";
import { PRICE_RANGES, allDistricts, districtKey, districtsIn } from "@/lib/districts";
import { ZonePicker } from "@/components/site/ZonePicker";
import { BudgetChips } from "@/components/site/BudgetChips";
import type { Offer } from "@/lib/types";

/**
 * /offers: type chips plus district, price and rooms. Filters live in the URL
 * (?type=&district=&price=&rooms=) so the home search and district links land
 * here already filtered, and a filtered list can be shared.
 */
/** `districts` is comma-separated in the URL (several can be picked). */
export type OfferFilters = { type?: string; zone?: string; districts?: string; price?: string };

export function OffersGrid({ offers, whatsappNumber, initial = {} }: { offers: Offer[]; whatsappNumber: string; initial?: OfferFilters }) {
  const t = useTranslations("Offers");
  const s = useTranslations("Site");
  const ar = useLocale() === "ar";
  const [f, setF] = useState<OfferFilters>(initial);
  const { type = "", zone = "", districts: dl = "", price = "" } = f;
  const picked = dl ? dl.split(",").filter(Boolean) : [];

  // Filter in the browser and mirror the filters into the address bar (no page reload).
  const set = (k: keyof OfferFilters, v: string, also: OfferFilters = {}) => {
    const next = { ...f, [k]: v, ...also };
    setF(next);
    const q = new URLSearchParams(window.location.search);
    for (const [key, val] of Object.entries(next)) { if (val) q.set(key, val); else q.delete(key); }
    window.history.replaceState(null, "", window.location.pathname + (q.size ? "?" + q.toString() : ""));
  };

  const districts = useMemo(() => allDistricts(offers.map((o) => o.district_ar)), [offers]);
  const range = PRICE_RANGES.find((p) => p.id === price);
  const filtered = offers.filter((o) => {
    if (type && o.type !== type) return false;
    // Picked districts win; otherwise the open area (if any) narrows the list.
    if (picked.length) { if (!picked.includes(districtKey(o.district_ar))) return false; }
    else if (zone && !districtsIn(zone, [districtKey(o.district_ar)]).length) return false;
    if (range && ((o.price_to ?? o.price_from) < range.min || o.price_from >= range.max)) return false;
    return true;
  });

  const chip = (on: boolean) => "min-h-11 rounded-full px-4 py-2 text-sm font-medium transition-colors " + (on ? "bg-navy text-cream" : "bg-navy/5 text-navy hover:bg-navy/10");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 rounded-3xl border border-navy/10 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={chip(!type)} onClick={() => set("type", "")}>{s("allTypes")}</button>
          {SEARCH_TYPES.map((x) => <button key={x} type="button" className={chip(type === x)} onClick={() => set("type", x)}>{s(`typesPlural.${x}`)}</button>)}
        </div>
        <div className="grid gap-2"><span className="text-sm font-semibold text-navy">{s("budget")}</span><BudgetChips value={price} onChange={(v) => set("price", v)} /></div>
        <ZonePicker zone={zone} selected={picked} districts={districts} onZone={(z) => set("zone", z)} onChange={(p) => set("districts", p.join(","))} />
        <div className="flex flex-wrap gap-2">
          {(type || zone || picked.length || price) ? (
            <button type="button" className="text-sm text-gold hover:underline" onClick={() => { setF({}); window.history.replaceState(null, "", window.location.pathname); }}>{ar ? "مسح الفلاتر" : "Clear filters"}</button>
          ) : null}
          <span className="ms-auto self-center text-sm text-navy/50">{filtered.length} {ar ? "عقار" : "properties"}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-navy/20 px-6 py-12 text-center text-navy/60">{t("empty")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((offer) => <OfferCard key={offer.id} offer={offer} whatsappNumber={whatsappNumber} />)}
        </div>
      )}
    </div>
  );
}
