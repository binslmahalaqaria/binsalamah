"use client";

/** "العملاء" — client list with search, filters, assignment, and quick actions. */
import { useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { CSTATUS, PAY, TEMPS, TO_CONTACT, UPD, lbl } from "@/lib/crm/constants";
import {
  demandOf, matchesFor, members, nameOf, propById, reqsOf, typesOf, visibleClients, wantLine, can } from "@/lib/crm/logic";
import { assignClient } from "@/lib/crm/actions";
import type { Client } from "@/lib/crm/types";
import { exportCsv, fmtStamp, fmtVisit, num, relDay, today } from "@/lib/crm/util";
import { ContactIcons, Empty, Kebab, PageHeader, Pill, Select } from "@/components/crm/ui";
import { TempPill } from "@/components/crm/bits";
import { TransferClients } from "@/components/crm/TransferClients";

type Filters = Record<string, string>;

export default function ClientsPage() {
  const { data, loaded, openModal, openClient, toast } = useCrm();
  const [q, setQ] = useState("");
  const [showF, setShowF] = useState(false);
  const [F, setF] = useState<Filters>({});
  const [moving, setMoving] = useState(false);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  if (!loaded) return <Empty>جارٍ تحميل البيانات…</Empty>;

  let list = visibleClients(data).slice();
  const qq = q.trim();
  if (qq)
    list = list.filter((c) => {
      const d = demandOf(data, c);
      return [c.name, c.phone, d.districts, c.notes, d.requirements, nameOf(data, c.assignee), d.bank].join(" ").includes(qq);
    });
  // "للتواصل" clients live on their own page and "غير مهتم" ones are the archive; both show only when that status is picked.
  const archived = list.filter((c) => c.status === "غير مهتم").length;
  if (F.status) list = list.filter((c) => (c.status || "نشط") === F.status);
  else list = list.filter((c) => c.status !== TO_CONTACT && c.status !== "غير مهتم");
  if (F.temp) list = list.filter((c) => c.temp === F.temp);
  if (F.purpose) list = list.filter((c) => (demandOf(data, c).purpose || "شراء") === F.purpose);
  if (F.type) list = list.filter((c) => typesOf(demandOf(data, c)).includes(F.type));
  if (F.payment) list = list.filter((c) => demandOf(data, c).payment === F.payment);
  if (F.upd) list = list.filter((c) => c.lastUpdate === F.upd);
  if (F.district) list = list.filter((c) => String(demandOf(data, c).districts || "").includes(F.district));
  const bmin = num(F.bmin), bmax = num(F.bmax);
  if (bmin != null) list = list.filter((c) => (num(demandOf(data, c).budget) ?? -1) >= bmin);
  if (bmax != null) list = list.filter((c) => { const b = num(demandOf(data, c).budget); return b != null && b <= bmax; });
  if (F.due === "late") list = list.filter((c) => c.nextCall && c.nextCall < today());
  if (F.due === "today") list = list.filter((c) => c.nextCall === today());
  if (F.due === "none") list = list.filter((c) => !c.nextCall);
  list.sort((a, b) => (a.nextCall || "9").localeCompare(b.nextCall || "9"));
  const nF = Object.values(F).filter(Boolean).length;

  const exportRows = () =>
    exportCsv("العملاء", list.map((c) => {
      const d = demandOf(data, c);
      return {
        "الاسم": c.name, "الجوال": c.phone || "", "الطلب": d.purpose || "", "نوع العقار": typesOf(d).join("، "), "الميزانية": d.budget ?? "",
        "الدفع": d.payment || "", "البنك": d.bank || "", "الأحياء": d.districts || "", "أقل مساحة": d.areaMin ?? "", "أقل غرف": d.bedroomsMin ?? "",
        "الدور المطلوب": (d.floors || []).join("، "), "موعد الزيارة": c.visitAt ? c.visitAt.replace("T", " ") + (c.visitConfirmed ? " (مؤكد)" : "") : "",
        "استفسر عن": propById(data, c.interestIn)?.title || "", "تفاصيل الطلب": d.requirements || "", "الاهتمام": c.temp || "", "الحالة": c.status || "نشط",
        "آخر تحديث": c.lastUpdate || "", "تاريخ آخر تحديث": fmtStamp(c.lastUpdateAt), "الاتصال القادم": c.nextCall || "",
        "المسؤول": nameOf(data, c.assignee), "المصدر": c.source || "", "ملاحظات": c.notes || "",
      };
    })) || toast("لا توجد بيانات للتصدير");

  const row = (c: Client) => {
    const mc = matchesFor(data, c).length;
    const r0 = reqsOf(data, c)[0];
    return (
      <article key={c.id} className={"crm-card grid grid-cols-2 items-center gap-3 p-3.5 sm:grid-cols-3 xl:gap-4 " + (data.isMgr ? "xl:grid-cols-[minmax(0,1fr)_110px_120px_150px_auto]" : "xl:grid-cols-[minmax(0,1fr)_110px_120px_auto]")}>
        <div className="col-span-full min-w-0 cursor-pointer xl:col-span-1" onClick={() => openClient(c.id)}>
          <div className="flex flex-wrap items-center gap-2">
            <b className="font-heading text-[15.5px]">{c.name}</b>
            <TempPill t={c.temp} />
            {c.status && c.status !== "نشط" && <Pill tone="muted">{c.status}</Pill>}
            {c.unseen && c.assignee === data.uid && <Pill tone="hot">جديد</Pill>}
          </div>
          <div className="mt-1 truncate text-[13px] text-[var(--crm-ink-2)]">
            {wantLine(data, c) || <span className="muted">لم يُسجَّل طلبه</span>}
            {c.visitAt && <span className="text-[var(--crm-gold-ink)]"> · زيارة {fmtVisit(c.visitAt)}{c.visitConfirmed ? " ✓" : ""}</span>}
          </div>
          {c.lastUpdate && <div className="mt-0.5 text-xs text-[var(--crm-ink-3)]">آخر تواصل: {lbl(c.lastUpdate)}</div>}
        </div>
        <div className="grid text-xs text-[var(--crm-ink-3)]"><span>الاتصال القادم</span><b className={"text-[13.5px] " + (c.nextCall && c.nextCall < today() ? "text-[var(--crm-danger)]" : "text-[var(--crm-ink)]")}>{relDay(c.nextCall)}</b></div>
        <div className="grid text-xs text-[var(--crm-ink-3)]"><span>مرحلة الطلب</span><b className="text-[13.5px] text-[var(--crm-ink)]">{r0 ? lbl(r0.status) || "جديد" : "—"}</b></div>
        {data.isMgr && (
          <div className="grid text-xs text-[var(--crm-ink-3)]">
            <span>المسؤول</span>
            <select className={"crm-quiet -ms-2 !text-[13.5px] !font-semibold " + (c.assignee ? "!text-[var(--crm-ink)]" : "!text-[var(--crm-warn)]")} aria-label="إسناد العميل" value={c.assignee || ""}
              onChange={async (e) => { const x = await assignClient(data, c.id, e.target.value || null); toast(x.name ? "تم الإسناد إلى " + x.name + (x.n ? " مع " + (x.n === 1 ? "طلبه" : x.n + " طلبات") : "") : "أصبح غير مسند"); }}>
              <option value="">غير مسند</option>
              {members(data).map((id) => <option key={id} value={id}>{nameOf(data, id)}</option>)}
            </select>
          </div>
        )}
        <div className="col-span-full flex items-center justify-end gap-1.5 xl:col-span-1">
          <ContactIcons phone={c.phone} />
          <Kebab items={[
            { label: "تحديث", onClick: () => openModal({ kind: "update", clientId: c.id }) },
            mc > 0 && r0 ? { label: mc + " عقار مناسب", onClick: () => openModal({ kind: "reqMatches", reqId: r0.id }) } : null,
            { label: "+ طلب جديد", onClick: () => openModal({ kind: "request", preset: { clientId: c.id, assignee: c.assignee || data.uid } }) },
            { label: "+ مهمة", onClick: () => openModal({ kind: "task", preset: { clientId: c.id, assignee: c.assignee || data.uid } }) },
            { label: "تعديل البيانات", onClick: () => openModal({ kind: "client", id: c.id }) },
          ]} />
        </div>
      </article>
    );
  };

  return (
    <>
      <PageHeader eyebrow="المبيعات" title="العملاء" sub="بيانات العملاء ومتابعتهم"
        action={
          <div className="flex flex-wrap gap-2">
            {data.isMgr && <button type="button" className={"crm-btn" + (moving ? " primary" : "")} onClick={() => setMoving((v) => !v)}>⇄ تحويل عملاء</button>}
            <button type="button" className="crm-btn primary" onClick={() => openModal({ kind: "client" })}>+ عميل جديد</button>
          </div>
        } />
      {moving && data.isMgr && <TransferClients onClose={() => setMoving(false)} />}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="crm-input min-w-[200px] flex-1" placeholder="ابحث بالاسم أو الجوال أو الحي" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="crm-btn" aria-expanded={showF} onClick={() => setShowF((v) => !v)}>
          فلترة{nF > 0 && <span className="num rounded-full bg-[var(--crm-ink)] px-1.5 text-[11px] text-white">{nF}</span>}
        </button>
        {can(data, "export") && <button type="button" className="crm-btn" onClick={exportRows}>تصدير Excel</button>}
      </div>
      {showF && (
        <div className="crm-card mb-3 flex flex-wrap items-center gap-2 p-2.5">
          <Select value={F.status} onChange={(v) => set("status", v)} options={CSTATUS} blank="كل الحالات" />
          <Select value={F.temp} onChange={(v) => set("temp", v)} options={TEMPS} blank="كل درجات الاهتمام" />
          <Select value={F.purpose} onChange={(v) => set("purpose", v)} options={["شراء", "إيجار"]} blank="شراء وإيجار" />
          <Select value={F.type} onChange={(v) => set("type", v)} options={data.propTypes} blank="كل الأنواع" />
          <Select value={F.payment} onChange={(v) => set("payment", v)} options={PAY} blank="كل طرق الدفع" />
          <Select value={F.upd} onChange={(v) => set("upd", v)} options={UPD.map((u) => [u.k, lbl(u.k)] as [string, string])} blank="آخر تحديث: الكل" />
          <Select value={F.due} onChange={(v) => set("due", v)} options={[["late", "متأخر"], ["today", "اليوم"], ["none", "بدون موعد"]]} blank="موعد الاتصال: الكل" />
          <input className="w-[150px]" placeholder="الحي" value={F.district || ""} onChange={(e) => set("district", e.target.value)} />
          <input className="w-[120px]" inputMode="decimal" placeholder="ميزانية من" value={F.bmin || ""} onChange={(e) => set("bmin", e.target.value)} />
          <input className="w-[120px]" inputMode="decimal" placeholder="إلى" value={F.bmax || ""} onChange={(e) => set("bmax", e.target.value)} />
          {nF > 0 && <button type="button" className="crm-btn ghost sm" onClick={() => setF({})}>مسح الفلاتر</button>}
        </div>
      )}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="muted">{list.length} عميل{F.status === "غير مهتم" ? " في الأرشيف" : ""}</span>
        {F.status === "غير مهتم"
          ? <button type="button" className="crm-btn ghost sm" onClick={() => set("status", "")}>رجوع إلى العملاء</button>
          : !F.status && archived > 0 && <button type="button" className="crm-btn ghost sm" onClick={() => set("status", "غير مهتم")}>الأرشيف (غير مهتمين): <span className="num">{archived}</span></button>}
      </div>
      {list.length ? <div className="grid gap-2.5">{list.map(row)}</div> : <Empty>{data.clients.length ? "لا توجد نتائج." : "لا يوجد عملاء بعد."}</Empty>}
    </>
  );
}
