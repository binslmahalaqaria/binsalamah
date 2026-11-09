"use client";

/** "الطلبات" — client requests by stage (one table), with matching, journey, and sale recording. */
import { useEffect, useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { OPEN_STAGES, REQ, REQ_TONE, TEMPS, lbl } from "@/lib/crm/constants";
import {
  clientById, followState, match, members, nameOf, areaRange, needsSaleInfo, OPEN_REQ, typesOf, visibleRequests, can } from "@/lib/crm/logic";
import { assignClient } from "@/lib/crm/actions";
import type { Request } from "@/lib/crm/types";
import { ageDays, exportCsv, fmtStamp, num, splitList, today, money } from "@/lib/crm/util";
import { RIYADH_ZONES, zoneOf } from "@/lib/districts";
import { parseBudget } from "@/lib/budget";
import { DistrictPicker, Empty, Field, Kebab, MultiCheck, PageHeader } from "@/components/crm/ui";
import { SentBadge } from "@/components/crm/SentBadge";
import { RequestTabs } from "@/components/crm/PageTabs";
import { changeStage, reqMenu } from "@/components/crm/bits";

export default function RequestsPage() {
  const { data, loaded, openModal, openClient, toast } = useCrm();
  const [q, setQ] = useState("");
  const [showF, setShowF] = useState(false);
  // Filters (client 2026-11-09): several choices per filter, combined; the export takes exactly what is shown.
  const [fTypes, setFTypes] = useState<string[]>([]);
  const [fPurposes, setFPurposes] = useState<string[]>([]);
  const [fFollows, setFFollows] = useState<string[]>([]);
  const [fZones, setFZones] = useState<string[]>([]);
  const [fDists, setFDists] = useState<string[]>([]);
  const [fOwners, setFOwners] = useState<string[]>([]);
  const [fTemps, setFTemps] = useState<string[]>([]);
  const [fBmin, setFBmin] = useState("");
  const [fBmax, setFBmax] = useState("");
  const [fAmin, setFAmin] = useState("");
  const [fAmax, setFAmax] = useState("");
  const [stg, setStg] = useState("open");

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("stage")) setStg(sp.get("stage")!);
    if (sp.get("follow")) { setFFollows([sp.get("follow")!]); setShowF(true); }
  }, []);

  if (!loaded) return <Empty>جارٍ تحميل البيانات…</Empty>;

  let all = visibleRequests(data).slice();
  const qq = q.trim();
  // A request number («ط-12», «#12», «12», Arabic digits too) finds only that request, in any stage and whatever the
  // filters (client 2026-11-09); longer numbers are searched as mobiles.
  // «0555…» is the start of a mobile, not a request number; a number no request has falls back to the normal search.
  const refQ = (() => {
    const m = qq.replace(/[٠-٩]/g, (x) => String("٠١٢٣٤٥٦٧٨٩".indexOf(x))).match(/^(?:ط|#)?[-\s]*([1-9]\d{0,3})$/);
    const n = m ? Number(m[1]) : null;
    return n !== null && all.some((r) => r.ref === n) ? n : null;
  })();
  if (refQ !== null) all = all.filter((r) => r.ref === refQ);
  else if (qq) all = all.filter((r) => { const c = clientById(data, r.clientId); return [c?.name, c?.phone, r.districts, r.requirements, r.notes].join(" ").includes(qq); });
  const zonesOf = (r: Request) => (r.zones?.length ? r.zones : Array.from(new Set(splitList(r.districts).map((x) => zoneOf(x)?.ar).filter((z): z is string => !!z))));
  const bmin = parseBudget(fBmin), bmax = parseBudget(fBmax), amin = num(fAmin), amax = num(fAmax);
  if (refQ === null) {
    if (fTypes.length) all = all.filter((r) => typesOf(r).some((t) => fTypes.includes(t)));
    if (fPurposes.length) all = all.filter((r) => fPurposes.includes(r.purpose || "شراء"));
    if (fFollows.length) all = all.filter((r) => fFollows.includes(followState(data, r)));
    if (fZones.length) all = all.filter((r) => zonesOf(r).some((z) => fZones.includes(z)));
    if (fDists.length) all = all.filter((r) => splitList(r.districts).some((d) => fDists.includes(d)));
    if (fOwners.length) all = all.filter((r) => fOwners.includes(r.assignee || "none"));
    if (fTemps.length) all = all.filter((r) => fTemps.includes(clientById(data, r.clientId)?.temp || "none"));
    // Budget and area: a request without the figure doesn't match a range that was asked for.
    if (bmin || bmax) all = all.filter((r) => !!r.budget && (!bmin || r.budget >= bmin) && (!bmax || r.budget <= bmax));
    if (amin || amax) all = all.filter((r) => {
      const lo = r.areaMin ?? r.areaMax, hi = r.areaMax ?? r.areaMin;
      return lo != null && hi != null && (!amin || hi >= amin) && (!amax || lo <= amax);
    });
  }
  const nF = [fTypes.length, fPurposes.length, fFollows.length, fZones.length, fDists.length, fOwners.length, fTemps.length, bmin || bmax, amin || amax].filter(Boolean).length;
  const clearF = () => { setFTypes([]); setFPurposes([]); setFFollows([]); setFZones([]); setFDists([]); setFOwners([]); setFTemps([]); setFBmin(""); setFBmax(""); setFAmin(""); setFAmax(""); };
  const typeOpts = Array.from(new Set([...data.propTypes, ...data.requests.flatMap((r) => typesOf(r))])).filter(Boolean);
  const distOpts = Array.from(new Set(data.requests.flatMap((r) => splitList(r.districts)))).sort((a, b) => a.localeCompare(b, "ar"));
  const cnt = (st: string) => all.filter((r) => (r.status || "جديد") === st).length;
  const nOpen = all.filter(OPEN_REQ).length;

  // Exactly what is on screen: the search, the filters and the stage tab.
  const exportRows = () =>
    exportCsv("الطلبات", shownList().map((r) => {
      const c = clientById(data, r.clientId);
      const last = (c?.log || [])[0];
      return {
        "رقم الطلب": r.ref ? "ط-" + r.ref : "", "العميل": c?.name || "", "الجوال": c?.phone || "", "المرحلة": r.status || "جديد", "الأولوية": r.priority || "", "الطلب": r.purpose || "",
        "درجة الاهتمام": c?.temp || "", "نوع العقار": typesOf(r).join("، "), "المنطقة": zonesOf(r).join("، "), "الأحياء": r.districts || "",
        "آخر تحديث": last ? lbl(last.type) + (last.text ? " — " + last.text : "") : "", "تاريخ آخر تحديث": last ? fmtStamp(last.at) : "", "الميزانية": r.budget ?? "", "الدفع": r.payment || "", "البنك": r.bank || "",
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
          {r.ref ? <span className="num me-1.5 rounded-md bg-[var(--crm-surface-2)] px-1.5 py-0.5 text-[12.5px] text-[var(--crm-ink-2)]">ط-{r.ref}</span> : null}<b className="font-heading text-[15px] hover:underline">{c ? c.name : "عميل محذوف"}</b>
          <div className="text-[11.5px] text-[var(--crm-ink-3)]">سُجّل الطلب {fmtStamp(r.createdAt)}{r.source ? " · " + r.source : ""}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <SentBadge c={c} />
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
  function shownList() { return refQ !== null ? all : all.filter((r) => groups.includes((r.status || "جديد") as never)); }
  const hasAny = visibleRequests(data).length > 0;

  return (
    <>
      <RequestTabs />
      <PageHeader eyebrow="المبيعات" title="الطلبات" sub="جميع طلبات العملاء ومراحلها. «فلترة» تختار فيها أكثر من نوع وحي وميزانية، و«تصدير Excel» يصدّر اللي ظاهر قدامك."
        action={<button type="button" className="crm-btn primary" onClick={() => openModal({ kind: "request" })}>+ طلب جديد</button>} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="crm-input min-w-[200px] flex-1" placeholder="ابحث باسم العميل أو الجوال أو الحي أو رقم الطلب" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="crm-btn" aria-expanded={showF} onClick={() => setShowF((v) => !v)}>
          فلترة{nF > 0 && <span className="num rounded-full bg-[var(--crm-ink)] px-1.5 text-[11px] text-white">{nF}</span>}
        </button>
        {can(data, "export") && <button type="button" className="crm-btn" onClick={exportRows}>تصدير Excel{nF || qq ? " (" + shownList().length + ")" : ""}</button>}
      </div>
      {showF && (
        <div className="crm-card mb-3 grid gap-3 p-3 sm:grid-cols-2">
          <Field label="نوع العقار" full><MultiCheck options={typeOpts} value={fTypes} onChange={setFTypes} /></Field>
          <Field label="المنطقة" full><MultiCheck options={RIYADH_ZONES.map((z) => z.ar)} value={fZones} onChange={setFZones} /></Field>
          <Field label="الأحياء (اختر أكثر من حي)" full><DistrictPicker all={distOpts} value={fDists} onChange={setFDists} /></Field>
          <Field label="الميزانية من"><input value={fBmin} placeholder="مثال: مليون" onChange={(e) => setFBmin(e.target.value)} /></Field>
          <Field label="الميزانية إلى"><input value={fBmax} placeholder="مثال: 3 مليون" onChange={(e) => setFBmax(e.target.value)} /></Field>
          <Field label="المساحة من (م²)"><input inputMode="decimal" value={fAmin} onChange={(e) => setFAmin(e.target.value)} /></Field>
          <Field label="المساحة إلى (م²)"><input inputMode="decimal" value={fAmax} onChange={(e) => setFAmax(e.target.value)} /></Field>
          <Field label="الطلب"><MultiCheck options={["شراء", "إيجار"]} value={fPurposes} onChange={setFPurposes} /></Field>
          <Field label="درجة الاهتمام"><MultiCheck options={[...TEMPS, "none"]} labels={{ none: "لم تُحدد" }} value={fTemps} onChange={setFTemps} /></Field>
          <Field label="المتابعة" full><MultiCheck options={["none", "sent", "visit"]} labels={{ none: "لم يُرسل له عرض", sent: "أُرسل له ولم تُحدد زيارة", visit: "له زيارة أو زار" }} value={fFollows} onChange={setFFollows} /></Field>
          {data.isMgr && <Field label="المسؤول" full><MultiCheck options={[...members(data), "none"]} labels={Object.fromEntries([...members(data).map((id) => [id, nameOf(data, id)]), ["none", "غير مسند"]])} value={fOwners} onChange={setFOwners} /></Field>}
          <div className="flex items-center gap-2 sm:col-span-2">
            <span className="text-[13px] text-[var(--crm-ink-2)]">{nF ? "النتيجة: " + shownList().length + " طلب" : "اختر من الفلاتر، وتقدر تختار أكثر من خيار"}</span>
            {nF > 0 && <button type="button" className="crm-btn ghost sm" onClick={clearF}>مسح الفلاتر</button>}
          </div>
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
        const shown = shownList();
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
