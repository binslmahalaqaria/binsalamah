"use client";

/** "الطلبات" — client requests by stage (one table), with matching, journey, and sale recording. */
import { useEffect, useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { OPEN_STAGES, REQ, REQ_TONE, lbl } from "@/lib/crm/constants";
import {
  clientById, followState, match, members, nameOf, areaRange, needsSaleInfo, OPEN_REQ, typesOf, visibleRequests, can } from "@/lib/crm/logic";
import { assignClient } from "@/lib/crm/actions";
import type { Request } from "@/lib/crm/types";
import { ageDays, exportCsv, fmtStamp, num, splitList, today, money } from "@/lib/crm/util";
import { zoneOf } from "@/lib/districts";
import { Empty, Kebab, PageHeader, Select } from "@/components/crm/ui";
import { RequestTabs } from "@/components/crm/PageTabs";
import { changeStage, reqMenu } from "@/components/crm/bits";

export default function RequestsPage() {
  const { data, loaded, openModal, openClient, toast } = useCrm();
  const [q, setQ] = useState("");
  const [showF, setShowF] = useState(false);
  const [fType, setFType] = useState("");
  const [fPurpose, setFPurpose] = useState("");
  const [fFollow, setFFollow] = useState("");
  const [fDist, setFDist] = useState("");
  const [fBudget, setFBudget] = useState("");
  const [stg, setStg] = useState("open");

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("stage")) setStg(sp.get("stage")!);
    if (sp.get("follow")) { setFFollow(sp.get("follow")!); setShowF(true); }
  }, []);

  if (!loaded) return <Empty>جارٍ تحميل البيانات…</Empty>;

  let all = visibleRequests(data).slice();
  const qq = q.trim();
  if (qq) all = all.filter((r) => { const c = clientById(data, r.clientId); return [c?.name, c?.phone, r.districts, r.requirements, r.notes].join(" ").includes(qq); });
  if (fType) all = all.filter((r) => typesOf(r).includes(fType));
  if (fPurpose) all = all.filter((r) => (r.purpose || "شراء") === fPurpose);
  if (fFollow) all = all.filter((r) => followState(data, r) === fFollow);
  if (fDist.trim()) all = all.filter((r) => splitList(r.districts).some((d) => d.includes(fDist.trim())));
  const bmax = num(fBudget);
  if (bmax) all = all.filter((r) => !r.budget || r.budget <= bmax);
  const nF = [fType, fPurpose, fFollow, fDist.trim(), bmax].filter(Boolean).length;
  const cnt = (st: string) => all.filter((r) => (r.status || "جديد") === st).length;
  const nOpen = all.filter(OPEN_REQ).length;

  const exportRows = () =>
    exportCsv("الطلبات", visibleRequests(data).map((r) => {
      const c = clientById(data, r.clientId);
      return {
        "العميل": c?.name || "", "الجوال": c?.phone || "", "المرحلة": r.status || "جديد", "الأولوية": r.priority || "", "الطلب": r.purpose || "",
        "نوع العقار": typesOf(r).join("، "), "الأحياء": r.districts || "", "الميزانية": r.budget ?? "", "الدفع": r.payment || "", "البنك": r.bank || "",
        "أقل مساحة": r.areaMin ?? "", "أعلى مساحة": r.areaMax ?? "", "أقل غرف": r.bedroomsMin ?? "", "الدور": (r.floors || []).join("، "), "التفاصيل": r.requirements || "",
        "المسؤول": nameOf(data, r.assignee), "تاريخ الطلب": fmtStamp(r.createdAt), "ملاحظات": r.notes || "",
      };
    })) || toast("لا توجد بيانات للتصدير");

  // One row per request, one column per fact (client 2026-10-24): client · mobile · type · zone · districts · owner · last update · when.
  // Wide screens: a table with a header. Narrower screens: the same facts as a card, each with its label above it,
  // and ⋮ in the corner — nothing is cut off and nothing needs sideways scrolling.
  const GRID = "xl:grid-cols-[minmax(130px,1.2fr)_100px_minmax(60px,0.7fr)_minmax(80px,0.8fr)_minmax(85px,0.9fr)_minmax(75px,0.8fr)_minmax(90px,1.1fr)_100px_minmax(120px,1.4fr)_90px_70px]";
  const L = (t: string) => <span className="mb-0.5 block text-[11px] text-[var(--crm-ink-3)] xl:hidden">{t}</span>;

  const row = (r: Request) => {
    const c = clientById(data, r.clientId);
    const mc = OPEN_REQ(r) ? data.props.filter((p) => match(r, p)).length : 0;
    const st = r.status || "جديد";
    const ds = splitList(r.districts);
    const zones = r.zones?.length ? r.zones : Array.from(new Set(ds.map((x) => zoneOf(x)?.ar).filter((z): z is string => !!z)));
    const last = (c?.log || [])[0];
    const late = !!c?.nextCall && c.nextCall < today() && OPEN_REQ(r);
    return (
      <div key={r.id} className={"crm-row relative grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-4 " + GRID + (late ? " late" : "")}>
        <div className="col-span-2 min-w-0 cursor-pointer pe-24 sm:col-span-4 xl:col-span-1 xl:pe-0" onClick={() => c && openClient(c.id, r.id)}>
          <b className="font-heading text-[15px] hover:underline">{c ? c.name : "عميل محذوف"}</b>
          <div className="text-[11.5px] text-[var(--crm-ink-3)]">سُجّل الطلب {fmtStamp(r.createdAt)}{r.source ? " · " + r.source : ""}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <select className={"crm-pill cursor-pointer !rounded-full !border-transparent !py-0.5 !ps-2.5 !pe-6 !text-[12px] tone-" + REQ_TONE[st]} value={st} aria-label="المرحلة"
              onChange={(e) => changeStage(data, r, e.target.value, openModal, toast)}>
              {REQ.map((x) => <option key={x} value={x}>{lbl(x)}</option>)}
            </select>
          </div>
        </div>
        <div className="min-w-0 self-center text-[13.5px]">{L("الجوال")}<span className="num">{c?.phone || "—"}</span></div>
        <div className="min-w-0 self-center text-[13.5px]">{L("نوع العقار")}{typesOf(r).join("، ") || "—"}</div>
        <div className="min-w-0 self-center text-[13.5px] font-semibold">{L("المساحة")}<span className="num">{areaRange(r) || "—"}</span></div>
        <div className="min-w-0 self-center text-[13.5px] font-semibold">{L("الميزانية")}<span className="num">{r.budget ? money(r.budget) : "—"}</span></div>
        <div className="min-w-0 self-center text-[13.5px]">{L("المنطقة")}{zones.join("، ") || "—"}</div>
        <div className="min-w-0 self-center text-[13px] text-[var(--crm-ink-2)]" title={ds.join("، ")}>{L("الأحياء")}{ds.length ? ds.slice(0, 4).join("، ") + (ds.length > 4 ? " +" + (ds.length - 4) : "") : "—"}</div>
        <div className="min-w-0 self-center">{L("المسؤول")}
          {data.isMgr ? (
            <select className={"crm-quiet w-full !text-[13px] " + (r.assignee ? "" : "!text-[var(--crm-warn)]")} aria-label="المسؤول" value={r.assignee || ""}
              onChange={async (e) => { const x = await assignClient(data, r.clientId, e.target.value || null, r.id); toast(x.name ? "تم الإسناد إلى " + x.name : "أصبح غير مسند"); }}>
              <option value="">غير مسند</option>
              {members(data).map((id) => <option key={id} value={id}>{nameOf(data, id)}</option>)}
            </select>
          ) : <span className="text-[13.5px]">{r.assignee ? nameOf(data, r.assignee) : "غير مسند"}</span>}
        </div>
        <div className="min-w-0 self-center text-[13px]">{L("آخر تحديث")}
          {last ? <><b className="font-semibold">{lbl(last.type)}</b>{last.text ? <span className="block truncate text-[var(--crm-ink-3)]" title={last.text}>{last.text}</span> : null}</> : <span className="text-[var(--crm-ink-3)]">لا يوجد تحديث</span>}
        </div>
        <div className="min-w-0 self-center text-[12.5px] text-[var(--crm-ink-2)]">{L("متى")}{last ? <>{ageDays(last.at)}<span className="block text-[11.5px] text-[var(--crm-ink-3)]">{fmtStamp(last.at)}</span></> : "—"}</div>
        <div className="absolute left-3 top-3 flex items-center justify-end gap-1 xl:static xl:self-center">
          {needsSaleInfo(r) ? (
            <button type="button" className="crm-btn sm primary" onClick={() => openModal({ kind: "close", reqId: r.id, to: st })}>البيع</button>
          ) : mc ? (
            <button type="button" className="crm-btn sm" title="عقارات مناسبة" onClick={() => openModal({ kind: "reqMatches", reqId: r.id })}><b className="num text-[var(--crm-gold-ink)]">{mc}</b></button>
          ) : null}
          <Kebab items={reqMenu(data, r, openModal)} />
        </div>
      </div>
    );
  };

  const groups = stg === "open" ? OPEN_STAGES : [stg];
  const hasAny = visibleRequests(data).length > 0;

  return (
    <>
      <RequestTabs />
      <PageHeader eyebrow="المبيعات" title="الطلبات" sub="جميع طلبات العملاء ومراحلها. استخدم أزرار المراحل للتصفية، وزر «فلترة» للبحث حسب الحي أو الميزانية."
        action={<button type="button" className="crm-btn primary" onClick={() => openModal({ kind: "request" })}>+ طلب جديد</button>} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="crm-input min-w-[200px] flex-1" placeholder="ابحث باسم العميل أو الجوال أو الحي" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="crm-btn" aria-expanded={showF} onClick={() => setShowF((v) => !v)}>
          فلترة{nF > 0 && <span className="num rounded-full bg-[var(--crm-ink)] px-1.5 text-[11px] text-white">{nF}</span>}
        </button>
        {can(data, "export") && <button type="button" className="crm-btn" onClick={exportRows}>تصدير Excel</button>}
      </div>
      {showF && (
        <div className="crm-card mb-3 flex flex-wrap items-center gap-2 p-2.5">
          <Select value={fType} onChange={setFType} options={data.propTypes} blank="كل الأنواع" ariaLabel="النوع" />
          <Select value={fPurpose} onChange={setFPurpose} options={["شراء", "إيجار"]} blank="شراء وإيجار" ariaLabel="الطلب" />
          <Select value={fFollow} onChange={setFFollow} options={[["none", "لم يُرسل إليه عرض"], ["sent", "أُرسل إليه ولم يُحدَّد موعد"], ["visit", "لديه موعد أو تمت الزيارة"]]} blank="كل المتابعة" ariaLabel="المتابعة" />
          <input className="w-[150px]" placeholder="الحي" value={fDist} onChange={(e) => setFDist(e.target.value)} />
          <input className="w-[170px]" inputMode="decimal" placeholder="الميزانية حتى" value={fBudget} onChange={(e) => setFBudget(e.target.value)} />
          {nF > 0 && <button type="button" className="crm-btn ghost sm" onClick={() => { setFType(""); setFPurpose(""); setFFollow(""); setFDist(""); setFBudget(""); }}>مسح الفلاتر</button>}
        </div>
      )}

      <div className="mb-1 flex gap-1.5 overflow-x-auto pt-0.5 pb-2.5" role="tablist">
        <button type="button" className={"crm-qchip shrink-0 font-semibold" + (stg === "open" ? " on" : "")} onClick={() => setStg("open")}>قيد المتابعة <span className="num opacity-70">{nOpen}</span></button>
        {OPEN_STAGES.map((x) => (
          <button key={x} type="button" className={"crm-qchip flex shrink-0 items-center gap-1.5 font-semibold" + (stg === x ? " on" : "")} onClick={() => { setStg(x); }}>
            <i className={"inline-block h-2 w-2 rounded-full tone-" + REQ_TONE[x]} />{lbl(x)} <span className="num opacity-70">{cnt(x)}</span>
          </button>
        ))}
        <span className="mx-0.5 my-1 w-px shrink-0 bg-[var(--crm-line)]" />
        {["تم البيع", "ملغي"].map((x) => (
          <button key={x} type="button" className={"crm-qchip shrink-0 font-semibold" + (stg === x ? " on" : "")} onClick={() => { setStg(x); }}>{x} <span className="num opacity-70">{cnt(x)}</span></button>
        ))}
      </div>

      {!hasAny ? (
        <Empty big><span className="grid justify-items-center gap-3">لا توجد طلبات بعد.<button type="button" className="crm-btn primary" onClick={() => openModal({ kind: "request" })}>+ طلب جديد</button></span></Empty>
      ) : (() => {
        // Newest request first (client 2026-10-31), across all the stages being shown.
        const shown = all.filter((r) => groups.includes((r.status || "جديد") as never));
        const body = [...shown].sort((x, y) => String(y.createdAt || "").localeCompare(String(x.createdAt || ""))).map(row);
        return body.length ? (
          <div className="crm-card overflow-hidden"><div>
            <div className={"crm-head hidden gap-3 xl:grid " + GRID}><span>العميل</span><span>الجوال</span><span>نوع العقار</span><span>المساحة</span><span>الميزانية</span><span>المنطقة</span><span>الأحياء</span><span>المسؤول</span><span>آخر تحديث</span><span>متى</span><span /></div>
            {body}
          </div>
          </div>
        ) : <Empty>لا توجد طلبات هنا{qq || nF ? " بهذا البحث أو الفلتر" : ""}.</Empty>;
      })()}
    </>
  );
}
