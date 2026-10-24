"use client";

/** Action modals for the sales CRM, plus the host that renders whichever one is open. */
import { useMemo, useState } from "react";
import { clock } from "@/lib/crm/util";
import { useCrm } from "@/lib/crm/store";
import { useRouter } from "@/i18n/navigation";
import { CALL_AFTER, CONTRACT, GOALK, REQ_TONE, SOLD_ST, UPD, lbl } from "@/lib/crm/constants";
import {
  clientById, comm, goalOf, match, matchesForReq, members, nameOf, OPEN_REQ, propById, propMsg, propSummary,
  unitsOf, visibleRequests, can } from "@/lib/crm/logic";
import {
  applyUpdate, cancelSale, cancelViewing, deleteAttendance, postponeViewing, reqSent, saveAttendance, saveClose, scheduleViewing, transferRequest, viewingResult, write,
} from "@/lib/crm/actions";
import type { HrFile } from "@/lib/crm/types";
import { addDays, fmtVisit, localDay, monthName, money, moneyFull, nowStamp, num, relDay, today, waLink } from "@/lib/crm/util";
import { ConfirmButton, Field, ModalFrame, Pill, RadioChips, Select } from "./ui";
import { DemandChips } from "./bits";
import { ClientForm, PropertyForm, RequestForm, TaskForm } from "./forms";

export function ModalHost() {
  const { modal } = useCrm();
  if (!modal) return null;
  switch (modal.kind) {
    case "client": return <ClientForm key={modal.id || "new"} id={modal.id} />;
    case "request": return <RequestForm key={(modal.id || "new") + (modal.preset?.clientId || "")} id={modal.id} preset={modal.preset} />;
    case "property": return <PropertyForm key={modal.id || "new"} id={modal.id} />;
    case "task": return <TaskForm key={modal.id || "new"} id={modal.id} preset={modal.preset} />;
    case "update": return <UpdateModal key={modal.clientId} clientId={modal.clientId} type={modal.type} propertyId={modal.propertyId} reqId={modal.reqId} />;
    case "visit": return <VisitModal reqId={modal.reqId} propertyId={modal.propertyId} viewingId={modal.viewingId} />;
    case "viewResult": return <ViewResultModal viewingId={modal.viewingId} />;
    case "close": return <CloseModal reqId={modal.reqId} to={modal.to} />;
    case "cancel": return <CancelModal reqId={modal.reqId} to={modal.to} />;
    case "reqMatches": return <ReqMatchesModal reqId={modal.reqId} />;
    case "propReqs": return <PropReqsModal propId={modal.propId} />;
    case "transfer": return <TransferModal reqId={modal.reqId} />;
    case "goal": return <GoalModal key={modal.uid + modal.month} uid={modal.uid} month={modal.month} />;
    case "hr": return <HrModal uid={modal.uid} />;
    case "attEdit": return <AttEditModal uid={modal.uid} date={modal.date} />;
  }
}

/* ---------- log a client update ---------- */
/** Deposit and sale go through their own form (amount, unit, reservation) — never straight from an update. */
const DEAL_UPD: Record<string, string> = { "دفع عربون": "عربون", "تم الإغلاق": "تم البيع" };

function UpdateModal({ clientId, type: t0, propertyId: p0, reqId }: { clientId: string; type?: string; propertyId?: string; reqId?: string }) {
  const { data, closeModal, toast, openModal } = useCrm();
  const c = clientById(data, clientId);
  const [type, setType] = useState(t0 || "");
  // A customer with a request gets a call date only after options are sent or a visit; a new number keeps the usual retry.
  const hasReq = !!c && data.requests.some((r) => r.clientId === c.id && !["تم البيع", "ملغي"].includes(r.status || "جديد"));
  const defNext = (k: string) => (hasReq && !CALL_AFTER.includes(k) ? "none" : String(UPD.find((u) => u.k === k)?.n ?? (hasReq ? "none" : 3)));
  const [next, setNext] = useState(t0 ? defNext(t0) : hasReq ? "none" : "3");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [prop, setProp] = useState(p0 || c?.interestIn || "");
  if (!c) return null;
  const u = UPD.find((x) => x.k === type);
  async function save() {
    if (!type) return toast("يرجى اختيار نتيجة التواصل أولاً");
    if (DEAL_UPD[type]) {
      const r = (reqId && data.requests.find((x) => x.id === reqId && OPEN_REQ(x))) || data.requests.filter((x) => x.clientId === clientId && OPEN_REQ(x)).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];
      if (!r) return toast("سجّل طلباً للعميل أولاً، ثم سجّل " + (type === "دفع عربون" ? "العربون" : "البيع") + " عليه");
      openModal({ kind: "close", reqId: r.id, to: DEAL_UPD[type] });
      return;
    }
    let nx: string | null = null;
    if (next === "date") {
      if (!date) return toast("اختر التاريخ");
      nx = date;
    } else if (next !== "none") nx = addDays(+next);
    await applyUpdate(data, clientId, type, nx, note.trim(), prop || null, { reqId });
    toast("تم — " + (nx ? "الاتصال القادم " + relDay(nx) + " (" + nx + ")" : "بدون موعد اتصال"));
    closeModal();
  }
  return (
    <ModalFrame title={"تحديث: " + c.name} onClose={closeModal} width={560}
      footer={<div className="flex gap-2"><button type="button" className="crm-btn primary" onClick={save}>حفظ التحديث</button><button type="button" className="crm-btn" onClick={closeModal}>إلغاء</button></div>}>
      <div className="crm-sec !mt-0 mb-2">نتيجة التواصل</div>
      <RadioChips options={UPD.filter((x) => !DEAL_UPD[x.k] || can(data, "recordDeals")).map((x) => [x.k, lbl(x.k)] as [string, string])} value={type} onChange={(v) => { setType(v); setNext(defNext(v)); }} />
      <div className="mt-3 grid gap-3">
        <Field label="العقار (اختياري)"><Select value={prop} onChange={setProp} options={data.props.map((p) => [p.id, p.title] as [string, string])} blank="—" /></Field>
        <Field label="ملاحظة"><textarea rows={2} value={note} placeholder="مثال: أعجبته الفيلا ويرغب في معاينتها مع زوجته" onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
      <div className="crm-sec mb-2">الاتصال القادم</div>
      <RadioChips options={[["1", "غداً"], ["3", "بعد 3 أيام"], ["7", "بعد أسبوع"], ["date", "تاريخ محدد"], ["none", "بدون موعد"]]} value={next} onChange={setNext} />
      {next === "date" && <input type="date" className="mt-2" min={today()} value={date} onChange={(e) => setDate(e.target.value)} />}
      {u?.status && !DEAL_UPD[type] && <p className="crm-hint mt-2">ستتغير حالة العميل إلى: {u.status}</p>}
      {DEAL_UPD[type] && <p className="crm-hint mt-2">عند الحفظ يُفتح نموذج {type === "دفع عربون" ? "العربون" : "البيع"} لتسجيل المبلغ والعقار والوحدة.</p>}
    </ModalFrame>
  );
}

/* ---------- visit appointment ---------- */
function VisitModal({ reqId, propertyId, viewingId }: { reqId: string; propertyId?: string; viewingId?: string }) {
  const { data, closeModal, toast } = useCrm();
  const r = data.requests.find((x) => x.id === reqId);
  const c = r && clientById(data, r.clientId);
  // Postponing an existing viewing (trial 2026-10-22) or booking a new one.
  const v = viewingId ? data.viewings.find((x) => x.id === viewingId) : undefined;
  const ms = useMemo(() => (r ? data.props.filter((p) => match(r, p)) : []), [data.props, r]);
  const sentProp = r?.sent?.length ? r.sent[r.sent.length - 1] : "";
  const [at, setAt] = useState(v?.at || c?.visitAt || "");
  const [pid, setPid] = useState(v?.propertyId || propertyId || c?.visitProperty || sentProp || ms[0]?.id || "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  if (!r || !c) return null;
  return (
    <ModalFrame title={(v ? "تأجيل المعاينة: " : "موعد معاينة: ") + c.name} onClose={closeModal} width={480}
      footer={
        <>
          <div className="flex gap-2">
            <button type="button" className="crm-btn primary" disabled={saving} onClick={async () => {
              if (!at) return toast("حدد التاريخ والوقت");
              if (saving) return;
              setSaving(true);
              if (v) await postponeViewing(data, v, at, note.trim());
              else await scheduleViewing(data, r.id, at, pid || null, note.trim());
              toast((v ? "أُجّلت المعاينة إلى " : "تم حفظ موعد المعاينة ") + fmtVisit(at));
              closeModal();
            }}>{v ? "حفظ الموعد الجديد" : "حفظ الموعد"}</button>
            <button type="button" className="crm-btn" onClick={closeModal}>إلغاء</button>
          </div>
          {v && (
            <button type="button" className="crm-btn danger" onClick={async () => { await cancelViewing(data, v, note.trim()); toast("أُلغيت المعاينة"); closeModal(); }}>إلغاء المعاينة</button>
          )}
        </>
      }>
      <div className="grid gap-3">
        <Field label="التاريخ والوقت"><input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></Field>
        {!v && (
          <Field label="العقار">
            <Select value={pid} onChange={setPid} options={data.props.map((p) => [p.id, p.title + (ms.includes(p) ? " ✓" : "")] as [string, string])} blank="—" />
          </Field>
        )}
        <Field label={v ? "سبب التأجيل أو الإلغاء (اختياري)" : "ملاحظة (اختياري)"}><input value={note} placeholder={v ? "مثال: العميل مسافر" : "مثال: سيحضر مع زوجته"} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
      <p className="crm-hint mt-2">تُحفظ في سجل المعاينات، وقبل الموعد بيوم تظهر في لوحتك لتأكيدها مع العميل.</p>
    </ModalFrame>
  );
}

/* ---------- viewing result (trial 2026-10-22) ---------- */
function ViewResultModal({ viewingId }: { viewingId: string }) {
  const { data, closeModal, toast } = useCrm();
  const v = data.viewings.find((x) => x.id === viewingId);
  const [res, setRes] = useState<"interested" | "unsuitable" | "thinking" | "">("");
  const [fb, setFb] = useState("");
  const [next, setNext] = useState("1");
  if (!v) return null;
  const c = clientById(data, v.clientId), p = propById(data, v.propertyId);
  return (
    <ModalFrame title={"نتيجة المعاينة: " + (c?.name || "")} onClose={closeModal} width={520}
      footer={<div className="flex gap-2">
        <button type="button" className="crm-btn primary" onClick={async () => {
          if (!res) return toast("اختر رأي العميل");
          await viewingResult(data, v, res, fb.trim(), next === "none" ? null : addDays(+next));
          toast(res === "interested" ? "انتقل الطلب إلى التفاوض" : res === "unsuitable" ? "عاد الطلب إلى مرحلة «جاري البحث»" : "سُجّلت النتيجة وموعد المتابعة");
          closeModal();
        }}>حفظ</button>
        <button type="button" className="crm-btn" onClick={closeModal}>إلغاء</button>
      </div>}>
      <p className="m-0 mb-2 text-[13.5px]">{p?.title || "—"} · {fmtVisit(v.at)}</p>
      <div className="crm-sec !mt-0 mb-2">رأي العميل</div>
      <RadioChips options={[["interested", "مهتم — ننتقل للتفاوض"], ["thinking", "يفكر"], ["unsuitable", "غير مناسب — نبحث عن غيره"]]} value={res} onChange={(x) => setRes(x as typeof res)} />
      <Field label="ملاحظات العميل"><textarea rows={2} value={fb} placeholder="مثال: أعجبته المساحة لكن السعر مرتفع" onChange={(e) => setFb(e.target.value)} /></Field>
      <div className="crm-sec mb-2">متابعة بعد المعاينة</div>
      <RadioChips options={[["1", "غداً"], ["3", "بعد 3 أيام"], ["7", "بعد أسبوع"], ["none", "بدون موعد"]]} value={next} onChange={setNext} />
    </ModalFrame>
  );
}

/* ---------- deposit / sale ---------- */
function CloseModal({ reqId, to }: { reqId: string; to: string }) {
  const { data, closeModal, toast } = useCrm();
  const router = useRouter();
  // A new deposit goes straight to its receipt (سند قبض) unless unticked.
  const [withReceipt, setWithReceipt] = useState(true);
  const r = data.requests.find((x) => x.id === reqId);
  const c = r && clientById(data, r.clientId);
  const order = useMemo(() => {
    if (!r) return [];
    const ms = matchesForReq(data, r).map((x) => x.p);
    const sentP = (r.sent || []).map((id) => propById(data, id)).filter(Boolean);
    return [...new Set([propById(data, r.propertyId), ...sentP, ...ms, ...data.props].filter(Boolean))] as typeof data.props;
  }, [data, r]);
  const [pid, setPid] = useState(r?.propertyId || order[0]?.id || "");
  const [unit, setUnit] = useState(r?.unit || "");
  const [price, setPrice] = useState(String(r?.price ?? (r?.propertyId ? "" : order[0]?.price ?? "")));
  const [pct, setPct] = useState(String(r?.commissionPct ?? 2.5));
  const sale = to === "تم البيع";
  const [extra, setExtra] = useState(sale ? (r?.closedAt ? localDay(r.closedAt) : today()) : String(r?.deposit ?? ""));
  const [depDay, setDepDay] = useState(r?.depositAt ? localDay(r.depositAt) : today());
  if (!r) return null;
  const p = propById(data, pid);
  const us = p ? unitsOf(p) : [];
  const commPreview = comm({ price: num(price), commissionPct: num(pct) ?? 2.5 });
  return (
    <ModalFrame title={(to === "تم البيع" ? "تم البيع" : "عربون") + ": " + (c?.name || "")} onClose={closeModal} width={520}
      footer={<div className="flex gap-2">
        <button type="button" className="crm-btn primary" onClick={async () => {
          const pr = num(price);
          if (!pid || !pr) return toast("يرجى اختيار العقار وإدخال قيمة البيع");
          if (!can(data, "recordDeals")) return toast("لا تملك صلاحية تسجيل العربون أو البيع");
          if (us.length && !unit) return toast("يرجى اختيار الوحدة");
          // Never let two open deals hold the same property/unit.
          const taken = data.requests.find((x) => x.id !== r.id && SOLD_ST.includes(x.status) && x.propertyId === pid && (x.unit || "") === (unit || ""));
          if (taken) return toast("هذا العقار " + (taken.status === "تم البيع" ? "مباع" : "محجوز") + " للعميل " + (clientById(data, taken.clientId)?.name || "") + " — يرجى إلغاء عربونه أولاً أو اختيار عقار آخر");
          if (!sale && !num(extra)) return toast("يرجى إدخال مبلغ العربون");
          await saveClose(data, r.id, to, { propertyId: pid, unit: unit || null, price: pr, pct: num(pct) ?? 2.5, extra, depositDay: sale ? null : depDay });
          toast(to === "تم البيع" ? "مبروك! تم تسجيل البيع" : "تم تسجيل العربون");
          closeModal();
          if (!sale && withReceipt) router.push("/admin/receipt/" + r.id);
        }}>حفظ</button>
        {to !== "تم البيع" && (
          <label className="flex items-center gap-1.5 text-[13px]">
            <input type="checkbox" className="h-4 w-4 accent-[var(--crm-gold)]" checked={withReceipt} onChange={(e) => setWithReceipt(e.target.checked)} />
            إصدار سند قبض بعد الحفظ
          </label>
        )}
        <button type="button" className="crm-btn" onClick={closeModal}>إلغاء</button>
      </div>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="العقار" full>
          <Select value={pid} onChange={(v) => { setPid(v); setUnit(""); const np = propById(data, v); if (np && !unitsOf(np).length && np.price && !price) setPrice(String(np.price)); }}
            options={order.map((x) => [x.id, x.title + (!unitsOf(x).length && x.status && x.status !== "متاح" && x.id !== r.propertyId ? " — " + x.status : "")] as [string, string])} />
        </Field>
        <Field label="الوحدة (للمشاريع)">
          <select value={unit} onChange={(e) => { setUnit(e.target.value); const u = us.find((x) => x.name === e.target.value); if (u?.price) setPrice(String(u.price)); }}>
            <option value="">{us.length ? "يرجى اختيار الوحدة" : "لا توجد وحدات"}</option>
            {us.map((u) => <option key={u.name} value={u.name}>{u.name} — {u.status || "متاح"}</option>)}
          </select>
        </Field>
        <Field label="قيمة البيع (ريال)"><input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        <Field label="السعي %"><input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} /></Field>
        {sale ? (
          <Field label="تاريخ الإفراغ"><input type="date" value={extra} onChange={(e) => setExtra(e.target.value)} /></Field>
        ) : (
          <>
            <Field label="مبلغ العربون (ريال)"><input inputMode="decimal" value={extra} placeholder="مثال: 50000" onChange={(e) => setExtra(e.target.value)} /></Field>
            <Field label="تاريخ العربون"><input type="date" max={today()} value={depDay} onChange={(e) => setDepDay(e.target.value || today())} /></Field>
          </>
        )}
      </div>
      {num(price) ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-[var(--crm-surface-2)] px-3 py-2 text-[13px]">
          <span>قيمة البيع <b className="num">{moneyFull(num(price))}</b></span>
          <span>السعي <b className="num text-[var(--crm-gold-ink)]">{moneyFull(commPreview)}</b></span>
          {!sale && num(extra) ? <span>العربون <b className="num">{moneyFull(num(extra))}</b></span> : null}
        </div>
      ) : null}
      <p className="crm-hint mt-2">{sale ? 'تتحول حالة الوحدة أو العقار إلى "مباع"، ويُحتسب السعي في المبيعات وعمولة الموظف.' : 'تتحول حالة الوحدة أو العقار إلى "محجوز"، ويظهر العربون في ملف العميل والمبيعات وملخص اليوم.'}</p>
    </ModalFrame>
  );
}

function CancelModal({ reqId, to }: { reqId: string; to?: string }) {
  const { data, closeModal, toast } = useCrm();
  const r = data.requests.find((x) => x.id === reqId);
  const [note, setNote] = useState("");
  if (!r) return null;
  const c = clientById(data, r.clientId),
    p = propById(data, r.propertyId);
  const what = r.status === "تم البيع" ? "البيع" : "العربون";
  const dest = to || "تفاوض";
  return (
    <ModalFrame title={"إلغاء " + what + ": " + (c?.name || "")} onClose={closeModal} width={460}
      footer={<div className="flex gap-2">
        <button type="button" className="crm-btn danger" onClick={async () => { await cancelSale(data, r.id, dest, note.trim()); toast("تم الإلغاء، وعاد العقار متاحاً"); closeModal(); }}>إلغاء {what}</button>
        <button type="button" className="crm-btn" onClick={closeModal}>رجوع</button>
      </div>}>
      <p>
        {p && <>يعود العقار <b>{p.title}{r.unit ? " — " + r.unit : ""}</b> إلى حالة <b>متاح</b>، و</>}
        يعود الطلب إلى مرحلة <b>{dest}</b>، ويُستبعد من المبيعات والعمولات.
      </p>
      <Field label="السبب (اختياري)"><input value={note} placeholder="مثال: تراجع العميل" onChange={(e) => setNote(e.target.value)} /></Field>
    </ModalFrame>
  );
}

/* ---------- transfer a request ---------- */
function TransferModal({ reqId }: { reqId: string }) {
  const { data, closeModal, toast } = useCrm();
  const r = data.requests.find((x) => x.id === reqId);
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!r) return null;
  const c = clientById(data, r.clientId);
  const cur = r.assignee || c?.assignee || null;
  const others = (c ? data.requests.filter((x) => x.clientId === c.id && x.id !== r.id && OPEN_REQ(x)) : []).length;
  return (
    <ModalFrame title={"تحويل طلب " + (c?.name || "")} onClose={closeModal} width={460}
      footer={<div className="flex gap-2">
        <button type="button" className="crm-btn primary" disabled={!to || busy} onClick={async () => {
          setBusy(true);
          try { await transferRequest(data, r, to, note.trim()); toast("تم تحويل الطلب إلى " + nameOf(data, to)); closeModal(); }
          catch { toast("تعذّر التحويل، يرجى المحاولة مجدداً"); setBusy(false); }
        }}>تحويل</button>
        <button type="button" className="crm-btn" onClick={closeModal}>رجوع</button>
      </div>}>
      <p className="m-0">المسؤول الحالي: <b>{cur ? nameOf(data, cur) : "غير مسند"}</b></p>
      <Field label="حوّله إلى">
        <select value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">اختر الموظف</option>
          {members(data).filter((id) => id !== cur).map((id) => <option key={id} value={id}>{nameOf(data, id)}</option>)}
        </select>
      </Field>
      <Field label="السبب (اختياري)"><input value={note} placeholder="مثال: الموظف في إجازة" onChange={(e) => setNote(e.target.value)} /></Field>
      <p className="crm-hint m-0">ينتقل العميل معه{others ? " ومعه " + others + " طلب مفتوح آخر" : ""}، ويُسجَّل التحويل في ملف العميل، ويظهر للموظف الجديد كعميل جديد.</p>
    </ModalFrame>
  );
}

/* ---------- matching ---------- */
function ReqMatchesModal({ reqId }: { reqId: string }) {
  const { data, closeModal, toast } = useCrm();
  const r = data.requests.find((x) => x.id === reqId);
  if (!r) return null;
  const c = clientById(data, r.clientId);
  const ms = matchesForReq(data, r);
  return (
    <ModalFrame title={"العقارات المناسبة لطلب " + (c?.name || "")} onClose={closeModal}>
      <div className="mb-2.5 flex flex-wrap gap-1.5"><DemandChips r={r} /></div>
      {ms.length ? (
        <div className="grid gap-2.5">
          {ms.map(({ p, m }) => {
            const wa = c?.phone ? waLink(c.phone, p.waMessage ? propMsg(p) : "السلام عليكم " + (c.name || "") + "،\n" + propSummary(p, m.units)) : null;
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-[var(--crm-surface-2)] px-2.5 py-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.images?.[0] && <img className="h-[42px] w-14 rounded-md object-cover" src={p.images[0]} alt="" />}
                  <span className="num min-w-[42px] font-heading text-[var(--crm-gold-ink)]">{m.score}%</span>
                  <span><b>{p.title}</b>{m.unit && <span className="muted"> ({m.unit.name})</span>} · <span className="text-[var(--crm-gold-ink)]">{money(m.unit ? m.unit.price ?? p.price : p.price)}</span></span>
                  <span className="muted text-[12.5px]">{m.why.join(" · ")}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {wa && <a className="crm-btn sm wa" href={wa} target="_blank" rel="noopener" onClick={() => reqSent(data, r.id, p.id).then(() => toast("تم التسجيل: إرسال " + p.title + " — اتصال بعد 3 أيام"))}>أرسل إليه</a>}
                  <button type="button" className="crm-btn sm" onClick={() => navigator.clipboard?.writeText(propMsg(p)).then(() => toast("تم نسخ الرسالة، يرجى لصقها للعميل في واتساب"))}>نسخ الرسالة</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="crm-empty">لا يوجد عقار متاح يطابق هذا الطلب حالياً.</div>
      )}
    </ModalFrame>
  );
}

function PropReqsModal({ propId }: { propId: string }) {
  const { data, closeModal, openModal, toast } = useCrm();
  const p = propById(data, propId);
  if (!p) return null;
  const rs = visibleRequests(data)
    .filter(OPEN_REQ)
    .map((r) => ({ r, m: match(r, p) }))
    .filter((x) => x.m)
    .sort((a, b) => b.m!.score - a.m!.score);
  return (
    <ModalFrame title={"عملاء يناسبهم " + p.title} onClose={closeModal}>
      {rs.length ? (
        <div className="grid gap-2.5">
          {rs.map(({ r, m }) => {
            const c = clientById(data, r.clientId);
            const wa = c?.phone ? waLink(c.phone, p.waMessage ? propMsg(p) : "السلام عليكم " + (c.name || "") + "،\n" + propSummary(p, m!.units)) : null;
            return (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-[var(--crm-surface-2)] px-2.5 py-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="num min-w-[42px] font-heading text-[var(--crm-gold-ink)]">{m!.score}%</span>
                  <span><b className="link" onClick={() => openModal({ kind: "request", id: r.id })}>{c?.name || ""}</b> <Pill tone={REQ_TONE[r.status || "جديد"]}>{r.status || "جديد"}</Pill></span>
                  <span className="muted text-[12.5px]">{m!.why.join(" · ")}</span>
                </div>
                {wa && <a className="crm-btn sm wa" href={wa} target="_blank" rel="noopener" onClick={() => reqSent(data, r.id, p.id).then(() => toast("تم التسجيل: إرسال " + p.title))}>أرسل إليه</a>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="crm-empty">لا توجد طلبات مفتوحة تناسب هذا العقار.</div>
      )}
    </ModalFrame>
  );
}

/* ---------- monthly goals ---------- */
function GoalModal({ uid, month }: { uid: string; month: string }) {
  const { data, closeModal, openModal, toast } = useCrm();
  const g = goalOf(data, uid, month);
  const prev = (() => { const d = new Date(month + "-15"); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();
  const pg = goalOf(data, uid, prev);
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(GOALK.map(([k]) => [k, g?.[k] != null ? String(g[k]) : ""])));
  const [note, setNote] = useState(g?.note || "");
  async function save(all: boolean) {
    const body = Object.fromEntries(GOALK.map(([k]) => [k, num(v[k])]));
    const ids = all ? members(data) : [uid];
    for (const id of ids) await write("goals", month + "_" + id, { uid: id, month, ...body, note: note.trim(), updatedAt: nowStamp(), by: data.uid });
    toast(all ? "تم تحديد الأهداف لجميع أعضاء الفريق" : "تم حفظ أهداف " + nameOf(data, uid));
    closeModal();
  }
  return (
    <ModalFrame title={"أهداف " + monthName(month)} onClose={closeModal} width={620}
      footer={<div className="flex flex-wrap gap-2">
        <button type="button" className="crm-btn primary" onClick={() => save(false)}>حفظ</button>
        <button type="button" className="crm-btn" onClick={() => save(true)}>تطبيق الأهداف نفسها على الجميع</button>
        {pg && <button type="button" className="crm-btn ghost" onClick={() => { setV(Object.fromEntries(GOALK.map(([k]) => [k, pg[k] != null ? String(pg[k]) : ""]))); setNote(pg.note || ""); toast("تم نسخ أهداف الشهر الماضي، يرجى مراجعتها وحفظها"); }}>نسخ أهداف الشهر الماضي</button>}
      </div>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الموظف" full>
          <Select value={uid} onChange={(x) => openModal({ kind: "goal", uid: x, month })} options={members(data).map((id) => [id, nameOf(data, id)] as [string, string])} />
        </Field>
        {GOALK.map(([k, l]) => (
          <Field key={k} label={l}><input inputMode="numeric" placeholder="—" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>
        ))}
        <Field label="ملاحظة للموظف (تظهر أعلى أهدافه)" full><input value={note} placeholder="مثال: التركيز على النرجس والملقا" onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
      <p className="crm-hint mt-2">اترك الحقل فارغاً إذا لم ترغب في تحديد هدف له.</p>
    </ModalFrame>
  );
}

/* ---------- HR file ---------- */
function HrModal({ uid }: { uid: string }) {
  const { data, closeModal, toast } = useCrm();
  const x: Partial<HrFile> = data.hr.find((h) => h.id === uid) || {};
  const s = (k: keyof HrFile) => (x[k] == null ? "" : String(x[k]));
  const [f, setF] = useState<Record<string, string>>({
    jobTitle: s("jobTitle"), contractType: x.contractType || "دوام كامل", hireDate: s("hireDate"), contractEnd: s("contractEnd"),
    workStart: x.workStart || "09:00", workEnd: x.workEnd || "17:00", salary: s("salary"), housing: s("housing"), transport: s("transport"),
    otherAllow: s("otherAllow"), commissionPct: s("commissionPct"), iban: s("iban"), notes: s("notes"),
  });
  const [docs, setDocs] = useState(x.docs || []);
  const [dn, setDn] = useState({ name: "", url: "" });
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  async function save() {
    await write("hr", uid, {
      jobTitle: f.jobTitle.trim() || null, contractType: f.contractType || null, hireDate: f.hireDate || null, contractEnd: f.contractEnd || null,
      workStart: f.workStart || null, workEnd: f.workEnd || null, salary: num(f.salary), housing: num(f.housing), transport: num(f.transport),
      otherAllow: num(f.otherAllow), commissionPct: num(f.commissionPct), iban: f.iban.trim() || null, docs, notes: f.notes.trim() || null,
    });
    toast("تم الحفظ");
    closeModal();
  }
  return (
    <ModalFrame title={"ملف " + nameOf(data, uid)} onClose={closeModal}
      footer={<div className="flex gap-2"><button type="button" className="crm-btn primary" onClick={save}>حفظ</button><button type="button" className="crm-btn" onClick={closeModal}>إلغاء</button></div>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="crm-sec sm:col-span-2">الوظيفة</div>
        <Field label="المسمى الوظيفي"><input value={f.jobTitle} placeholder="مسوق عقاري" onChange={(e) => set("jobTitle", e.target.value)} /></Field>
        <Field label="نوع العقد"><Select value={f.contractType} onChange={(v) => set("contractType", v)} options={CONTRACT} /></Field>
        <Field label="تاريخ المباشرة"><input type="date" value={f.hireDate} onChange={(e) => set("hireDate", e.target.value)} /></Field>
        <Field label="تاريخ نهاية العقد"><input type="date" value={f.contractEnd} onChange={(e) => set("contractEnd", e.target.value)} /></Field>
        <Field label="بداية الدوام"><input type="time" value={f.workStart} onChange={(e) => set("workStart", e.target.value)} /></Field>
        <Field label="نهاية الدوام"><input type="time" value={f.workEnd} onChange={(e) => set("workEnd", e.target.value)} /></Field>
        <div className="crm-sec sm:col-span-2">الراتب والعمولة</div>
        <Field label="الراتب الأساسي"><input inputMode="decimal" value={f.salary} onChange={(e) => set("salary", e.target.value)} /></Field>
        <Field label="بدل السكن"><input inputMode="decimal" value={f.housing} onChange={(e) => set("housing", e.target.value)} /></Field>
        <Field label="بدل النقل"><input inputMode="decimal" value={f.transport} onChange={(e) => set("transport", e.target.value)} /></Field>
        <Field label="بدلات أخرى"><input inputMode="decimal" value={f.otherAllow} onChange={(e) => set("otherAllow", e.target.value)} /></Field>
        <Field label="نسبته من السعي %" hint="مثال: 20 تعني أنه يحصل على 20% من السعي الذي يحققه"><input inputMode="decimal" value={f.commissionPct} onChange={(e) => set("commissionPct", e.target.value)} /></Field>
        <Field label="الآيبان"><input dir="ltr" value={f.iban} placeholder="SA…" onChange={(e) => set("iban", e.target.value)} /></Field>
        <div className="crm-sec sm:col-span-2">المستندات</div>
        <div className="grid gap-1.5 sm:col-span-2">
          {docs.length ? docs.map((d, i) => (
            <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--crm-line)] px-2.5 py-1.5 text-[13.5px]">
              <a href={d.url} target="_blank" rel="noopener" className="text-[var(--crm-gold-ink)] underline">{d.name || "مستند " + (i + 1)}</a>
              <button type="button" className="crm-btn ghost sm" onClick={() => setDocs(docs.filter((_, j) => j !== i))}>حذف</button>
            </div>
          )) : <span className="crm-hint">لا توجد مستندات.</span>}
          <div className="flex flex-wrap gap-2">
            <input className="crm-input flex-1" value={dn.name} placeholder="اسم المستند (عقد، هوية…)" onChange={(e) => setDn({ ...dn, name: e.target.value })} />
            <input className="crm-input flex-[2]" dir="ltr" value={dn.url} placeholder="https://… رابط الملف (Google Drive مثلاً)" onChange={(e) => setDn({ ...dn, url: e.target.value })} />
            <button type="button" className="crm-btn" onClick={() => { if (dn.url.trim()) { setDocs([...docs, { name: dn.name.trim(), url: dn.url.trim() }]); setDn({ name: "", url: "" }); } }}>+ إضافة</button>
          </div>
        </div>
        <Field label="ملاحظات" full><textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      </div>
    </ModalFrame>
  );
}

/* ---------- attendance edit (admin) ---------- */
function AttEditModal({ uid, date }: { uid: string; date: string }) {
  const { data, closeModal, toast } = useCrm();
  const r = date ? (data.att[uid] || []).find((x) => x.id === date) : undefined;
  const t = (v: string | null | undefined) => (v ? clock(new Date(v)) : "");
  const [d, setD] = useState(date || today());
  const [i, setI] = useState(t(r?.in));
  const [o, setO] = useState(t(r?.out));
  return (
    <ModalFrame title={"حضور " + nameOf(data, uid)} onClose={closeModal} width={440}
      footer={
        <>
          <div className="flex gap-2">
            <button type="button" className="crm-btn primary" onClick={async () => {
              if (!d || !i) return toast("التاريخ ووقت الحضور مطلوبان");
              await saveAttendance(uid, d, i, o, data.uid);
              toast("تم الحفظ");
              closeModal();
            }}>حفظ</button>
            <button type="button" className="crm-btn" onClick={closeModal}>إلغاء</button>
          </div>
          {date && <ConfirmButton onConfirm={async () => { await deleteAttendance(uid, date); toast("تم الحذف"); closeModal(); }}>حذف اليوم</ConfirmButton>}
        </>
      }>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="التاريخ" full><input type="date" value={d} disabled={!!date} onChange={(e) => setD(e.target.value)} /></Field>
        <Field label="الحضور"><input type="time" value={i} onChange={(e) => setI(e.target.value)} /></Field>
        <Field label="الانصراف"><input type="time" value={o} onChange={(e) => setO(e.target.value)} /></Field>
      </div>
    </ModalFrame>
  );
}

