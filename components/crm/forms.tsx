"use client";

/**
 * Add/edit forms for clients, requests, properties, and tasks. Fields,
 * sections, defaults, and save side-effects follow the original artifact
 * CRM (e.g. a new client is saved and then immediately asked for their
 * request; a request for a new phone number creates the client; duplicate
 * phone numbers are refused).
 */
import { useEffect, useMemo, useState } from "react";
import { useCrm } from "@/lib/crm/store";
import {
  CSTATUS, DISTRICTS, FACING, FLOORS, OWNERK, PAY, PRIO, PSTATUS, PTYPES, REQ, SOLD_ST, SOURCES, TEMPS,
} from "@/lib/crm/constants";
import {
  allDistricts, clientById, members, nameOf, propSummary, unitsOf, visibleClients, type CrmData,
} from "@/lib/crm/logic";
import { releaseUnit, remove, write } from "@/lib/crm/actions";
import type { Client, Property, Request, Task, Unit } from "@/lib/crm/types";
import { normPhone, nowStamp, num, splitList, today } from "@/lib/crm/util";
import {
  ConfirmButton, DistrictPicker, Field, ModalFrame, More, MultiCheck, Sec, Select,
} from "./ui";

type F = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));

function useForm<T extends F>(init: T) {
  const [f, setF] = useState<T>(init);
  const set = (k: keyof T, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  return { f, set };
}

function findDup(d: CrmData, phone: string, exceptId?: string | null) {
  const n = normPhone(phone);
  if (!n) return null;
  return d.clients.find((c) => c.id !== exceptId && normPhone(c.phone) === n) || null;
}

function DupHint({ phone, exceptId }: { phone: string; exceptId?: string | null }) {
  const { data, openClient, closeModal } = useCrm();
  const c = findDup(data, phone, exceptId);
  if (!c) return null;
  const mine = data.isMgr || c.assignee === data.uid;
  return (
    <div className="mt-1.5 grid justify-items-start gap-1.5 rounded-lg bg-[var(--crm-warn-soft)] px-2.5 py-2 text-[13px] text-[var(--crm-warn)]">
      <span><b>العميل مسجّل من قبل:</b> {c.name}{c.assignee ? " — عند " + nameOf(data, c.assignee) : " — غير مسند"}</span>
      <span>ما ينفع يتسجّل مرة ثانية.</span>
      {mine && <button type="button" className="crm-btn sm" onClick={() => { closeModal(); openClient(c.id); }}>افتح ملفه</button>}
    </div>
  );
}

function MemberSelect({ value, onChange, lock }: { value: string | null | undefined; onChange: (v: string) => void; lock?: boolean }) {
  const { data } = useCrm();
  return (
    <>
      <select value={value || ""} disabled={lock} onChange={(e) => onChange(e.target.value)}>
        {data.isMgr && <option value="">غير مسند</option>}
        {members(data).map((id) => (
          <option key={id} value={id}>{nameOf(data, id)}{id === data.uid ? " (أنا)" : ""}</option>
        ))}
      </select>
      {lock && <span className="crm-hint">المدير هو اللي يغيّر الإسناد</span>}
    </>
  );
}

/* ====================================================================== */
/* Client                                                                 */
/* ====================================================================== */
export function ClientForm({ id }: { id?: string }) {
  const { data, closeModal, openModal, toast } = useCrm();
  const rec = clientById(data, id);
  const { f, set } = useForm({
    name: s(rec?.name), phone: s(rec?.phone), source: s(rec?.source),
    assignee: rec ? s(rec.assignee) : data.isMgr && data.viewAs && data.viewAs !== "none" ? data.viewAs : data.uid,
    temp: rec?.temp || "دافئ", status: rec?.status || "نشط", nextCall: rec ? s(rec.nextCall) : today(),
    visitAt: s(rec?.visitAt), visitProperty: s(rec?.visitProperty), notes: s(rec?.notes),
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!f.name.trim()) return toast("عبّ خانة: اسم العميل");
    if (f.phone && findDup(data, f.phone, rec?.id)) {
      const dup = findDup(data, f.phone, rec?.id)!;
      return toast("العميل مسجّل من قبل باسم " + dup.name + (dup.assignee ? " عند " + nameOf(data, dup.assignee) : ""));
    }
    setBusy(true);
    try {
      const body: Partial<Client> = {
        name: f.name.trim(), phone: f.phone.trim() || null, source: f.source || null,
        assignee: data.isMgr ? f.assignee || null : rec ? rec.assignee : data.uid,
        temp: f.temp, status: f.status, nextCall: f.nextCall || null,
        visitAt: f.visitAt || null, visitProperty: f.visitProperty || null, notes: f.notes.trim() || null, updatedAt: nowStamp(),
      };
      if (body.assignee && body.assignee !== rec?.assignee) {
        body.assignedAt = nowStamp();
        body.assignedBy = data.uid;
        body.unseen = body.assignee !== data.uid;
      }
      if ((body.visitAt || null) !== (rec?.visitAt || null)) body.visitConfirmed = false;
      if (rec) {
        await write("clients", rec.id, body, "update");
        toast("تم الحفظ");
        closeModal();
      } else {
        const nid = await write("clients", null, { ...body, log: [], createdAt: nowStamp() });
        toast("تم حفظ العميل، الحين سجّل وش يبي");
        openModal({ kind: "request", preset: { clientId: nid, assignee: body.assignee || data.uid, source: body.source || null, _clientName: body.name } });
      }
    } catch {
      toast("تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalFrame title={rec ? "تعديل عميل" : "إضافة عميل"} onClose={closeModal}
      footer={
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="crm-btn primary" disabled={busy} onClick={save}>حفظ</button>
            <button type="button" className="crm-btn" onClick={closeModal}>إلغاء</button>
          </div>
          {rec && data.isMgr && (
            <ConfirmButton onConfirm={async () => { await remove("clients", rec.id); toast("تم الحذف"); closeModal(); }}>حذف</ConfirmButton>
          )}
        </>
      }>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Sec>بيانات العميل</Sec>
        <Field label="اسم العميل *"><input value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus={!rec} /></Field>
        <Field label="الجوال">
          <input value={f.phone} placeholder="05xxxxxxxx" dir="ltr" onChange={(e) => set("phone", e.target.value)} />
          <DupHint phone={f.phone} exceptId={rec?.id} />
        </Field>
        <Field label="المصدر"><Select value={f.source} onChange={(v) => set("source", v)} options={SOURCES} blank="—" /></Field>
        <Field label="المسؤول عن العميل"><MemberSelect value={f.assignee} onChange={(v) => set("assignee", v)} lock={!data.isMgr} /></Field>
        <Sec>المتابعة</Sec>
        <Field label="درجة الاهتمام"><Select value={f.temp} onChange={(v) => set("temp", v)} options={TEMPS} /></Field>
        <Field label="الحالة"><Select value={f.status} onChange={(v) => set("status", v)} options={CSTATUS} /></Field>
        <Field label="موعد الاتصال القادم"><input type="date" value={f.nextCall} onChange={(e) => set("nextCall", e.target.value)} /></Field>
        <Field label="موعد الزيارة (اختياري)" hint="يذكّرك قبلها بيوم عشان تأكد مع العميل">
          <input type="datetime-local" value={f.visitAt} onChange={(e) => set("visitAt", e.target.value)} />
        </Field>
        <Field label="العقار اللي بيزوره"><Select value={f.visitProperty} onChange={(v) => set("visitProperty", v)} options={data.props.map((p) => [p.id, p.title] as [string, string])} blank="—" /></Field>
        <Field label="ملاحظات عن العميل" full hint="وش يبي العميل (نوع العقار، الحي، الميزانية…) ينكتب في طلب العميل.">
          <textarea rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </form>
    </ModalFrame>
  );
}

/* ====================================================================== */
/* Request                                                                */
/* ====================================================================== */
export function RequestForm({ id, preset }: { id?: string; preset?: Partial<Request> & { _clientName?: string } }) {
  const { data, closeModal, toast } = useCrm();
  const rec = id ? data.requests.find((r) => r.id === id) : undefined;
  const base: Partial<Request> = rec || preset || {};
  const presetClient = clientById(data, base.clientId);
  const { f, set } = useForm({
    clientId: s(base.clientId), newName: "", newPhone: "",
    purpose: base.purpose || presetClient?.purpose || "شراء",
    budget: s(base.budget ?? presetClient?.budget),
    propTypes: (base.propTypes || presetClient?.propTypes || []) as string[],
    districts: splitList(base.districts ?? presetClient?.districts),
    payment: s(base.payment ?? presetClient?.payment), priority: base.priority || "عادية",
    requirements: s(base.requirements), areaMin: s(base.areaMin), bedroomsMin: s(base.bedroomsMin), bank: s(base.bank),
    source: s(base.source), floors: (base.floors || []) as string[], notes: s(base.notes),
    status: base.status || "جديد", assignee: s(base.assignee ?? data.uid),
    propertyId: s(base.propertyId), unit: s(base.unit), price: s(base.price), commissionPct: s(base.commissionPct ?? 2.5),
  });
  const [busy, setBusy] = useState(false);
  const dists = useMemo(() => allDistricts(data, DISTRICTS), [data]);
  const clientOpts = visibleClients(data).map((c) => [c.id, c.name] as [string, string]);
  if (base.clientId && !clientOpts.some(([v]) => v === base.clientId))
    clientOpts.unshift([base.clientId, presetClient?.name || preset?._clientName || "العميل"]);

  async function save() {
    setBusy(true);
    try {
      const demand = {
        purpose: f.purpose, propTypes: f.propTypes, districts: f.districts.join("، ") || null, budget: num(f.budget),
        payment: f.payment || null, bank: f.bank || null, areaMin: num(f.areaMin), bedroomsMin: num(f.bedroomsMin),
        floors: f.floors, requirements: f.requirements.trim() || null,
      };
      const body: Partial<Request> = {
        ...demand, clientId: f.clientId, priority: f.priority, source: f.source || null, notes: f.notes.trim() || null,
        status: f.status || "جديد", assignee: data.isMgr ? f.assignee || null : rec ? rec.assignee : data.uid,
        propertyId: f.propertyId || null, unit: f.unit || null, price: num(f.price), commissionPct: num(f.commissionPct) ?? 2.5,
        updatedAt: nowStamp(),
      };
      if (rec && body.assignee !== rec.assignee && body.clientId) {
        const cc = clientById(data, body.clientId);
        if (cc && cc.assignee !== body.assignee)
          await write("clients", cc.id, { assignee: body.assignee || null, assignedAt: nowStamp(), assignedBy: data.uid, unseen: !!body.assignee && body.assignee !== data.uid, updatedAt: nowStamp() }, "update");
      }
      if (rec && SOLD_ST.includes(rec.status) && !SOLD_ST.includes(body.status!)) {
        body.depositAt = null;
        body.closedAt = null;
        if (rec.propertyId) await releaseUnit(data, rec.propertyId, rec.unit);
      }
      if (body.status === "عربون" && !rec?.depositAt) body.depositAt = nowStamp();
      if (body.status === "تم البيع" && !rec?.closedAt) {
        body.closedAt = nowStamp();
        if (!rec?.depositAt) body.depositAt = body.closedAt;
      }
      if (!body.clientId) {
        if (!f.newName.trim()) return toast("اختر عميل موجود أو اكتب اسم عميل جديد");
        const dup = f.newPhone && findDup(data, f.newPhone);
        if (dup) return toast("العميل مسجّل من قبل باسم " + dup.name + (dup.assignee ? " عند " + nameOf(data, dup.assignee) : ""));
        body.clientId = await write("clients", null, {
          name: f.newName.trim(), phone: f.newPhone.trim() || null, temp: f.priority === "عاجلة" ? "ساخن" : "دافئ", status: "نشط",
          nextCall: today(), log: [], source: body.source || null, assignee: body.assignee || data.uid,
          createdAt: nowStamp(), updatedAt: nowStamp(), ...demand,
        });
      } else if (!rec) {
        await write("clients", body.clientId, { ...demand, updatedAt: nowStamp() }, "update");
      }
      if (rec) await write("requests", rec.id, body, "update");
      else await write("requests", null, { ...body, createdAt: nowStamp() });
      toast("تم الحفظ");
      closeModal();
    } catch {
      toast("تعذّر الحفظ، حاول مرة ثانية");
    } finally {
      setBusy(false);
    }
  }

  const prop = data.props.find((p) => p.id === f.propertyId);
  const us = prop ? unitsOf(prop) : [];
  return (
    <ModalFrame title={rec ? "تعديل طلب" : "إضافة طلب"} onClose={closeModal}
      footer={
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="crm-btn primary" disabled={busy} onClick={save}>حفظ</button>
            <button type="button" className="crm-btn" onClick={closeModal}>إلغاء</button>
          </div>
          {rec && (
            <ConfirmButton onConfirm={async () => {
              await remove("requests", rec.id);
              if (SOLD_ST.includes(rec.status) && rec.propertyId) await releaseUnit(data, rec.propertyId, rec.unit);
              toast("تم الحذف");
              closeModal();
            }}>حذف</ConfirmButton>
          )}
        </>
      }>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
        <Sec>العميل</Sec>
        <Field label="عميل موجود"><Select value={f.clientId} onChange={(v) => set("clientId", v)} options={clientOpts} blank="—" /></Field>
        {!f.clientId && (
          <>
            <Field label="أو عميل جديد: الاسم"><input value={f.newName} placeholder="اكتب الاسم إذا العميل جديد" onChange={(e) => set("newName", e.target.value)} /></Field>
            <Field label="جوال العميل الجديد">
              <input value={f.newPhone} placeholder="05xxxxxxxx" dir="ltr" onChange={(e) => set("newPhone", e.target.value)} />
              <DupHint phone={f.newPhone} />
            </Field>
          </>
        )}
        <Sec>وش يبي؟</Sec>
        <Field label="نوع الطلب"><Select value={f.purpose} onChange={(v) => set("purpose", v)} options={["شراء", "إيجار"]} /></Field>
        <Field label="الميزانية القصوى (ريال)"><input inputMode="decimal" value={f.budget} onChange={(e) => set("budget", e.target.value)} /></Field>
        <Field label="نوع العقار (تقدر تختار أكثر من نوع)" full><MultiCheck options={PTYPES} value={f.propTypes} onChange={(v) => set("propTypes", v)} /></Field>
        <Field label="الأحياء" full><DistrictPicker all={dists} value={f.districts} onChange={(v) => set("districts", v)} /></Field>
        <Field label="طريقة الدفع"><Select value={f.payment} onChange={(v) => set("payment", v)} options={PAY} blank="—" /></Field>
        <Field label="الأولوية"><Select value={f.priority} onChange={(v) => set("priority", v)} options={PRIO} /></Field>
        <Field label="تفاصيل الطلب" full>
          <textarea rows={3} value={f.requirements} placeholder="مثال: يبي واجهة شمالية، قريب من مدارس، جاهز للسكن…" onChange={(e) => set("requirements", e.target.value)} />
        </Field>
        <More title="تفاصيل أدق (اختياري)" open={!!(f.areaMin || f.bedroomsMin || f.bank || f.source || f.floors.length || f.notes)}>
          <Field label="أقل مساحة (م²)"><input inputMode="decimal" value={f.areaMin} onChange={(e) => set("areaMin", e.target.value)} /></Field>
          <Field label="أقل عدد غرف"><input inputMode="decimal" value={f.bedroomsMin} onChange={(e) => set("bedroomsMin", e.target.value)} /></Field>
          <Field label="البنك (إذا تمويل)"><input value={f.bank} onChange={(e) => set("bank", e.target.value)} /></Field>
          <Field label="المصدر"><Select value={f.source} onChange={(v) => set("source", v)} options={SOURCES} blank="—" /></Field>
          <Field label="الدور المطلوب (للدور والشقة)" full><MultiCheck options={FLOORS} value={f.floors} onChange={(v) => set("floors", v)} /></Field>
          <Field label="ملاحظات" full><textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </More>
        <Sec>المرحلة والمسؤول</Sec>
        <Field label="المرحلة"><Select value={f.status} onChange={(v) => set("status", v)} options={REQ} /></Field>
        <Field label="المسؤول"><MemberSelect value={f.assignee} onChange={(v) => set("assignee", v)} lock={!data.isMgr} /></Field>
        <More title="بيانات البيع (عند العربون أو البيع)" open={!!f.propertyId}>
          <Field label="العقار"><Select value={f.propertyId} onChange={(v) => set("propertyId", v)} options={data.props.map((p) => [p.id, p.title] as [string, string])} blank="—" /></Field>
          <Field label="الوحدة">
            {us.length ? <Select value={f.unit} onChange={(v) => set("unit", v)} options={us.map((u) => u.name)} blank="—" /> : <input value={f.unit} onChange={(e) => set("unit", e.target.value)} />}
          </Field>
          <Field label="قيمة البيع (ريال)"><input inputMode="decimal" value={f.price} onChange={(e) => set("price", e.target.value)} /></Field>
          <Field label="السعي %"><input inputMode="decimal" value={f.commissionPct} onChange={(e) => set("commissionPct", e.target.value)} /></Field>
        </More>
      </form>
    </ModalFrame>
  );
}

/* ====================================================================== */
/* Property                                                               */
/* ====================================================================== */
export function PropertyForm({ id }: { id?: string }) {
  const { data, closeModal, toast, openModal } = useCrm();
  const rec = data.props.find((p) => p.id === id);
  const r: Partial<Property> = rec || {};
  const { f, set } = useForm({
    title: s(r.title), type: r.type || "فيلا", purpose: r.purpose || "بيع", price: s(r.price), status: r.status || "متاح",
    district: s(r.district), area: s(r.area), bedrooms: s(r.bedrooms), bathrooms: s(r.bathrooms), floor: s(r.floor),
    priceNote: s(r.priceNote), link: s(r.link), images: (r.images || []).slice(), newImg: "",
    ownerKind: r.ownerKind || "مالك فرد", contactName: s(r.contactName), contactPhone: s(r.contactPhone), commissionNote: s(r.commissionNote),
    waMessage: s(r.waMessage), units: (r.units || []).map((u) => ({ ...u })) as Unit[],
    features: s(r.features), city: r.city || "الرياض", buildArea: s(r.buildArea), livingRooms: s(r.livingRooms), floors: s(r.floors),
    facing: s(r.facing), streetWidth: s(r.streetWidth), age: s(r.age), videoLink: s(r.videoLink), notes: s(r.notes),
  });
  const [busy, setBusy] = useState(false);
  const [waArmed, setWaArmed] = useState(false);
  const dists = useMemo(() => allDistricts(data, DISTRICTS), [data]);

  const setUnit = (i: number, k: keyof Unit, v: string) =>
    set("units", f.units.map((u, j) => (j === i ? { ...u, [k]: ["area", "price", "bedrooms"].includes(k) ? num(v) : v || null } : u)));

  function genWa() {
    if (f.waMessage.trim() && !waArmed) {
      setWaArmed(true);
      return toast("فيه رسالة مكتوبة، اضغط مرة ثانية عشان أستبدلها");
    }
    setWaArmed(false);
    const me = nameOf(data, data.uid);
    const us = f.units.filter((u) => u.name || u.price || u.area);
    set("waMessage",
      "السلام عليكم ورحمة الله" + (me && me !== "أنا" ? "، معك " + me : "") + " من بن سلمه العقارية\n\n" +
      propSummary({ ...f, price: num(f.price), area: num(f.area), bedrooms: num(f.bedrooms), bathrooms: num(f.bathrooms), streetWidth: num(f.streetWidth) } as unknown as Partial<Property>, us.length ? us : null) +
      "\n\nللاستفسار والمعاينة تواصل معنا.");
  }

  async function save() {
    if (!f.title.trim()) return toast("عبّ خانة: اسم العقار");
    setBusy(true);
    try {
      const body: Partial<Property> = {
        title: f.title.trim(), type: f.type, purpose: f.purpose, price: num(f.price), status: f.status, district: f.district.trim() || null,
        area: num(f.area), bedrooms: num(f.bedrooms), bathrooms: num(f.bathrooms), floor: f.floor || null, priceNote: f.priceNote || null,
        link: f.link.trim() || null, images: f.images, ownerKind: f.ownerKind, contactName: f.contactName.trim() || null,
        contactPhone: f.contactPhone.trim() || null, commissionNote: f.commissionNote.trim() || null, waMessage: f.waMessage.trim() || null,
        units: f.units.filter((u) => u.name || u.area || u.price).map((u, i) => ({ ...u, name: u.name || "وحدة " + (i + 1), status: u.status || "متاح" })),
        features: f.features.trim() || null, city: f.city.trim() || null, buildArea: num(f.buildArea), livingRooms: num(f.livingRooms),
        floors: num(f.floors), facing: f.facing || null, streetWidth: num(f.streetWidth), age: f.age.trim() || null,
        videoLink: f.videoLink.trim() || null, notes: f.notes.trim() || null, updatedAt: nowStamp(),
      };
      if (rec) await write("properties", rec.id, body, "update");
      else await write("properties", null, { ...body, createdAt: nowStamp() });
      toast("تم الحفظ");
      closeModal();
    } catch {
      toast("تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalFrame title={rec ? "تعديل عقار" : "إضافة عقار"} onClose={closeModal}
      footer={
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="crm-btn primary" disabled={busy} onClick={save}>حفظ</button>
            <button type="button" className="crm-btn" onClick={closeModal}>إلغاء</button>
            {rec && <button type="button" className="crm-btn" onClick={() => openModal({ kind: "propReqs", propId: rec.id })}>العملاء المناسبين</button>}
          </div>
          {rec && <ConfirmButton onConfirm={async () => { await remove("properties", rec.id); toast("تم الحذف"); closeModal(); }}>حذف</ConfirmButton>}
        </>
      }>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
        <Sec>العقار</Sec>
        <Field label="اسم العقار *" full><input value={f.title} placeholder="فيلا 250م النرجس" onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="النوع"><Select value={f.type} onChange={(v) => set("type", v)} options={PTYPES} /></Field>
        <Field label="للـ"><Select value={f.purpose} onChange={(v) => set("purpose", v)} options={["بيع", "إيجار"]} /></Field>
        <Field label="السعر (ريال)"><input inputMode="decimal" value={f.price} onChange={(e) => set("price", e.target.value)} /></Field>
        <Field label="الحالة"><Select value={f.status} onChange={(v) => set("status", v)} options={PSTATUS} /></Field>
        <Field label="الحي">
          <input list="crm-districts" value={f.district} placeholder="ابحث عن الحي…" onChange={(e) => set("district", e.target.value)} />
          <datalist id="crm-districts">{dists.map((d) => <option key={d} value={d} />)}</datalist>
        </Field>
        <Field label="المساحة (م²)"><input inputMode="decimal" value={f.area} onChange={(e) => set("area", e.target.value)} /></Field>
        <Field label="غرف النوم"><input inputMode="decimal" value={f.bedrooms} onChange={(e) => set("bedrooms", e.target.value)} /></Field>
        <Field label="دورات المياه"><input inputMode="decimal" value={f.bathrooms} onChange={(e) => set("bathrooms", e.target.value)} /></Field>
        <Field label="الدور (للدور والشقة)"><Select value={f.floor} onChange={(v) => set("floor", v)} options={FLOORS} blank="—" /></Field>
        <Field label="السعر"><Select value={f.priceNote} onChange={(v) => set("priceNote", v)} options={["قابل للتفاوض", "نهائي"]} blank="—" /></Field>
        <Field label="رابط الموقع (خرائط)" full><input dir="ltr" value={f.link} placeholder="https://maps.app.goo.gl/…" onChange={(e) => set("link", e.target.value)} /></Field>

        <Sec>الصور</Sec>
        <div className="grid gap-2 sm:col-span-2">
          {f.images.length > 0 && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
              {f.images.map((u, i) => (
                <figure key={u + i} className="m-0 overflow-hidden rounded-xl border border-[var(--crm-line)] bg-[var(--crm-surface-2)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt={"صورة " + (i + 1)} className="block aspect-[4/3] w-full object-cover" />
                  <figcaption className="flex items-center justify-between gap-1 p-1">
                    {i === 0 ? <span className="crm-pill tone-accent">الغلاف</span> : (
                      <button type="button" className="crm-btn ghost sm !px-1.5 !text-xs" onClick={() => set("images", [u, ...f.images.filter((_, j) => j !== i)])}>اجعلها الغلاف</button>
                    )}
                    <button type="button" className="crm-btn ghost sm !px-1.5 !text-xs" onClick={() => set("images", f.images.filter((_, j) => j !== i))}>حذف</button>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input className="crm-input flex-1" dir="ltr" value={f.newImg} placeholder="https://… رابط الصورة" onChange={(e) => set("newImg", e.target.value)} />
            <button type="button" className="crm-btn" onClick={() => { if (f.newImg.trim()) { set("images", [...f.images, f.newImg.trim()]); set("newImg", ""); } }}>+ أضف صورة</button>
          </div>
          <span className="crm-hint">الصورة الأولى هي الغلاف. الصور بالروابط لين يتفعّل تخزين الصور في Firebase.</span>
        </div>

        <Sec>المسؤول عن العقار</Sec>
        <Field label="نوع المعلن"><Select value={f.ownerKind} onChange={(v) => set("ownerKind", v)} options={OWNERK} /></Field>
        <Field label="اسم المسؤول"><input value={f.contactName} onChange={(e) => set("contactName", e.target.value)} /></Field>
        <Field label="جوال المسؤول"><input dir="ltr" value={f.contactPhone} placeholder="05xxxxxxxx" onChange={(e) => set("contactPhone", e.target.value)} /></Field>
        <Field label="السعي / الاتفاق"><input value={f.commissionNote} placeholder="2.5% على المشتري" onChange={(e) => set("commissionNote", e.target.value)} /></Field>

        <Sec>رسالة الواتساب الجاهزة</Sec>
        <Field full label="الرسالة اللي ينسخها الموظف ويرسلها للعميل (حط فيها التفاصيل والموقع)"
          hint={<button type="button" className="crm-btn sm" onClick={genWa}>اكتبها لي تلقائي من بيانات العقار</button>}>
          <textarea rows={8} value={f.waMessage} onChange={(e) => set("waMessage", e.target.value)}
            placeholder={"السلام عليكم، معك … من بن سلمه العقارية\nفيلا للبيع في حي النرجس…\nالموقع: https://maps.app.goo.gl/…"} />
        </Field>

        <More title="الوحدات (إذا كان مشروع)" open={f.units.length > 0}>
          <div className="sm:col-span-2">
            {f.units.length ? (
              <div className="overflow-x-auto">
                <table className="crm-table min-w-[700px]">
                  <thead><tr><th>الوحدة</th><th>النوع</th><th>المساحة م²</th><th>السعر</th><th>الغرف</th><th>الدور</th><th>الحالة</th><th /></tr></thead>
                  <tbody>
                    {f.units.map((u, i) => (
                      <tr key={i}>
                        <td><input value={s(u.name)} placeholder={"وحدة " + (i + 1)} onChange={(e) => setUnit(i, "name", e.target.value)} /></td>
                        <td><Select value={u.type} onChange={(v) => setUnit(i, "type", v)} options={PTYPES} blank="نفس المشروع" /></td>
                        <td><input inputMode="decimal" value={s(u.area)} onChange={(e) => setUnit(i, "area", e.target.value)} /></td>
                        <td><input inputMode="decimal" value={s(u.price)} onChange={(e) => setUnit(i, "price", e.target.value)} /></td>
                        <td><input inputMode="decimal" value={s(u.bedrooms)} onChange={(e) => setUnit(i, "bedrooms", e.target.value)} /></td>
                        <td><Select value={u.floor} onChange={(v) => setUnit(i, "floor", v)} options={FLOORS} blank="—" /></td>
                        <td><Select value={u.status || "متاح"} onChange={(v) => setUnit(i, "status", v)} options={PSTATUS} /></td>
                        <td><button type="button" className="crm-btn ghost sm" onClick={() => set("units", f.units.filter((_, j) => j !== i))}>حذف</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="crm-hint m-0 mb-1.5">إذا العقار وحدة وحدة، اترك هذا القسم فاضي. إذا مشروع، أضف كل وحدة بمساحتها وسعرها.</p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button type="button" className="crm-btn sm" onClick={() => set("units", [...f.units, { name: "", status: "متاح" }])}>+ أضف وحدة</button>
              {f.units.length > 0 && <button type="button" className="crm-btn sm" onClick={() => set("units", [...f.units, { ...f.units[f.units.length - 1], name: "" }])}>+ كرر آخر وحدة</button>}
            </div>
          </div>
        </More>
        <More title="تفاصيل إضافية" open={!!(f.features || f.buildArea || f.facing || f.streetWidth || f.age || f.videoLink || f.notes)}>
          <Field label="المميزات" full><textarea rows={2} value={f.features} placeholder="مسبح، مصعد، ملحق، غرفة سائق، مكيفات راكبة، ضمانات…" onChange={(e) => set("features", e.target.value)} /></Field>
          <Field label="المدينة"><input value={f.city} onChange={(e) => set("city", e.target.value)} /></Field>
          <Field label="مسطح البناء (م²)"><input inputMode="decimal" value={f.buildArea} onChange={(e) => set("buildArea", e.target.value)} /></Field>
          <Field label="الصالات / المجالس"><input inputMode="decimal" value={f.livingRooms} onChange={(e) => set("livingRooms", e.target.value)} /></Field>
          <Field label="عدد الأدوار في المبنى"><input inputMode="decimal" value={f.floors} onChange={(e) => set("floors", e.target.value)} /></Field>
          <Field label="الواجهة"><Select value={f.facing} onChange={(v) => set("facing", v)} options={FACING} blank="—" /></Field>
          <Field label="عرض الشارع (م)"><input inputMode="decimal" value={f.streetWidth} onChange={(e) => set("streetWidth", e.target.value)} /></Field>
          <Field label="عمر العقار"><input value={f.age} placeholder="جديد / 3 سنوات" onChange={(e) => set("age", e.target.value)} /></Field>
          <Field label="رابط مقطع / إعلان" full><input dir="ltr" value={f.videoLink} placeholder="https://" onChange={(e) => set("videoLink", e.target.value)} /></Field>
          <Field label="ملاحظات" full><textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </More>
      </form>
    </ModalFrame>
  );
}

/* ====================================================================== */
/* Task                                                                   */
/* ====================================================================== */
export function TaskForm({ id, preset }: { id?: string; preset?: Partial<Task> }) {
  const { data, closeModal, toast } = useCrm();
  const rec = data.tasks.find((t) => t.id === id);
  const b: Partial<Task> = rec || preset || {};
  const { f, set } = useForm({
    title: s(b.title), assignee: s(b.assignee ?? data.uid), due: rec ? s(rec.due) : s(b.due) || today(),
    priority: b.priority || "عادية", clientId: s(b.clientId), propertyId: s(b.propertyId), notes: s(b.notes),
  });
  const [busy, setBusy] = useState(false);
  // Opening a task assigned to me marks it seen.
  const unseenMine = !!rec && rec.seen === false && rec.assignee === data.uid;
  useEffect(() => {
    if (unseenMine && rec) write("tasks", rec.id, { seen: true }, "update").catch(() => {});
  }, [unseenMine, rec]);

  async function save() {
    if (!f.title.trim()) return toast("عبّ خانة: المهمة");
    setBusy(true);
    try {
      const body: Partial<Task> = {
        title: f.title.trim(), assignee: f.assignee || data.uid, due: f.due || null, priority: f.priority,
        clientId: f.clientId || null, propertyId: f.propertyId || null, notes: f.notes.trim() || null, updatedAt: nowStamp(),
      };
      if (rec) {
        if (body.assignee !== rec.assignee) body.seen = body.assignee === data.uid;
        await write("tasks", rec.id, body, "update");
      } else {
        await write("tasks", null, { ...body, done: false, createdBy: data.uid, seen: body.assignee === data.uid, createdAt: nowStamp() });
      }
      toast("تم الحفظ");
      closeModal();
    } catch {
      toast("تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalFrame title={rec ? "تعديل مهمة" : "إضافة مهمة"} onClose={closeModal} width={620}
      footer={
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="crm-btn primary" disabled={busy} onClick={save}>حفظ</button>
            <button type="button" className="crm-btn" onClick={closeModal}>إلغاء</button>
          </div>
          {rec && <ConfirmButton onConfirm={async () => { await remove("tasks", rec.id); toast("تم الحذف"); closeModal(); }}>حذف</ConfirmButton>}
        </>
      }>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Field label="المهمة *" full><input value={f.title} autoFocus={!rec} placeholder="مثال: رتّب معاينة فيلا النرجس مع أنس" onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="لمين؟"><MemberSelect value={f.assignee} onChange={(v) => set("assignee", v)} /></Field>
        <Field label="التاريخ"><input type="date" value={f.due} onChange={(e) => set("due", e.target.value)} /></Field>
        <Field label="الأولوية"><Select value={f.priority} onChange={(v) => set("priority", v)} options={PRIO} /></Field>
        <Field label="العميل (اختياري)"><Select value={f.clientId} onChange={(v) => set("clientId", v)} options={visibleClients(data).map((c) => [c.id, c.name] as [string, string])} blank="—" /></Field>
        <Field label="العقار (اختياري)"><Select value={f.propertyId} onChange={(v) => set("propertyId", v)} options={data.props.map((p) => [p.id, p.title] as [string, string])} blank="—" /></Field>
        <Field label="تفاصيل" full><textarea rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      </form>
    </ModalFrame>
  );
}
