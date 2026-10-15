"use client";

/**
 * Area → districts picker, like rakez.sa: a row of area tabs (all / north /
 * east / centre / west / south); choosing an area lists its districts as
 * chips. Several districts can be picked, across areas — switching area keeps
 * the picks, which are listed above the tabs with × to remove. Shared by the
 * home search, /offers and the request form.
 */
import { useLocale, useTranslations } from "next-intl";
import { DISTRICTS, RIYADH_ZONES, districtsIn } from "@/lib/districts";

export function ZonePicker({ zone, selected, districts, onZone, onChange }: {
  zone: string; selected: string[]; districts: string[];
  onZone: (z: string) => void; onChange: (picked: string[]) => void;
}) {
  const t = useTranslations("Site");
  const ar = useLocale() === "ar";
  const name = (d: string) => (ar ? d : DISTRICTS[d]?.en || d);
  const toggle = (d: string) => onChange(selected.includes(d) ? selected.filter((x) => x !== d) : [...selected, d]);
  const tab = (on: boolean) =>
    "min-h-11 shrink-0 whitespace-nowrap border-b-2 px-3 pb-2 pt-1 text-sm font-medium transition-colors " +
    (on ? "border-navy text-navy" : "border-transparent text-navy/55 hover:text-navy");
  const chip = (on: boolean) =>
    "min-h-10 rounded-full border px-3.5 py-1.5 text-sm transition-colors " +
    (on ? "border-navy bg-navy text-cream" : "border-navy/15 bg-white text-navy hover:border-navy/40");
  const list = zone ? districtsIn(zone, districts) : [];

  return (
    <div className="grid gap-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-navy/55">{t("pickedDistricts")}:</span>
          {selected.map((d) => (
            <button key={d} type="button" onClick={() => toggle(d)} className="flex items-center gap-1.5 rounded-full bg-gold/20 px-3 py-1 text-navy hover:bg-gold/35">
              {name(d)} <span aria-hidden>×</span>
            </button>
          ))}
          <button type="button" onClick={() => onChange([])} className="text-gold hover:underline">{t("clearAll")}</button>
        </div>
      )}
      <div className="flex gap-1 overflow-x-auto border-b border-navy/10 [scrollbar-width:none]">
        <button type="button" className={tab(!zone)} onClick={() => onZone("")}>{t("anyZone")}</button>
        {RIYADH_ZONES.map((z) => {
          const n = selected.filter((d) => z.districts.includes(d)).length;
          return (
            <button key={z.id} type="button" className={tab(zone === z.id)} onClick={() => onZone(z.id)}>
              {ar ? z.ar : z.en}{n ? <span className="ms-1.5 rounded-full bg-gold px-1.5 text-[11px] text-navy">{n}</span> : null}
            </button>
          );
        })}
      </div>
      {list.length > 0 && (
        <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
          {list.map((d) => (
            <button key={d} type="button" aria-pressed={selected.includes(d)} className={chip(selected.includes(d))} onClick={() => toggle(d)}>
              {selected.includes(d) ? "✓ " : ""}{name(d)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
