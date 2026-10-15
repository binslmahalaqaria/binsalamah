"use client";

/**
 * Search card under the hero: property-type chips, area tabs with district
 * chips (like rakez.sa) and price. Submitting opens /offers with the same filters in the URL, which
 * OffersGrid reads — so a search can be shared as a link.
 */
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { BudgetChips } from "@/components/site/BudgetChips";
import { ZonePicker } from "@/components/site/ZonePicker";
import type { OfferType } from "@/lib/types";

/** Property types in the order the owner set: فلل، شقق، أدوار، بنتهاوس، تاون هاوس، أرض، أخرى. */
export const SEARCH_TYPES: OfferType[] = ["villa", "apartment", "floor", "penthouse", "townhouse", "land", "other"];

export function SearchBar({ districts }: { districts: string[] }) {
  const t = useTranslations("Site");
  const router = useRouter();
  const [type, setType] = useState("");
  const [zone, setZone] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [price, setPrice] = useState("");

  function go() {
    const q = new URLSearchParams();
    if (type) q.set("type", type);
    if (zone) q.set("zone", zone);
    if (picked.length) q.set("districts", picked.join(","));
    if (price) q.set("price", price);
    router.push("/offers" + (q.size ? "?" + q.toString() : ""));
  }
  const chip = (on: boolean) => "min-h-11 shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-center text-sm font-medium transition-colors " + (on ? "bg-navy text-cream" : "bg-navy/5 text-navy hover:bg-navy/10");

  return (
    <div className="relative z-10 mx-auto -mt-20 max-w-5xl px-4">
      <div className="grid gap-4 rounded-3xl bg-white p-5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)] sm:p-6">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-8 sm:overflow-visible sm:px-0 sm:pb-0">
          <button type="button" className={chip(!type)} onClick={() => setType("")}>{t("allTypes")}</button>
          {SEARCH_TYPES.map((x) => <button key={x} type="button" className={chip(type === x)} onClick={() => setType(x)}>{t(`typesPlural.${x}`)}</button>)}
        </div>
        <ZonePicker zone={zone} selected={picked} districts={districts} onZone={setZone} onChange={setPicked} />
        <div className="grid gap-2">
          <span className="text-sm font-semibold text-navy">{t("budget")}</span>
          <BudgetChips value={price} onChange={setPrice} />
        </div>
        <button type="button" onClick={go} className="min-h-12 rounded-xl bg-navy px-10 py-3 text-base font-medium text-cream transition-colors hover:bg-navy/90">{t("search")}</button>
      </div>
    </div>
  );
}
