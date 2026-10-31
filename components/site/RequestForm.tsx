"use client";

/**
 * "سجّل طلبك العقاري": property type → purpose → city and district (an area at
 * least — required) → budget (typed freely) → name + mobile. It creates a
 * normal website lead whose message spells out the request, so it lands in the
 * CRM's website enquiries like any other. Riyadh offers a district list;
 * other cities take the district as free text.
 */
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createPublicLead } from "@/lib/leads";
import { RIYADH_ZONES } from "@/lib/districts";
import { PhoneInput } from "@/components/site/PhoneInput";
import { ZonePicker } from "@/components/site/ZonePicker";
import { SEARCH_TYPES } from "@/components/site/SearchBar";
import { Link } from "@/i18n/navigation";
import { listPublishedOffers } from "@/lib/offers";
import { parseBudget } from "@/lib/budget";
import type { Offer } from "@/lib/types";

/** Same types and order as the search bar; "أخرى" asks the visitor to name it. The CRM reads the lead in Arabic. */
// The request form also offers «عمارة» (buildings), which the public offers search does not have.
const FORM_TYPES = [...SEARCH_TYPES, "building"] as const;
type FormType = (typeof FORM_TYPES)[number];
const TYPE_AR: Record<FormType, string> = { apartment: "شقة", floor: "دور", villa: "فيلا", penthouse: "بنتهاوس", townhouse: "تاون هاوس", land: "أرض", building: "عمارة", other: "أخرى" };
const PURPOSES = ["reqBuy", "reqInvest", "reqRent"] as const;
const PURPOSE_AR = { reqBuy: "شراء للسكن", reqInvest: "شراء للاستثمار", reqRent: "إيجار" };
/** How the buyer pays (client 2026-10-25); stored in the CRM as كاش / بنك / بنك + كاش. */
const PAYS = ["payCash", "payBank", "payBoth"] as const;
const PAY_AR = { payCash: "كاش", payBank: "بنك", payBoth: "بنك + كاش" };
const CITIES: { ar: string; en: string }[] = [
  { ar: "الرياض", en: "Riyadh" }, { ar: "جدة", en: "Jeddah" }, { ar: "مكة المكرمة", en: "Makkah" }, { ar: "المدينة المنورة", en: "Madinah" },
  { ar: "الدمام", en: "Dammam" }, { ar: "الخبر", en: "Khobar" }, { ar: "الظهران", en: "Dhahran" }, { ar: "القصيم", en: "Qassim" },
  { ar: "أبها", en: "Abha" }, { ar: "الطائف", en: "Taif" }, { ar: "تبوك", en: "Tabuk" }, { ar: "حائل", en: "Hail" },
];
const OTHER = "__other";

const saudiMobile = (s: string) => {
  const d = s.replace(/[^\d]/g, "").replace(/^00/, "");
  const m = /^(?:966|0)?(5\d{8})$/.exec(d);
  return m ? "0" + m[1] : null;
};

export function RequestForm({ districts, noLinks }: { districts: string[]; noLinks?: boolean }) {
  const t = useTranslations("Site");
  const ar = useLocale() === "ar";
  const [type, setType] = useState<FormType | "">("");
  const [otherType, setOtherType] = useState("");
  const [purpose, setPurpose] = useState<(typeof PURPOSES)[number] | "">("");
  const [city, setCity] = useState("الرياض");
  const [otherCity, setOtherCity] = useState("");
  const [zone, setZone] = useState("");
  const [district, setDistrict] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [budget, setBudget] = useState("");
  const [area, setArea] = useState("");
  const [areaTo, setAreaTo] = useState("");
  const [pay, setPay] = useState<(typeof PAYS)[number] | "">("");
  const [matches, setMatches] = useState<Offer[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  const riyadh = city === "الرياض";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const mobile = saudiMobile(phone);
    if (!type) return setErr(t("reqNeedType"));
    if (name.trim().length < 2) return setErr(t("reqNeedName"));
    if (!mobile) return setErr(t("reqNeedPhone"));
    // Location is required: in Riyadh at least an area (north, west, …) or a district; elsewhere the district name.
    if (riyadh ? !zone && !picked.length : !district.trim()) return setErr(t("reqNeedArea"));
    // A zone alone isn't enough: at least one district in it (client 2026-10-24).
    if (riyadh && !picked.length) return setErr(t("reqNeedDistrict"));
    if (city === OTHER && !otherCity.trim()) return setErr(t("reqNeedArea"));
    setErr("");
    setState("sending");
    const cityName = city === OTHER ? otherCity.trim() || "غير محددة" : city;
    const message = [
      "طلب عقاري من الموقع", "النوع: " + (type === "other" ? otherType.trim() || "أخرى" : type ? TYPE_AR[type] : ""), "الغرض: " + (purpose ? PURPOSE_AR[purpose] : "غير محدد"),
      "المدينة: " + cityName + (riyadh ? " — " + (picked.length ? Array.from(new Set(picked.map((d) => RIYADH_ZONES.find((z) => z.districts.includes(d))?.ar).filter(Boolean))).join("، ") : RIYADH_ZONES.find((z) => z.id === zone)?.ar) : ""), (picked.length > 1 ? "الأحياء: " : "الحي: ") + ((riyadh ? picked.join("، ") : district.trim()) || "غير محدد"), "الميزانية: " + (budget.trim() || "غير محددة"),
      ...(pay ? ["الدفع: " + PAY_AR[pay]] : []),
      ...(() => {
        const a = Number(area.replace(/[^\d]/g, "")), b = Number(areaTo.replace(/[^\d]/g, ""));
        return a && b ? ["المساحة: " + a + " – " + b + " م²"] : a ? ["المساحة: من " + a + " م²"] : b ? ["المساحة: حتى " + b + " م²"] : [];
      })(),
    ].join(" | ");
    try {
      await createPublicLead({ customer_name: name.trim(), phone: mobile, message, related_offer_id: null });
      setState("done");
      // Listings on the site that fit what was asked: type, district/area, budget (+10%), size (−10%).
      if (purpose !== "reqRent") listPublishedOffers().then((all) => {
        const b = parseBudget(budget), a = Number(area.replace(/[^\d]/g, "")) || 0, ax = Number(areaTo.replace(/[^\d]/g, "")) || 0;
        const zoneDists = riyadh && !picked.length ? RIYADH_ZONES.find((z) => z.id === zone)?.districts || [] : [];
        const fit = all.filter((o) => {
          if (type && type !== "other" && o.type !== type) return false;
          if (riyadh ? (picked.length ? !picked.includes(o.district_ar) : zoneDists.length && !zoneDists.includes(o.district_ar)) : district.trim() && !o.district_ar.includes(district.trim())) return false;
          if (b && o.price_from && o.price_from > b * 1.1) return false;
          if (a && (o.area_to || o.area_from) && (o.area_to || o.area_from) < a * 0.9) return false;
          if (ax && o.area_from && o.area_from > ax * 1.1) return false;
          return (o.sold_percentage ?? 0) < 100;
        });
        setMatches(fit.slice(0, 6));
      }).catch(() => {});
    } catch {
      setState("error");
    }
  }

  const chip = (on: boolean) =>
    "min-h-11 rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition-colors " +
    (on ? "border-gold bg-gold/15 text-navy ring-1 ring-gold" : "border-navy/15 bg-white text-navy hover:border-navy/40");
  const field = "w-full rounded-xl border border-navy/15 bg-white px-4 py-3 text-sm text-navy";
  const step = (n: number, label: string) => (
    <span className="mb-3 flex items-center gap-2 font-heading font-bold text-navy">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-navy text-xs text-cream">{n}</span>{label}
    </span>
  );

  return (
    <section id="request" className="scroll-mt-20 px-4 py-20">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-navy/10 bg-white shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)]">
        <div className="relative bg-navy px-6 py-8 text-cream sm:px-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-mark-hd-white.png" alt="" aria-hidden className="absolute top-1/2 h-24 -translate-y-1/2 opacity-20 ltr:right-8 rtl:left-8" />
          <span className="rounded-full bg-gold/20 px-3 py-1 text-xs text-gold">{t("reqKicker")}</span>
          <h2 className="mt-3 font-heading text-2xl font-bold sm:text-3xl">{t("reqTitle")}</h2>
          <p className="mt-2 max-w-xl text-sm text-cream/75">{t("reqSub")}</p>
        </div>

        {state === "done" ? (
          <div className="px-6 py-10 sm:px-10">
            <p className="text-center text-lg font-medium text-navy">{t("reqDone")}</p>
            {matches.length > 0 && (
              <div className="mt-8">
                <h3 className="mb-3 font-heading text-lg font-bold text-navy">{t("reqMatches")}</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {matches.map((o) => {
                    const body = (
                      <div className="overflow-hidden rounded-2xl border border-navy/10 bg-white">
                        {(o.cover_image || o.images?.[0]?.url) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={o.cover_image || o.images[0].url} alt={ar ? o.title_ar : o.title_en} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                        )}
                        <div className="grid gap-1 p-3 text-sm text-navy">
                          <b className="font-heading">{ar ? o.title_ar : o.title_en}</b>
                          <span className="text-navy/60">{ar ? o.district_ar : o.district_en}{o.area_from ? " · " + o.area_from + (o.area_to ? "–" + o.area_to : "") + " م²" : ""}</span>
                          {o.price_from ? <span className="font-medium text-gold">{(ar ? "يبدأ من " : "From ") + o.price_from.toLocaleString("en-US") + (ar ? " ريال" : " SAR")}</span> : null}
                        </div>
                      </div>
                    );
                    return noLinks ? <div key={o.id}>{body}</div> : <Link key={o.id} href={"/offers/" + o.slug}>{body}</Link>;
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-8 px-6 py-8 sm:px-10">
            <div>
              {step(1, t("reqQ1"))}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
                {FORM_TYPES.map((x) => <button key={x} type="button" className={chip(type === x)} onClick={() => setType(x)}>{x === "building" ? (ar ? "عمارات" : "Buildings") : t(`typesPlural.${x}`)}</button>)}
              </div>
              {type === "other" && <input className={field + " mt-3"} placeholder={t("reqOtherType")} value={otherType} onChange={(e) => setOtherType(e.target.value)} />}
            </div>

            <div>
              {step(2, t("reqPurpose"))}
              <div className="grid grid-cols-3 gap-2 sm:max-w-md">
                {PURPOSES.map((p) => <button key={p} type="button" className={chip(purpose === p)} onClick={() => setPurpose(purpose === p ? "" : p)}>{t(p)}</button>)}
              </div>
              {purpose !== "reqRent" && (
                <div className="mt-3">
                  <span className="mb-2 block text-sm text-navy/70">{t("payQ")}</span>
                  <div className="grid grid-cols-3 gap-2 sm:max-w-md">
                    {PAYS.map((p) => <button key={p} type="button" className={chip(pay === p)} onClick={() => setPay(pay === p ? "" : p)}>{t(p)}</button>)}
                  </div>
                </div>
              )}
            </div>

            <div>
              {step(3, t("reqQ2"))}
              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs text-navy/60">{t("reqCity")}
                    <select className={field} value={city} onChange={(e) => { setCity(e.target.value); setZone(""); setDistrict(""); setPicked([]); }}>
                      {CITIES.map((c) => <option key={c.ar} value={c.ar}>{ar ? c.ar : c.en}</option>)}
                      <option value={OTHER}>{t("reqOtherCity")}</option>
                    </select>
                  </label>
                  {city === OTHER && (
                    <label className="grid gap-1.5 text-xs text-navy/60">{t("reqOtherCityName")}
                      <input className={field} value={otherCity} onChange={(e) => setOtherCity(e.target.value)} />
                    </label>
                  )}
                  {!riyadh && (
                    <label className="grid gap-1.5 text-xs text-navy/60">{t("reqDistrict")}
                      <input className={field} placeholder={t("reqDistrictFree")} value={district} onChange={(e) => setDistrict(e.target.value)} />
                    </label>
                  )}
                </div>
                {riyadh && <ZonePicker noAll zone={zone || RIYADH_ZONES[0].id} selected={picked} districts={districts} onZone={setZone} onChange={setPicked} />}
              </div>
            </div>

            <div>
              {step(4, t("reqQ3"))}
              <div className="grid gap-3 sm:grid-cols-2 sm:max-w-2xl">
                <input className={field} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder={t("reqBudgetHint")} />
                <div className="grid grid-cols-2 gap-3">
                  <input className={field} inputMode="numeric" value={area} onChange={(e) => setArea(e.target.value)} placeholder={t("reqAreaHint")} />
                  <input className={field} inputMode="numeric" value={areaTo} onChange={(e) => setAreaTo(e.target.value)} placeholder={t("reqAreaToHint")} />
                </div>
              </div>
            </div>

            <div>
              {step(5, t("reqQ4"))}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs text-navy/60">{t("reqName")}
                  <input className={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
                </label>
                <label className="grid gap-1.5 text-xs text-navy/60">{t("reqPhoneLabel")}
                  <PhoneInput className={field} value={phone} onChange={setPhone} />
                </label>
              </div>
            </div>

            {(err || state === "error") && <p className="text-sm text-red-600">{err || t("reqError")}</p>}
            <button type="submit" disabled={state === "sending"} className="min-h-12 justify-self-start rounded-full bg-navy px-10 py-3 font-medium text-cream transition-colors hover:bg-navy/90 disabled:opacity-50">
              {state === "sending" ? t("reqSending") : t("reqSubmit")}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
