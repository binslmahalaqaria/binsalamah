"use client";

/** "الطلبات" — client requests by stage (list or board), with matching, journey, and sale recording. */
import { useEffect, useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { OPEN_STAGES, PRIO_TONE, PTYPES, REQ, REQ_TONE } from "@/lib/crm/constants";
import {
  clientById, followState, match, members, nameOf, needsSaleInfo, OPEN_REQ, sortRequests, typesOf, visibleRequests,
} from "@/lib/crm/logic";
import { assignClient } from "@/lib/crm/actions";
import type { Request } from "@/lib/crm/types";
import { ageDays, exportCsv, fmtStamp, today } from "@/lib/crm/util";
import { Empty, Icon, Kebab, PageHeader, Pill, Select } from "@/components/crm/ui";
import { changeStage, NeedLine, NextStep, reqMenu } from "@/components/crm/bits";

export default function RequestsPage() {
  const { data, loaded, openModal, openClient, toast } = useCrm();
  const [q, setQ] = useState("");
  const [showF, setShowF] = useState(false);
  const [fType, setFType] = useState("");
  const [fPurpose, setFPurpose] = useState("");
  const [fFollow, setFFollow] = useState("");
  const [stg, setStg] = useState("open");
  const [mode, setMode] = useState<"list" | "board">("list");

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("stage")) setStg(sp.get("stage")!);
    if (sp.get("follow")) { setFFollow(sp.get("follow")!); setShowF(true); }
    try { if (localStorage.getItem("crm.reqMode") === "board") setMode("board"); } catch {}
  }, []);

  if (!loaded) return <Empty>جاري تحميل البيانات…</Empty>;

  let all = visibleRequests(data).slice();
  const qq = q.trim();
  if (qq) all = all.filter((r) => { const c = clientById(data, r.clientId); return [c?.name, c?.phone, r.districts, r.requirements, r.notes].join(" ").includes(qq); });
  if (fType) all = all.filter((r) => typesOf(r).includes(fType));
  if (fPurpose) all = all.filter((r) => (r.purpose || "شراء") === fPurpose);
  if (fFollow) all = all.filter((r) => followState(data, r) === fFollow);
  const nF = [fType, fPurpose, fFollow].filter(Boolean).length;
  const cnt = (st: string) => all.filter((r) => (r.status || "جديد") === st).length;
  const nOpen = all.filter(OPEN_REQ).length;

  const exportRows = () =>
    exportCsv("الطلبات", visibleRequests(data).map((r) => {
      const c = clientById(data, r.clientId);
      return {
        "العميل": c?.name || "", "الجوال": c?.phone || "", "المرحلة": r.status || "جديد", "الأولوية": r.priority || "", "الطلب": r.purpose || "",
        "نوع العقار": typesOf(r).join("، "), "الأحياء": r.districts || "", "الميزانية": r.budget ?? "", "الدفع": r.payment || "", "البنك": r.bank || "",
        "أقل مساحة": r.areaMin ?? "", "أقل غرف": r.bedroomsMin ?? "", "الدور": (r.floors || []).join("، "), "التفاصيل": r.requirements || "",
        "المسؤول": nameOf(data, r.assignee), "تاريخ الطلب": fmtStamp(r.createdAt), "ملاحظات": r.notes || "",
      };
    })) || toast("ما فيه بيانات للتصدير");

  const GRID = data.isMgr
    ? "md:grid-cols-[minmax(0,1.25fr)_minmax(0,1.2fr)_minmax(0,1.5fr)_130px_130px_172px]"
    : "md:grid-cols-[minmax(0,1.25fr)_minmax(0,1.2fr)_minmax(0,1.5fr)_130px_172px]";

  const row = (r: Request) => {
    const c = clientById(data, r.clientId);
    const mc = OPEN_REQ(r) ? data.props.filter((p) => match(r, p)).length : 0;
    const st = r.status || "جديد";
    const late = !!c?.nextCall && c.nextCall < today() && OPEN_REQ(r);
    return (
      <div key={r.id} className={"crm-row grid-cols-[minmax(0,1fr)_128px] " + GRID + (late ? " late" : "")}>
        <div className="min-w-0 cursor-pointer" onClick={() => c && openClient(c.id, r.id)}>
          <div className="flex flex-wrap items-center gap-1.5">
            <b className="font-heading text-[15.5px] hover:underline">{c ? c.name : "عميل محذوف"}</b>
            {r.priority && r.priority !== "عادية" && <Pill tone={PRIO_TONE[r.priority]}>{r.priority}</Pill>}
          </div>
          <div className="mt-0.5 text-xs text-[var(--crm-ink-3)]">{c?.phone && <><span className="num">{c.phone}</span> · </>}{ageDays(r.createdAt)}</div>
        </div>
        <div className="max-md:col-span-2 max-md:row-start-2"><NeedLine r={r} /></div>
        <div className="max-md:col-span-2 max-md:row-start-3 max-md:rounded-lg max-md:bg-[var(--crm-surface-2)] max-md:px-2.5 max-md:py-1.5"><NextStep r={r} /></div>
        <div className="max-md:col-start-2 max-md:row-start-1 self-start md:self-center">
          <select className={"crm-pill w-full cursor-pointer !rounded-full !border-transparent !px-2.5 !py-1 !text-[13px] tone-" + REQ_TONE[st]} value={st} aria-label="المرحلة"
            onChange={(e) => changeStage(data, r, e.target.value, openModal, toast)}>
            {REQ.map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>
        {data.isMgr && (
          <div className="max-md:row-start-4">
            <select className="w-full !py-1.5 text-[13px]" aria-label="المسؤول" value={r.assignee || ""}
              onChange={async (e) => { const x = await assignClient(data, r.clientId, e.target.value || null, r.id); toast(x.name ? "انسند إلى " + x.name : "صار غير مسند"); }}>
              <option value="">غير مسند</option>
              {members(data).map((id) => <option key={id} value={id}>{nameOf(data, id)}</option>)}
            </select>
          </div>
        )}
        <div className={"flex items-center justify-end gap-1.5 " + (data.isMgr ? "max-md:row-start-4" : "max-md:col-span-2 max-md:row-start-4")}>
          {needsSaleInfo(r) ? (
            <button type="button" className="crm-btn sm primary" onClick={() => openModal({ kind: "close", reqId: r.id, to: st })}>أكمل بيانات البيع</button>
          ) : OPEN_REQ(r) ? (
            <button type="button" className={"crm-btn sm " + (mc ? "primary" : "")} onClick={() => openModal({ kind: "reqMatches", reqId: r.id })}>{mc ? mc + " عقار مناسب" : "ما فيه مطابق"}</button>
          ) : null}
          <Kebab items={reqMenu(data, r, openModal)} />
        </div>
      </div>
    );
  };

  const card = (r: Request, i: number) => {
    const c = clientById(data, r.clientId);
    const mc = data.props.filter((p) => match(r, p)).length;
    return (
      <div key={r.id} className="grid gap-2 rounded-xl border border-[var(--crm-line)] bg-white p-2.5 text-[13.5px]">
        <div className="grid cursor-pointer gap-1.5" onClick={() => c && openClient(c.id, r.id)}>
          <div className="flex flex-wrap items-center gap-2"><b className="font-heading text-[15px]">{c ? c.name : "عميل محذوف"}</b>{r.priority && r.priority !== "عادية" && <Pill tone={PRIO_TONE[r.priority]}>{r.priority}</Pill>}</div>
          <NeedLine r={r} />
          <div className="rounded-lg bg-[var(--crm-surface-2)] px-2 py-1.5"><NextStep r={r} /></div>
          {data.isMgr && <div className="muted text-xs">{r.assignee ? nameOf(data, r.assignee) : "غير مسند"}</div>}
          <div className="muted text-[11.5px]">{ageDays(r.createdAt)}</div>
        </div>
        {needsSaleInfo(r) && <button type="button" className="crm-btn sm primary" onClick={() => openModal({ kind: "close", reqId: r.id, to: r.status })}>أكمل بيانات البيع</button>}
        <div className="grid grid-cols-[30px_1fr_auto_30px] items-center gap-1.5 border-t border-[var(--crm-line)] pt-2">
          {i > 0 ? <button type="button" className="crm-btn sm icon" title="المرحلة السابقة" onClick={() => changeStage(data, r, REQ[i - 1], openModal, toast)}><Icon k="chevR" size={16} /></button> : <span />}
          <button type="button" className={"crm-btn sm " + (mc ? "primary" : "")} onClick={() => openModal({ kind: "reqMatches", reqId: r.id })}>{mc ? mc + " عقار مناسب" : "ما فيه مطابق"}</button>
          <Kebab items={reqMenu(data, r, openModal)} />
          {i < REQ.length - 2 ? <button type="button" className="crm-btn sm icon" title="المرحلة التالية" onClick={() => changeStage(data, r, REQ[i + 1], openModal, toast)}><Icon k="chevL" size={16} /></button> : <span />}
        </div>
      </div>
    );
  };

  const groups = stg === "open" ? OPEN_STAGES : [stg];
  const hasAny = visibleRequests(data).length > 0;

  return (
    <>
      <PageHeader eyebrow="المبيعات" title="الطلبات" sub="طلبات العملاء ومراحلها"
        action={<button type="button" className="crm-btn primary" onClick={() => openModal({ kind: "request" })}>+ طلب جديد</button>} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="crm-input min-w-[200px] flex-1" placeholder="ابحث باسم العميل أو الجوال أو الحي" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="crm-btn" aria-expanded={showF} onClick={() => setShowF((v) => !v)}>
          فلترة{nF > 0 && <span className="num rounded-full bg-[var(--crm-ink)] px-1.5 text-[11px] text-white">{nF}</span>}
        </button>
        <div className="hidden rounded-xl border border-[var(--crm-line)] bg-white p-[3px] md:flex" role="group" aria-label="طريقة العرض">
          {(["list", "board"] as const).map((m) => (
            <button key={m} type="button" className={"rounded-lg px-3 py-1.5 text-[13.5px] font-semibold " + (mode === m ? "bg-[var(--crm-ink)] text-white" : "text-[var(--crm-ink-2)]")}
              onClick={() => { setMode(m); if (m === "board") setStg("open"); try { localStorage.setItem("crm.reqMode", m); } catch {} }}>
              {m === "list" ? "قائمة" : "لوحة"}
            </button>
          ))}
        </div>
        <button type="button" className="crm-btn" onClick={exportRows}>تصدير Excel</button>
      </div>
      {showF && (
        <div className="crm-card mb-3 flex flex-wrap items-center gap-2 p-2.5">
          <Select value={fType} onChange={setFType} options={PTYPES} blank="كل الأنواع" ariaLabel="النوع" />
          <Select value={fPurpose} onChange={setFPurpose} options={["شراء", "إيجار"]} blank="شراء وإيجار" ariaLabel="الطلب" />
          <Select value={fFollow} onChange={setFFollow} options={[["none", "ما انرسل له شي"], ["sent", "انرسل له وما تحدد موعد"], ["visit", "عنده موعد أو زار"]]} blank="كل المتابعة" ariaLabel="المتابعة" />
          {nF > 0 && <button type="button" className="crm-btn ghost sm" onClick={() => { setFType(""); setFPurpose(""); setFFollow(""); }}>مسح الفلاتر</button>}
        </div>
      )}

      <div className="mb-1 flex gap-1.5 overflow-x-auto pt-0.5 pb-2.5" role="tablist">
        <button type="button" className={"crm-qchip shrink-0 font-semibold" + (stg === "open" ? " on" : "")} onClick={() => setStg("open")}>المفتوحة <span className="num opacity-70">{nOpen}</span></button>
        {OPEN_STAGES.map((x) => (
          <button key={x} type="button" className={"crm-qchip flex shrink-0 items-center gap-1.5 font-semibold" + (stg === x ? " on" : "")} onClick={() => { setStg(x); setMode("list"); }}>
            <i className={"inline-block h-2 w-2 rounded-full tone-" + REQ_TONE[x]} />{x} <span className="num opacity-70">{cnt(x)}</span>
          </button>
        ))}
        <span className="mx-0.5 my-1 w-px shrink-0 bg-[var(--crm-line)]" />
        {["تم البيع", "ملغي"].map((x) => (
          <button key={x} type="button" className={"crm-qchip shrink-0 font-semibold" + (stg === x ? " on" : "")} onClick={() => { setStg(x); setMode("list"); }}>{x} <span className="num opacity-70">{cnt(x)}</span></button>
        ))}
      </div>

      {!hasAny ? (
        <Empty big>ما فيه طلبات. اضغط &quot;+ طلب جديد&quot; وسجّل طلب أول عميل.</Empty>
      ) : mode === "board" && stg === "open" ? (
        <div className="overflow-x-auto pb-2">
          <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${OPEN_STAGES.length}, minmax(250px, 1fr))`, minWidth: OPEN_STAGES.length * 260 }}>
            {OPEN_STAGES.map((st) => {
              const rs = sortRequests(data, all.filter((r) => (r.status || "جديد") === st));
              const i = REQ.indexOf(st as never);
              return (
                <div key={st} className="flex flex-col gap-2 rounded-2xl bg-[#efece7] p-2.5">
                  <div className="flex justify-between px-1 py-0.5 text-sm font-semibold"><span><Pill tone={REQ_TONE[st]}>{st}</Pill> <small className="num muted">({rs.length})</small></span></div>
                  {rs.length ? rs.map((r) => card(r, i)) : <div className="muted px-1 py-1.5 text-[13px]">—</div>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (() => {
        const body = groups.flatMap((st) => {
          const rs = sortRequests(data, all.filter((r) => (r.status || "جديد") === st));
          if (!rs.length) return [];
          return [
            stg === "open" ? <div key={"g" + st} className="crm-grp"><Pill tone={REQ_TONE[st]}>{st}</Pill><span className="num">{rs.length}</span></div> : null,
            ...rs.map(row),
          ];
        });
        return body.length ? (
          <div className="crm-card overflow-hidden">
            <div className={"crm-head hidden md:grid md:gap-3.5 " + GRID}><span>العميل</span><span>وش يبي</span><span>الخطوة الجاية</span><span>المرحلة</span>{data.isMgr && <span>المسؤول</span>}<span /></div>
            {body}
          </div>
        ) : <Empty>ما فيه طلبات هنا{qq || nF ? " بهذا البحث أو الفلتر" : ""}.</Empty>;
      })()}
    </>
  );
}
