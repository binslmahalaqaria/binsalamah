"use client";

/** Action modals for the sales CRM, plus the host that renders whichever one is open. */
import { useMemo, useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { CONTRACT, GOALK, REQ_TONE, UPD } from "@/lib/crm/constants";
import {
  clientById, goalOf, match, matchesForReq, members, nameOf, OPEN_REQ, propById, propMsg, propSummary,
  unitsOf, visibleRequests,
} from "@/lib/crm/logic";
import {
  applyUpdate, cancelSale, deleteAttendance, reqSent, saveAttendance, saveClose, saveVisit, write,
} from "@/lib/crm/actions";
import type { HrFile } from "@/lib/crm/types";
import { addDays, fmtVisit, monthName, money, nowStamp, num, relDay, today, waLink } from "@/lib/crm/util";
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
    case "update": return <UpdateModal key={modal.clientId} clientId={modal.clientId} type={modal.type} propertyId={modal.propertyId} />;
    case "visit": return <VisitModal reqId={modal.reqId} />;
    case "close": return <CloseModal reqId={modal.reqId} to={modal.to} />;
    case "cancel": return <CancelModal reqId={modal.reqId} to={modal.to} />;
    case "reqMatches": return <ReqMatchesModal reqId={modal.reqId} />;
    case "propReqs": return <PropReqsModal propId={modal.propId} />;
    case "goal": return <GoalModal key={modal.uid + modal.month} uid={modal.uid} month={modal.month} />;
    case "hr": return <HrModal uid={modal.uid} />;
    case "attEdit": return <AttEditModal uid={modal.uid} date={modal.date} />;
  }
}

/* ---------- log a client update ---------- */
function UpdateModal({ clientId, type: t0, propertyId: p0 }: { clientId: string; type?: string; propertyId?: string }) {
  const { data, closeModal, toast } = useCrm();
  const c = clientById(data, clientId);
  const [type, setType] = useState(t0 || "");
  const [next, setNext] = useState(t0 ? String(UPD.find((u) => u.k === t0)?.n ?? 3) : "3");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [prop, setProp] = useState(p0 || c?.interestIn || "");
  if (!c) return null;
  const u = UPD.find((x) => x.k === type);
  async function save() {
    if (!type) return toast("اختر وش صار أول");
    let nx: string | null = null;
    if (next === "date") {
      if (!date) return toast("اختر التاريخ");
      nx = date;
    } else if (next !== "none") nx = addDays(+next);
    await applyUpdate(data, clientId, type, nx, note.trim(), prop || null);
    toast("تم — " + (nx ? "الاتصال القادم " + relDay(nx) + " (" + nx + ")" : "بدون موعد اتصال"));
    closeModal();
  }
  return (
    <ModalFrame title={"تحديث: " + c.name} onClose={closeModal} width={560}
      footer={<div className="flex gap-2"><button type="button" className="crm-btn primary" onClick={save}>حفظ التحديث</button><button type="button" className="crm-btn" onClick={closeModal}>إلغاء</button></div>}>
      <div className="crm-sec !mt-0 mb-2">وش صار؟</div>
      <RadioChips options={UPD.map((x) => x.k)} value={type} onChange={(v) => { setType(v); setNext(String(UPD.find((x) => x.k === v)?.n ?? 3)); }} />
      <div className="mt-3 grid gap-3">
        <Field label="العقار (اختياري)"><Select value={prop} onChange={setProp} options={data.props.map((p) => [p.id, p.title] as [string, string])} blank="—" /></Field>
        <Field label="ملاحظة"><textarea rows={2} value={note} placeholder="مثال: عجبته الفيلا بس يبي يشوفها مع زوجته" onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
      <div className="crm-sec mb-2">الاتصال القادم</div>
      <RadioChips options={[["1", "بكرة"], ["3", "بعد 3 أيام"], ["7", "بعد أسبوع"], ["date", "تاريخ محدد"], ["none", "بدون موعد"]]} value={next} onChange={setNext} />
      {next === "date" && <input type="date" className="mt-2" min={today()} value={date} onChange={(e) => setDate(e.target.value)} />}
      {u?.status && <p className="crm-hint mt-2">حالة العميل بتتغير إلى: {u.status}</p>}
    </ModalFrame>
  );
}

/* ---------- visit appointment ---------- */
function VisitModal({ reqId }: { reqId: string }) {
  const { data, closeModal, toast } = useCrm();
  const r = data.requests.find((x) => x.id === reqId);
  const c = r && clientById(data, r.clientId);
  const ms = useMemo(() => (r ? data.props.filter((p) => match(r, p)) : []), [data.props, r]);
  const sentProp = r?.sent?.length ? r.sent[r.sent.length - 1] : "";
  const [at, setAt] = useState(c?.visitAt || "");
  const [pid, setPid] = useState(c?.visitProperty || sentProp || ms[0]?.id || "");
  const [note, setNote] = useState("");
  if (!r || !c) return null;
  return (
    <ModalFrame title={"موعد زيارة: " + c.name} onClose={closeModal} width={480}
      footer={
        <>
          <div className="flex gap-2">
            <button type="button" className="crm-btn primary" onClick={async () => {
              if (!at) return toast("حدد التاريخ والوقت");
              await saveVisit(data, r.id, at, pid || null, note.trim());
              toast("تم حفظ الموعد " + fmtVisit(at));
              closeModal();
            }}>حفظ الموعد</button>
            <button type="button" className="crm-btn" onClick={closeModal}>إلغاء</button>
          </div>
          {c.visitAt && (
            <button type="button" className="crm-btn danger" onClick={async () => { await saveVisit(data, r.id, null, null, ""); toast("انلغى الموعد"); closeModal(); }}>إلغاء الموعد</button>
          )}
        </>
      }>
      <div className="grid gap-3">
        <Field label="التاريخ والوقت"><input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></Field>
        <Field label="العقار">
          <Select value={pid} onChange={setPid} options={data.props.map((p) => [p.id, p.title + (ms.includes(p) ? " ✓" : "")] as [string, string])} blank="—" />
        </Field>
        <Field label="ملاحظة (اختياري)"><input value={note} placeholder="مثال: بيجي مع زوجته" onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
      <p className="crm-hint mt-2">قبل الموعد بيوم يطلع لك في شاشة &quot;اليوم&quot; عشان تأكد معه، والطلب ينتقل لمرحلة &quot;معاينة&quot;.</p>
    </ModalFrame>
  );
}

/* ---------- deposit / sale ---------- */
function CloseModal({ reqId, to }: { reqId: string; to: string }) {
  const { data, closeModal, toast } = useCrm();
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
  const [extra, setExtra] = useState(to === "تم البيع" ? today() : String(r?.deposit ?? ""));
  if (!r) return null;
  const p = propById(data, pid);
  const us = p ? unitsOf(p) : [];
  return (
    <ModalFrame title={(to === "تم البيع" ? "تم البيع" : "عربون") + ": " + (c?.name || "")} onClose={closeModal} width={520}
      footer={<div className="flex gap-2">
        <button type="button" className="crm-btn primary" onClick={async () => {
          const pr = num(price);
          if (!pid || !pr) return toast("اختر العقار واكتب قيمة البيع");
          await saveClose(data, r.id, to, { propertyId: pid, unit: unit || null, price: pr, pct: num(pct) ?? 2.5, extra });
          toast(to === "تم البيع" ? "مبروك! تسجّل البيع" : "تسجّل العربون");
          closeModal();
        }}>حفظ</button>
        <button type="button" className="crm-btn" onClick={closeModal}>إلغاء</button>
      </div>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="العقار" full>
          <Select value={pid} onChange={(v) => { setPid(v); setUnit(""); const np = propById(data, v); if (np && !unitsOf(np).length && np.price && !price) setPrice(String(np.price)); }}
            options={order.map((x) => [x.id, x.title] as [string, string])} />
        </Field>
        <Field label="الوحدة (للمشاريع)">
          <select value={unit} onChange={(e) => { setUnit(e.target.value); const u = us.find((x) => x.name === e.target.value); if (u?.price) setPrice(String(u.price)); }}>
            <option value="">{us.length ? "اختر الوحدة" : "ما فيه وحدات"}</option>
            {us.map((u) => <option key={u.name} value={u.name}>{u.name} — {u.status || "متاح"}</option>)}
          </select>
        </Field>
        <Field label="قيمة البيع (ريال)"><input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        <Field label="السعي %"><input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} /></Field>
        <Field label={to === "تم البيع" ? "تاريخ الإفراغ" : "مبلغ العربون (اختياري)"}>
          {to === "تم البيع" ? <input type="date" value={extra} onChange={(e) => setExtra(e.target.value)} /> : <input inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} />}
        </Field>
      </div>
      <p className="crm-hint mt-2">{to === "تم البيع" ? 'الوحدة أو العقار يتحوّل "مباع"، والسعي يدخل في المبيعات وعمولة الموظف.' : 'الوحدة أو العقار يتحوّل "محجوز".'}</p>
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
        <button type="button" className="crm-btn danger" onClick={async () => { await cancelSale(data, r.id, dest, note.trim()); toast("تم الإلغاء، والعقار رجع متاح"); closeModal(); }}>إلغاء {what}</button>
        <button type="button" className="crm-btn" onClick={closeModal}>رجوع</button>
      </div>}>
      <p>
        {p && <>العقار <b>{p.title}{r.unit ? " — " + r.unit : ""}</b> يرجع <b>متاح</b>، و</>}
        الطلب يرجع لمرحلة <b>{dest}</b>، ويطلع من المبيعات والعمولات.
      </p>
      <Field label="السبب (اختياري)"><input value={note} placeholder="مثال: العميل تراجع" onChange={(e) => setNote(e.target.value)} /></Field>
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
                  {wa && <a className="crm-btn sm wa" href={wa} target="_blank" rel="noopener" onClick={() => reqSent(data, r.id, p.id).then(() => toast("سجّلت: أرسلت " + p.title + " — اتصال بعد 3 أيام"))}>أرسل له</a>}
                  <button type="button" className="crm-btn sm" onClick={() => navigator.clipboard?.writeText(propMsg(p)).then(() => toast("تم نسخ الرسالة، الصقها للعميل في الواتساب"))}>نسخ الرسالة</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="crm-empty">ما فيه عقار متاح يطابق هذا الطلب حالياً.</div>
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
                {wa && <a className="crm-btn sm wa" href={wa} target="_blank" rel="noopener" onClick={() => reqSent(data, r.id, p.id).then(() => toast("سجّلت: أرسلت " + p.title))}>أرسل له</a>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="crm-empty">ما فيه طلبات مفتوحة تناسب هذا العقار.</div>
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
    toast(all ? "تحددت الأهداف لكل الفريق" : "تم حفظ أهداف " + nameOf(data, uid));
    closeModal();
  }
  return (
    <ModalFrame title={"أهداف " + monthName(month)} onClose={closeModal} width={620}
      footer={<div className="flex flex-wrap gap-2">
        <button type="button" className="crm-btn primary" onClick={() => save(false)}>حفظ</button>
        <button type="button" className="crm-btn" onClick={() => save(true)}>طبّق نفس الأهداف على الكل</button>
        {pg && <button type="button" className="crm-btn ghost" onClick={() => { setV(Object.fromEntries(GOALK.map(([k]) => [k, pg[k] != null ? String(pg[k]) : ""]))); setNote(pg.note || ""); toast("نسخت أهداف الشهر الماضي، راجعها واحفظ"); }}>نسخ أهداف الشهر الماضي</button>}
      </div>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الموظف" full>
          <Select value={uid} onChange={(x) => openModal({ kind: "goal", uid: x, month })} options={members(data).map((id) => [id, nameOf(data, id)] as [string, string])} />
        </Field>
        {GOALK.map(([k, l]) => (
          <Field key={k} label={l}><input inputMode="numeric" placeholder="—" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Field>
        ))}
        <Field label="ملاحظة للموظف (تطلع له فوق أهدافه)" full><input value={note} placeholder="مثال: ركّز على النرجس والملقا" onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
      <p className="crm-hint mt-2">اترك الخانة فاضية إذا ما تبي هدف لها.</p>
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
        <Field label="نسبته من السعي %" hint="مثال: 20 يعني ياخذ 20% من السعي اللي يحصّله"><input inputMode="decimal" value={f.commissionPct} onChange={(e) => set("commissionPct", e.target.value)} /></Field>
        <Field label="الآيبان"><input dir="ltr" value={f.iban} placeholder="SA…" onChange={(e) => set("iban", e.target.value)} /></Field>
        <div className="crm-sec sm:col-span-2">المستندات</div>
        <div className="grid gap-1.5 sm:col-span-2">
          {docs.length ? docs.map((d, i) => (
            <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--crm-line)] px-2.5 py-1.5 text-[13.5px]">
              <a href={d.url} target="_blank" rel="noopener" className="text-[var(--crm-gold-ink)] underline">{d.name || "مستند " + (i + 1)}</a>
              <button type="button" className="crm-btn ghost sm" onClick={() => setDocs(docs.filter((_, j) => j !== i))}>حذف</button>
            </div>
          )) : <span className="crm-hint">ما فيه مستندات.</span>}
          <div className="flex flex-wrap gap-2">
            <input className="crm-input flex-1" value={dn.name} placeholder="اسم المستند (عقد، هوية…)" onChange={(e) => setDn({ ...dn, name: e.target.value })} />
            <input className="crm-input flex-[2]" dir="ltr" value={dn.url} placeholder="https://… رابط الملف (Google Drive مثلاً)" onChange={(e) => setDn({ ...dn, url: e.target.value })} />
            <button type="button" className="crm-btn" onClick={() => { if (dn.url.trim()) { setDocs([...docs, { name: dn.name.trim(), url: dn.url.trim() }]); setDn({ name: "", url: "" }); } }}>+ أضف</button>
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
  const t = (v: string | null | undefined) => { if (!v) return ""; const d = new Date(v); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
  const [d, setD] = useState(date || today());
  const [i, setI] = useState(t(r?.in));
  const [o, setO] = useState(t(r?.out));
  return (
    <ModalFrame title={"حضور " + nameOf(data, uid)} onClose={closeModal} width={440}
      footer={
        <>
          <div className="flex gap-2">
            <button type="button" className="crm-btn primary" onClick={async () => {
              if (!d || !i) return toast("التاريخ ووقت الحضور مطلوبين");
              await saveAttendance(uid, d, i, o, data.uid);
              toast("انحفظ");
              closeModal();
            }}>حفظ</button>
            <button type="button" className="crm-btn" onClick={closeModal}>إلغاء</button>
          </div>
          {date && <ConfirmButton onConfirm={async () => { await deleteAttendance(uid, date); toast("انحذف"); closeModal(); }}>حذف اليوم</ConfirmButton>}
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

