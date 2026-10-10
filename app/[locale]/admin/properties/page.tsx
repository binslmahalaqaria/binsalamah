"use client";

/** "العقارات" — inventory: properties and projects (with units), ready-made WhatsApp messages, and matching clients. */
import { useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { OWNERK, OWNERK_TONE, PSTATUS, PSTATUS_TONE, PTYPES } from "@/lib/crm/constants";
import {
  activeClients, availUnits, clientMatchesProp, propAreas, propMsg, propPrice, unitsOf, unitView,
} from "@/lib/crm/logic";
import type { Property } from "@/lib/crm/types";
import { exportCsv, num } from "@/lib/crm/util";
import { ContactIcons, Empty, PageHeader, Pill, Select } from "@/components/crm/ui";

export default function PropertiesPage() {
  const { data, loaded, openModal, toast } = useCrm();
  const [q, setQ] = useState("");
  const [showF, setShowF] = useState(false);
  const [F, setF] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  if (!loaded) return <Empty>جاري تحميل البيانات…</Empty>;

  let list = data.props.slice();
  const qq = q.trim();
  if (qq) list = list.filter((p) => [p.title, p.district, p.city, p.contactName, p.contactPhone, p.features, p.notes].join(" ").includes(qq));
  if (F.status) list = list.filter((p) => (p.status || "متاح") === F.status);
  if (F.type) list = list.filter((p) => p.type === F.type);
  if (F.kind) list = list.filter((p) => p.ownerKind === F.kind);
  if (F.purpose) list = list.filter((p) => (p.purpose || "بيع") === F.purpose);
  if (F.district) list = list.filter((p) => String(p.district || "").includes(F.district));
  const pmin = num(F.pmin), pmax = num(F.pmax), amin = num(F.amin), rmin = num(F.rmin);
  const variants = (p: Property) => (unitsOf(p).length ? unitsOf(p).map((u) => unitView(p, u)) : [p]);
  if (pmin != null || pmax != null || amin != null || rmin != null)
    list = list.filter((p) =>
      variants(p).some((v) =>
        (pmin == null || (num(v.price) ?? -1) >= pmin) && (pmax == null || (v.price != null && v.price <= pmax)) &&
        (amin == null || (num(v.area) ?? -1) >= amin) && (rmin == null || (num(v.bedrooms) ?? -1) >= rmin)));
  list.sort((a, b) => PSTATUS.indexOf((a.status || "متاح") as never) - PSTATUS.indexOf((b.status || "متاح") as never) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const nF = Object.values(F).filter(Boolean).length;

  const exportRows = () =>
    exportCsv("العقارات", list.flatMap((p) => (unitsOf(p).length ? unitsOf(p).map((u) => ({ ...unitView(p, u), unitName: u.name })) : [{ ...p, unitName: "" }])).map((p) => ({
      "العقار": p.title, "الوحدة": p.unitName, "النوع": p.type || "", "للـ": p.purpose || "", "الحالة": p.status || "متاح", "السعر": p.price ?? "",
      "ملاحظة السعر": p.priceNote || "", "المدينة": p.city || "", "الحي": p.district || "", "المساحة": p.area ?? "", "مسطح البناء": p.buildArea ?? "",
      "غرف": p.bedrooms ?? "", "الدور": p.floor || "", "دورات مياه": p.bathrooms ?? "", "صالات": p.livingRooms ?? "", "أدوار": p.floors ?? "",
      "الواجهة": p.facing || "", "عرض الشارع": p.streetWidth ?? "", "العمر": p.age || "", "المميزات": p.features || "", "نوع المعلن": p.ownerKind || "",
      "المسؤول": p.contactName || "", "جوال المسؤول": p.contactPhone || "", "السعي": p.commissionNote || "", "الموقع": p.link || "",
      "المقطع": p.videoLink || "", "رسالة الواتساب": p.waMessage || "", "ملاحظات": p.notes || "",
    }))) || toast("ما فيه بيانات للتصدير");

  const copyWa = (p: Property) =>
    navigator.clipboard?.writeText(propMsg(p)).then(() => toast("تم نسخ الرسالة، الصقها للعميل في الواتساب"), () => toast("ما قدرت أنسخ"));

  return (
    <>
      <PageHeader eyebrow="المخزون" title="العقارات" sub="المخزون والمشاريع والوحدات"
        action={<button type="button" className="crm-btn primary" onClick={() => openModal({ kind: "property" })}>+ عقار جديد</button>} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="crm-input min-w-[200px] flex-1" placeholder="ابحث بالاسم أو الحي أو المسؤول" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="crm-btn" aria-expanded={showF} onClick={() => setShowF((v) => !v)}>
          فلترة{nF > 0 && <span className="num rounded-full bg-[var(--crm-ink)] px-1.5 text-[11px] text-white">{nF}</span>}
        </button>
        <button type="button" className="crm-btn" onClick={exportRows}>تصدير Excel</button>
      </div>
      {showF && (
        <div className="crm-card mb-3 flex flex-wrap items-center gap-2 p-2.5">
          <Select value={F.status} onChange={(v) => set("status", v)} options={PSTATUS} blank="كل الحالات" />
          <Select value={F.type} onChange={(v) => set("type", v)} options={PTYPES} blank="كل الأنواع" />
          <Select value={F.kind} onChange={(v) => set("kind", v)} options={OWNERK} blank="مالك / مطور / مسوق" />
          <Select value={F.purpose} onChange={(v) => set("purpose", v)} options={["بيع", "إيجار"]} blank="بيع وإيجار" />
          <input className="w-[150px]" placeholder="الحي" value={F.district || ""} onChange={(e) => set("district", e.target.value)} />
          <input className="w-[120px]" inputMode="decimal" placeholder="سعر من" value={F.pmin || ""} onChange={(e) => set("pmin", e.target.value)} />
          <input className="w-[120px]" inputMode="decimal" placeholder="إلى" value={F.pmax || ""} onChange={(e) => set("pmax", e.target.value)} />
          <input className="w-[110px]" inputMode="decimal" placeholder="مساحة من" value={F.amin || ""} onChange={(e) => set("amin", e.target.value)} />
          <input className="w-[90px]" inputMode="decimal" placeholder="غرف من" value={F.rmin || ""} onChange={(e) => set("rmin", e.target.value)} />
          {nF > 0 && <button type="button" className="crm-btn ghost sm" onClick={() => setF({})}>مسح الفلاتر</button>}
        </div>
      )}
      <div className="muted mb-2 text-[13px]">{list.length} عقار</div>
      {!list.length ? (
        <Empty>{data.props.length ? "ما فيه نتائج." : "ما فيه عقارات للحين."}</Empty>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2.5">
          {list.map((p) => {
            const st = p.status || "متاح";
            const cm = st === "متاح" ? activeClients(data).filter((c) => clientMatchesProp(data, c, p)).length : 0;
            const us = unitsOf(p);
            const ar = propAreas(p);
            const specs = [
              us.length && us.length + " وحدات · " + availUnits(p).length + " متاحة", ar && ar + " م²", !us.length && p.floor && "الدور " + p.floor,
              !us.length && p.bedrooms && p.bedrooms + " غرف", p.bathrooms && p.bathrooms + " دورات", p.facing && "واجهة " + p.facing,
              p.streetWidth && "شارع " + p.streetWidth + "م",
            ].filter(Boolean) as string[];
            return (
              <article key={p.id} className={"crm-card cursor-pointer overflow-hidden hover:border-[var(--crm-ink-3)] " + (st === "مباع" ? "opacity-60" : "")}
                onClick={() => openModal({ kind: "property", id: p.id })}>
                {p.images?.length ? (
                  <div className="relative aspect-[16/10] bg-[var(--crm-surface-2)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.images[0]} alt={p.title} loading="lazy" className="h-full w-full object-cover" />
                    {p.images.length > 1 && <span className="num absolute bottom-2 start-2 rounded-md bg-black/60 px-2 text-xs text-white">{p.images.length} صور</span>}
                  </div>
                ) : (
                  <div className="grid aspect-[16/5] place-items-center bg-[var(--crm-surface-2)] text-[13px] text-[var(--crm-ink-3)]">بدون صور</div>
                )}
                <div className="grid gap-1.5 px-3.5 pt-3 pb-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex gap-1.5"><Pill tone={PSTATUS_TONE[st]}>{st}</Pill>{p.ownerKind && <Pill tone={OWNERK_TONE[p.ownerKind]}>{p.ownerKind}</Pill>}</span>
                    <span className="muted text-[12.5px]">{p.type || ""} · {p.purpose || "بيع"}</span>
                  </div>
                  <h3 className="text-[15px]">{p.title}</h3>
                  <div className="font-heading text-[19px] text-[var(--crm-gold-ink)]">{propPrice(p)} {p.priceNote && <small className="font-sans text-xs text-[var(--crm-ink-3)]">{p.priceNote}</small>}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.district && <span className="crm-chip">{p.district}</span>}
                    {specs.map((s) => <span key={s} className="crm-chip">{s}</span>)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="crm-btn sm wa" onClick={() => copyWa(p)}>نسخ رسالة الواتساب</button>
                    {!p.waMessage && <span className="crm-hint">تلقائية من البيانات</span>}
                  </div>
                  {(p.contactName || p.contactPhone) && (
                    <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-[var(--crm-line)] pt-2 text-[13.5px]" onClick={(e) => e.stopPropagation()}>
                      <span>{p.contactName || "المسؤول"}{p.contactPhone && <> · <span className="num">{p.contactPhone}</span></>}</span>
                      <div className="flex gap-1.5"><ContactIcons phone={p.contactPhone} text={"السلام عليكم، بخصوص " + p.title} /></div>
                    </div>
                  )}
                  {cm > 0 && (
                    <button type="button" className="crm-btn sm justify-self-start" onClick={(e) => { e.stopPropagation(); openModal({ kind: "propReqs", propId: p.id }); }}>
                      {cm} عميل يناسبه هذا العقار
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
