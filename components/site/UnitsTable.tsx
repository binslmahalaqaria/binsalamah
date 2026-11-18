"use client";

/**
 * The units of an offer (e.g. «دور أرضي» 1,150,000 ريال، 190 م²): a table on
 * wide screens, cards on phones, filter all / available, and a WhatsApp
 * enquiry per unit that names it. Sold units stay listed, greyed out.
 */
import { useState } from "react";
import { useLocale } from "next-intl";
import { WhatsAppLink } from "@/components/WhatsAppButton";
import type { OfferUnit } from "@/lib/types";
import { enquiryMessage, type EnquiryOffer } from "@/lib/seo";

const num = (n: number) => n.toLocaleString("en-US");
const STATUS = {
  available: { ar: "متاح", en: "Available", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  reserved: { ar: "محجوز", en: "Reserved", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  sold: { ar: "مباع", en: "Sold", cls: "bg-navy/5 text-navy/45 ring-navy/10" },
};

export function UnitsTable({ units, enquiry, whatsappNumber }: { units: OfferUnit[]; enquiry: EnquiryOffer; whatsappNumber: string }) {
  const ar = useLocale() === "ar";
  const [onlyFree, setOnlyFree] = useState(false);
  const free = units.filter((u) => u.status === "available").length;
  const list = onlyFree ? units.filter((u) => u.status === "available") : units;
  const L = ar
    ? { title: "الوحدات", unit: "الوحدة", area: "المساحة", rooms: "الغرف", living: "الصالات", baths: "دورات المياه", price: "السعر", status: "الحالة", ask: "استفسار", all: "الكل", free: "المتاحة فقط", of: "متاحة من", sar: "ريال", m: "م²" }
    : { title: "Units", unit: "Unit", area: "Area", rooms: "Beds", living: "Living", baths: "Baths", price: "Price", status: "Status", ask: "Enquire", all: "All", free: "Available only", of: "available of", sar: "SAR", m: "m²" };
  const msg = (u: OfferUnit) => enquiryMessage(enquiry, ar ? u : { ...u, name: u.name_en || u.name }, ar);
  const chip = (on: boolean) => "rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors " + (on ? "bg-navy text-cream shadow-sm" : "text-navy/60 hover:text-navy");
  const badge = (u: OfferUnit) => <span className={"inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 " + STATUS[u.status].cls}>{ar ? STATUS[u.status].ar : STATUS[u.status].en}</span>;
  // Reserved/sold units may have no price (client 2026-11-15): show a dash instead of «0 ريال».
  const price = (u: OfferUnit) => u.price > 0 ? <><bdi>{num(u.price)}</bdi> <span className="text-xs font-normal text-navy/50">{L.sar}</span></> : <span className="font-normal text-navy/40">—</span>;
  const ask = (u: OfferUnit) => u.status === "sold" ? null : (
    <WhatsAppLink whatsappNumber={whatsappNumber} message={msg(u)} className="rounded-full border border-navy/20 px-3 py-1.5 text-xs font-medium text-navy transition-colors hover:border-navy hover:text-[#1da851]">{L.ask}</WhatsAppLink>
  );

  // Columns no unit fills (e.g. living rooms on an apartments project) are left out instead of a column of dashes.
  const cols = {
    rooms: units.some((u) => u.rooms), living: units.some((u) => u.living_rooms), baths: units.some((u) => u.bathrooms),
  };
  const heads = [L.unit, L.area, cols.rooms && L.rooms, cols.living && L.living, cols.baths && L.baths, L.price, L.status, ""].filter((h) => h !== false) as string[];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-navy/50"><b className="num font-heading text-lg text-navy">{free}</b> {L.of} <bdi className="num">{units.length}</bdi></span>
        <div className="ms-auto flex gap-1 rounded-full bg-navy/[0.05] p-1">
          <button type="button" className={chip(!onlyFree)} onClick={() => setOnlyFree(false)}>{L.all}</button>
          <button type="button" className={chip(onlyFree)} onClick={() => setOnlyFree(true)}>{L.free}</button>
        </div>
      </div>

      {/* Wide screens: table */}
      <div className="hidden overflow-hidden rounded-3xl border border-navy/[0.08] bg-white shadow-[0_20px_45px_-35px_rgba(0,0,0,0.45)] sm:block">
        <table className="w-full text-[14px]">
          <thead className="bg-[#f7f7f6] text-[12px] text-navy/50">
            <tr>{heads.map((h, i) => <th key={i} className="px-5 py-3.5 text-start font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {list.map((u, i) => (
              <tr key={i} className={"border-t border-navy/[0.07] transition-colors hover:bg-[#fafaf9] " + (u.status === "sold" ? "text-navy/40" : "text-navy")}>
                <td className="px-5 py-4 font-semibold leading-snug">{ar ? u.name : u.name_en || u.name}</td>
                <td className="whitespace-nowrap px-5 py-4"><bdi className="num">{num(u.area)}</bdi> <span className="text-navy/45">{L.m}</span></td>
                {cols.rooms && <td className="px-5 py-4">{u.rooms ?? "—"}</td>}
                {cols.living && <td className="px-5 py-4">{u.living_rooms ?? "—"}</td>}
                {cols.baths && <td className="px-5 py-4">{u.bathrooms ?? "—"}</td>}
                <td className="whitespace-nowrap px-5 py-4 font-heading text-[15px] font-bold">{price(u)}</td>
                <td className="px-5 py-4">{badge(u)}</td>
                <td className="px-5 py-4 text-end">{ask(u)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: cards */}
      <div className="grid gap-3 sm:hidden">
        {list.map((u, i) => (
          <div key={i} className={"grid gap-2.5 rounded-2xl border border-navy/[0.08] bg-white p-4 shadow-[0_10px_25px_-22px_rgba(0,0,0,0.5)] " + (u.status === "sold" ? "opacity-60" : "")}>
            <div className="flex items-center justify-between"><b className="text-navy">{ar ? u.name : u.name_en || u.name}</b>{badge(u)}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-navy/70">
              <span><bdi>{num(u.area)}</bdi> {L.m}</span>
              {u.rooms ? <span>{u.rooms} {L.rooms}</span> : null}
              {u.living_rooms ? <span>{u.living_rooms} {L.living}</span> : null}
              {u.bathrooms ? <span>{u.bathrooms} {L.baths}</span> : null}
            </div>
            <div className="flex items-center justify-between">
              <span className="font-heading text-lg font-bold text-navy">{price(u)}</span>
              {ask(u)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
