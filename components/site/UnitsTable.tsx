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
  const chip = (on: boolean) => "rounded-full px-4 py-1.5 text-sm transition-colors " + (on ? "bg-navy text-cream" : "bg-navy/5 text-navy hover:bg-navy/10");
  const badge = (u: OfferUnit) => <span className={"inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 " + STATUS[u.status].cls}>{ar ? STATUS[u.status].ar : STATUS[u.status].en}</span>;
  const ask = (u: OfferUnit) => u.status === "sold" ? null : (
    <WhatsAppLink whatsappNumber={whatsappNumber} message={msg(u)} className="rounded-full border border-navy/20 px-3 py-1.5 text-xs font-medium text-navy transition-colors hover:border-navy hover:text-[#1da851]">{L.ask}</WhatsAppLink>
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-heading text-xl font-bold text-navy">{L.title}</h2>
        <span className="text-sm text-navy/50"><b className="text-navy">{free}</b> {L.of} {units.length}</span>
        <div className="ms-auto flex gap-2">
          <button type="button" className={chip(!onlyFree)} onClick={() => setOnlyFree(false)}>{L.all}</button>
          <button type="button" className={chip(onlyFree)} onClick={() => setOnlyFree(true)}>{L.free}</button>
        </div>
      </div>

      {/* Wide screens: table */}
      <div className="hidden overflow-hidden rounded-2xl border border-navy/10 sm:block">
        <table className="w-full text-sm">
          <thead className="bg-navy/[0.03] text-navy/55">
            <tr>{[L.unit, L.area, L.rooms, L.living, L.baths, L.price, L.status, ""].map((h, i) => <th key={i} className="px-4 py-3 text-start font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {list.map((u, i) => (
              <tr key={i} className={"border-t border-navy/10 " + (u.status === "sold" ? "text-navy/40" : "text-navy")}>
                <td className="px-4 py-3 font-semibold">{ar ? u.name : u.name_en || u.name}</td>
                <td className="px-4 py-3"><bdi>{num(u.area)}</bdi> {L.m}</td>
                <td className="px-4 py-3">{u.rooms ?? "—"}</td>
                <td className="px-4 py-3">{u.living_rooms ?? "—"}</td>
                <td className="px-4 py-3">{u.bathrooms ?? "—"}</td>
                <td className="px-4 py-3 font-heading font-bold"><bdi>{num(u.price)}</bdi> <span className="text-xs font-normal text-navy/50">{L.sar}</span></td>
                <td className="px-4 py-3">{badge(u)}</td>
                <td className="px-4 py-3 text-end">{ask(u)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones: cards */}
      <div className="grid gap-3 sm:hidden">
        {list.map((u, i) => (
          <div key={i} className={"grid gap-2 rounded-2xl border border-navy/10 p-4 " + (u.status === "sold" ? "opacity-60" : "")}>
            <div className="flex items-center justify-between"><b className="text-navy">{ar ? u.name : u.name_en || u.name}</b>{badge(u)}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-navy/70">
              <span><bdi>{num(u.area)}</bdi> {L.m}</span>
              {u.rooms ? <span>{u.rooms} {L.rooms}</span> : null}
              {u.living_rooms ? <span>{u.living_rooms} {L.living}</span> : null}
              {u.bathrooms ? <span>{u.bathrooms} {L.baths}</span> : null}
            </div>
            <div className="flex items-center justify-between">
              <span className="font-heading text-lg font-bold text-navy"><bdi>{num(u.price)}</bdi> <span className="text-xs font-normal text-navy/50">{L.sar}</span></span>
              {ask(u)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
