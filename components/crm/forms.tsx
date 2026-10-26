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
  CSTATUS, DISTRICTS, FACING, FLOORS, OWNERK, PAY, PRIO, PSTATUS, REQ, SOLD_ST, TEMPS, TO_CONTACT, lbl } from "@/lib/crm/constants";
import {
  allDistricts, clientById, members, nameOf, OPEN_REQ, propSummary, unitsOf, visibleClients, type CrmData, can } from "@/lib/crm/logic";
import { toggleTask, assignClient, createClient, deleteClient, isPhoneTaken, nextAssignee, PHONE_TAKEN, releaseUnit, remove, updateClient, write, writeProperty } from "@/lib/crm/actions";
import type { Client, Property, Request, Task, Unit } from "@/lib/crm/types";
import { fmtStamp, normPhone, nowStamp, num, splitList, today } from "@/lib/crm/util";
import {
  ConfirmButton, DistrictPicker, Field, ModalFrame, More, MultiCheck, Pill, Sec, Select,
} from "./ui";
import { WaPicker } from "./WaPicker";
import { uploadOfferImage } from "@/lib/upload-image";
import { downloadAllImages } from "./downloadImages";
import { activateOnSite } from "@/lib/crm/offer-from-property";
import { listOffers } from "@/lib/offers";
import { useAuth } from "@/lib/auth-context";
import type { Offer } from "@/lib/types";
import { RIYADH_ZONES, districtKey, zoneOf } from "@/lib/districts";

type F = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));
/** The floor question only applies to apartments (شقة) and floors (دور). */
const needsFloor = (types: string[]) => types.some((t) => t === "شقة" || t === "دور");
/** Property types offered on a request (client 2026-10-20: keep it short). Stored values stay singular so matching against properties works. */
const REQ_TYPES: [string, string][] = [["أرض", "أرض"], ["فيلا", "فلل"], ["بنتهاوس", "بنتهاوس"], ["تاون هاوس", "تاون هاوس"], ["شقة", "شقق"], ["أخرى", "أخرى"]];
/** Zones of a request: the saved ones, or the zones its saved districts fall in (older requests). */
const zonesFor = (zones: string[] | undefined, districts: string[]) =>
  zones?.length ? zones : Array.from(new Set(districts.map((d) => zoneOf(d)?.ar).filter((z): z is string => !!z)));

function useForm<T extends F>(init: T) {
  const [f, setF] = useState<T>(init);
  const set = (k: keyof T, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  return { f, set, setF };
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
      <span>لا يمكن تسجيله مرة أخرى.</span>
      {mine && <button type="button" className="crm-btn sm" onClick={() => { closeModal(); openClient(c.id); }}>افتح ملفه</button>}
    </div>
  );
}

/** Assignee value meaning "next employee in the round-robin" (resolved on save). */
const AUTO = "__auto";

function MemberSelect({ value, onChange, lock, auto, owner }: { value: string | null | undefined; onChange: (v: string) => void; lock?: boolean; auto?: boolean; owner?: string | null }) {
  const { data } = useCrm();
  const order = data.rr.order.filter((id) => data.staff.some((s) => s.id === id && s.active));
  const upNext = order.length ? order[((data.rr.last ? order.indexOf(data.rr.last) : -1) + 1) % order.length] : null;
  return (
    <>
      <select value={value || ""} disabled={lock} onChange={(e) => onChange(e.target.value)}>
        {auto && owner && <option value={AUTO}>مسؤول العميل: {nameOf(data, owner)}</option>}
        {auto && !owner && <option value={AUTO}>{upNext ? "تلقائي بالدور (التالي: " + nameOf(data, upNext) + ")" : "تلقائي بالدور"}</option>}
        {data.isMgr && <option value="">غير مسند</option>}
        {members(data).map((id) => (
          <option key={id} value={id}>{nameOf(data, id)}{id === data.uid ? " (أنا)" : ""}</option>
        ))}
      </select>
      {lock && <span className="crm-hint">تغيير الإسناد من صلاحية المدير</span>}
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
    temp: rec?.temp || "", status: rec?.status || "نشط", nextCall: rec ? s(rec.nextCall) : today(),
    visitAt: s(rec?.visitAt), visitProperty: s(rec?.visitProperty), notes: s(rec?.notes),
  });
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!f.name.trim()) return toast("يرجى تعبئة حقل: اسم العميل");
    if (f.phone && findDup(data, f.phone, rec?.id)) {
      const dup = findDup(data, f.phone, rec?.id)!;
      return toast("العميل مسجّل من قبل باسم " + dup.name + (dup.assignee ? " عند " + nameOf(data, dup.assignee) : ""));
    }
    setBusy(true);
    try {
      const body: Partial<Client> = {
        name: f.name.trim(), phone: f.phone.trim() || null, source: f.source || null,
        assignee: data.isMgr ? f.assignee || null : rec ? rec.assignee : data.uid,
        temp: f.temp || null, status: f.status, nextCall: f.nextCall || null,
        visitAt: f.visitAt || null, visitProperty: f.visitProperty || null, notes: f.notes.trim() || null, updatedAt: nowStamp(),
      };
      if (body.assignee && body.assignee !== rec?.assignee) {
        body.assignedAt = nowStamp();
        body.assignedBy = data.uid;
        body.unseen = body.assignee !== data.uid;
      }
      if ((body.visitAt || null) !== (rec?.visitAt || null)) body.visitConfirmed = false;
      if (rec) {
        await updateClient(rec, body as Record<string, unknown>);
        toast("تم الحفظ");
        closeModal();
      } else {
        const nid = await createClient({ ...body, log: [], createdAt: nowStamp() });
        toast("تم حفظ العميل، يرجى الآن تسجيل طلبه");
        openModal({ kind: "request", preset: { clientId: nid, assignee: body.assignee || data.uid, source: body.source || null, _clientName: body.name } });
      }
    } catch (e) {
      toast(isPhoneTaken(e) ? PHONE_TAKEN : "تعذّر الحفظ");
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
            <ConfirmButton onConfirm={async () => { await deleteClient(data, rec); toast("تم حذف العميل وطلباته"); closeModal(); }}>حذف{data.requests.some((r) => r.clientId === rec.id) ? " مع طلباته" : ""}</ConfirmButton>
          )}
        </>
      }>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <Sec>بيانات العميل</Sec>
        {!rec && (
          <WaPicker onPick={(c) => {
            if (c.name) set("name", c.name);
            set("phone", c.phone);
            if (!f.source && data.sources.includes("واتساب")) set("source", "واتساب");
            if (!f.notes.trim() && c.last) set("notes", "آخر رسالة على واتساب: " + c.last);
          }} />
        )}
        <Field label="اسم العميل *"><input value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus={!rec} /></Field>
        <Field label="الجوال">
          <input value={f.phone} placeholder="05xxxxxxxx" dir="ltr" onChange={(e) => set("phone", e.target.value)} />
          <DupHint phone={f.phone} exceptId={rec?.id} />
        </Field>
        <Field label="المصدر"><Select value={f.source} onChange={(v) => set("source", v)} options={withCurrent(data.sources, [f.source])} blank="—" /></Field>
        <Field label="المسؤول عن العميل"><MemberSelect value={f.assignee} onChange={(v) => set("assignee", v)} lock={!data.isMgr} /></Field>
        <Sec>المتابعة</Sec>
        <Field label="درجة الاهتمام"><Select value={f.temp} onChange={(v) => set("temp", v)} options={TEMPS} blank="لم يُحدد" /></Field>
        <Field label="الحالة"><Select value={f.status} onChange={(v) => set("status", v)} options={CSTATUS} /></Field>
        <Field label="موعد الاتصال القادم"><input type="date" value={f.nextCall} onChange={(e) => set("nextCall", e.target.value)} /></Field>
        <Field label="ملاحظات عن العميل" full hint="متطلبات العميل (نوع العقار، الحي، الميزانية…) تُسجَّل في طلبه.">
          <textarea rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </form>
    </ModalFrame>
  );
}

/** The editable type list plus any value a record already has, so a type removed later still shows on old records. */
const withCurrent = (list: string[], cur: (string | null | undefined)[]) =>
  [...list, ...cur.filter((x): x is string => !!x && !list.includes(x))];

/* ====================================================================== */
/* Request                                                                */
/* ====================================================================== */
export function RequestForm({ id, preset }: { id?: string; preset?: Partial<Request> & { _clientName?: string; _newName?: string; _newPhone?: string } }) {
  const { data, closeModal, openModal, toast } = useCrm();
  const rec = id ? data.requests.find((r) => r.id === id) : undefined;
  const base: Partial<Request> = rec || preset || {};
  const presetClient = clientById(data, base.clientId);
  const { f, set } = useForm({
    clientId: s(base.clientId), newName: s(preset?._newName), newPhone: s(preset?._newPhone),
    purpose: base.purpose || presetClient?.purpose || "شراء",
    budget: s(base.budget ?? presetClient?.budget),
    propTypes: (base.propTypes || presetClient?.propTypes || []) as string[],
    districts: splitList(base.districts ?? presetClient?.districts),
    zones: zonesFor(base.zones ?? presetClient?.zones, splitList(base.districts ?? presetClient?.districts)),
    payment: s(base.payment ?? presetClient?.payment), priority: base.priority || "عادية",
    // The client's interest level (ساخن/دافئ/بارد) lives on the client; set here too so it is at hand with the request.
    temp: s(presetClient?.temp || ""),
    requirements: s(base.requirements), areaMin: s(base.areaMin), bedroomsMin: s(base.bedroomsMin), bank: s(base.bank),
    source: s(base.source), floors: (base.floors || []) as string[], notes: s(base.notes), clientName: "",
    status: base.status || "جديد", assignee: s(base.assignee ?? (!rec && presetClient?.assignee ? presetClient.assignee : !rec && data.isMgr ? AUTO : data.uid)),
    propertyId: s(base.propertyId), unit: s(base.unit), price: s(base.price), commissionPct: s(base.commissionPct ?? 2.5),
  });
  const [busy, setBusy] = useState(false);
  const dists = useMemo(() => allDistricts(data, DISTRICTS), [data]);
  // Districts offered are those of the chosen zones (any district can still be typed in).
  const zoneDists = useMemo(() => {
    const zs = RIYADH_ZONES.filter((z) => f.zones.includes(z.ar));
    return dists.filter((d) => zs.some((z) => z.districts.includes(districtKey(d))));
  }, [dists, f.zones]);
  // The chosen client's active owner, if any: a new request follows it (one client, one employee).
  const ownerNow = !rec && f.clientId ? (() => { const a = clientById(data, f.clientId)?.assignee; return a && data.staff.some((x) => x.id === a && x.active) ? a : null; })() : null;
  // A client saved from a bare number has the number as their name: ask for the real name here.
  const selClient = f.clientId ? clientById(data, f.clientId) : null;
  const nameless = !!selClient && /^[\d\s+()-]+$/.test((selClient.name || "").trim());
  const clientOpts = visibleClients(data).map((c) => [c.id, c.name] as [string, string]);
  if (base.clientId && !clientOpts.some(([v]) => v === base.clientId))
    clientOpts.unshift([base.clientId, presetClient?.name || preset?._clientName || "العميل"]);

  async function save() {
    // One open request per customer (client 2026-10-24): a second one is not created — the current one is edited instead.
    if (!rec && f.clientId) {
      const ex = data.requests.find((r) => r.clientId === f.clientId && OPEN_REQ(r));
      if (ex) { toast("لهذا العميل طلب قائم — عدّل طلبه الحالي بدل إضافة طلب جديد"); return openModal({ kind: "request", id: ex.id }); }
    }
    if (nameless && !f.clientName.trim()) return toast("اكتب اسم العميل — محفوظ بالرقم فقط");
    if (!f.zones.length) return toast("اختر الجهة (شمال، شرق، غرب، جنوب أو وسط الرياض)");
    // Every chosen zone needs at least one district in it (client 2026-10-24).
    const noDist = f.zones.filter((z) => !f.districts.some((d) => zoneOf(d)?.ar === z));
    if (noDist.length) return toast("حدّد حيّاً واحداً على الأقل في: " + noDist.join("، "));
    setBusy(true);
    try {
      // One client, one employee: a new request for an existing client follows the client's active owner — the
      // automatic rotation is for clients without one (and then does not use up a turn).
      const owner0 = !rec && f.clientId ? clientById(data, f.clientId)?.assignee || null : null;
      const owner = owner0 && data.staff.some((x) => x.id === owner0 && x.active) ? owner0 : null;
      const autoTo = data.isMgr && f.assignee === AUTO && !owner ? await nextAssignee(data) : null;
      let pick = data.isMgr ? (f.assignee === AUTO ? owner || autoTo || data.uid || null : f.assignee || null) : rec ? rec.assignee : data.uid;
      // Choosing someone else for an existing client's new request moves the client (and their open requests) too — ask first.
      let moveClient = false;
      if (!rec && owner && data.isMgr && pick && pick !== owner) {
        if (window.confirm("هذا العميل عند " + nameOf(data, owner) + ". هل تحوّله مع كل طلباته القائمة إلى " + nameOf(data, pick) + "؟\n(إلغاء = يبقى الطلب عند " + nameOf(data, owner) + ")")) moveClient = true;
        else pick = owner;
      }
      const demand = {
        purpose: f.purpose, propTypes: f.propTypes, zones: f.zones, districts: f.districts.join("، ") || null, budget: num(f.budget),
        payment: f.payment || null, bank: f.bank || null, areaMin: num(f.areaMin), bedroomsMin: num(f.bedroomsMin),
        floors: needsFloor(f.propTypes) ? f.floors : [], requirements: f.requirements.trim() || null,
      };
      const body: Partial<Request> = {
        ...demand, clientId: f.clientId, priority: f.priority, source: f.source || null, notes: f.notes.trim() || null,
        status: f.status || "جديد", assignee: pick,
        propertyId: f.propertyId || null, unit: f.unit || null, price: num(f.price), commissionPct: num(f.commissionPct) ?? 2.5,
        updatedAt: nowStamp(),
      };
      // Reassigning from the edit form moves the client and their other open requests too (one owner per client).
      if (rec && body.assignee !== rec.assignee && body.clientId) await assignClient(data, body.clientId, body.assignee || null, rec.id);
      if (rec && SOLD_ST.includes(rec.status) && !SOLD_ST.includes(body.status!)) {
        body.depositAt = null;
        body.closedAt = null;
        body.deposit = null;
        body.depositBy = null;
        body.closedBy = null;
        if (rec.propertyId) await releaseUnit(data, rec.propertyId, rec.unit);
      }
      // A new deposit/sale goes through the deposit form (amount, property, unit reserved) after saving the rest.
      const closeTo = SOLD_ST.includes(body.status!) && rec?.status !== body.status ? body.status! : null;
      if (closeTo) body.status = rec ? rec.status : "تفاوض";
      if (body.status === "عربون" && !rec?.depositAt) body.depositAt = nowStamp();
      if (body.status === "تم البيع" && !rec?.closedAt) {
        body.closedAt = nowStamp();
        if (!rec?.depositAt) body.depositAt = body.closedAt;
      }
      if (!body.clientId) {
        if (!f.newName.trim()) return toast("اختر عميل موجود أو اكتب اسم عميل جديد");
        const dup = f.newPhone && findDup(data, f.newPhone);
        if (dup) return toast("العميل مسجّل من قبل باسم " + dup.name + (dup.assignee ? " عند " + nameOf(data, dup.assignee) : ""));
        body.clientId = await createClient({
          name: f.newName.trim(), phone: f.newPhone.trim() || null, temp: f.temp || null, status: "نشط",
          nextCall: null, log: [], source: body.source || null, assignee: body.assignee || data.uid,
          createdAt: nowStamp(), updatedAt: nowStamp(), ...demand,
        });
      } else if (!rec) {
        const cc = clientById(data, body.clientId);
        // Recording a request for a client from "للتواصل" (or the archive) makes them an active client again.
        const revive = cc && (cc.status === TO_CONTACT || cc.status === "غير مهتم")
          ? { status: "نشط", nextCall: cc.nextCall || null, lastUpdate: "سجّل اهتمام", lastUpdateAt: nowStamp(),
              log: [{ at: nowStamp(), byId: data.uid || null, type: "سجّل اهتمام", text: "تم التواصل وسُجّل طلبه", call: true }, ...(cc.log || [])].slice(0, 80) }
          : {};
        await write("clients", body.clientId, { ...demand, ...revive, temp: f.temp || cc?.temp || null, updatedAt: nowStamp() }, "update");
      } else if (f.temp && f.temp !== clientById(data, body.clientId)?.temp) {
        await write("clients", body.clientId, { temp: f.temp, updatedAt: nowStamp() }, "update");
      }
      if (nameless && body.clientId) await write("clients", body.clientId, { name: f.clientName.trim(), updatedAt: nowStamp() }, "update");
      let reqId = rec?.id;
      if (rec) await write("requests", rec.id, body, "update");
      else {
        reqId = await write("requests", null, { ...body, createdAt: nowStamp() });
        if (moveClient && body.clientId && pick) await assignClient(data, body.clientId, pick, reqId);
      }
      toast(closeTo ? "تم الحفظ — يرجى استكمال بيانات " + (closeTo === "تم البيع" ? "البيع" : "العربون")
        : autoTo ? "تم الحفظ وأُسند تلقائياً إلى " + nameOf(data, autoTo) : owner && !rec && pick === owner ? "تم الحفظ — الطلب عند " + nameOf(data, owner) + " مسؤول العميل" : "تم الحفظ");
      closeModal();
      if (closeTo && reqId) openModal({ kind: "close", reqId, to: closeTo });
    } catch (e) {
      toast(isPhoneTaken(e) ? PHONE_TAKEN : "تعذّر الحفظ، يرجى المحاولة مجدداً");
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
        <Field label="عميل موجود"><Select value={f.clientId} options={clientOpts} blank="—"
          onChange={(v) => {
            set("clientId", v);
            // A manager adding a request for an existing client: the request follows the client's owner by default.
            const own = v ? clientById(data, v)?.assignee : null;
            if (!rec && data.isMgr && own && data.staff.some((x) => x.id === own && x.active)) set("assignee", AUTO);
          }} /></Field>
        {nameless && (
          <Field label="اسم العميل *"><input value={f.clientName} placeholder="الرقم محفوظ بدون اسم — اكتب الاسم" onChange={(e) => set("clientName", e.target.value)} /></Field>
        )}
        {!f.clientId && (
          <>
            <WaPicker onPick={(c) => {
              if (c.name) set("newName", c.name);
              set("newPhone", c.phone);
              if (!f.source && data.sources.includes("واتساب")) set("source", "واتساب");
            }} />
            <Field label="أو عميل جديد: الاسم"><input value={f.newName} placeholder="اكتب الاسم إذا كان العميل جديداً" onChange={(e) => set("newName", e.target.value)} /></Field>
            <Field label="جوال العميل الجديد">
              <input value={f.newPhone} placeholder="05xxxxxxxx" dir="ltr" onChange={(e) => set("newPhone", e.target.value)} />
              <DupHint phone={f.newPhone} />
            </Field>
          </>
        )}
        <Sec>متطلبات العميل</Sec>
        <Field label="نوع الطلب"><Select value={f.purpose} onChange={(v) => set("purpose", v)} options={["شراء", "إيجار"]} /></Field>
        <Field label="الميزانية القصوى (ريال)"><input inputMode="decimal" value={f.budget} onChange={(e) => set("budget", e.target.value)} /></Field>
        <Field label="نوع العقار" full>
          <MultiCheck options={withCurrent(REQ_TYPES.map(([v]) => v), f.propTypes)} labels={Object.fromEntries(REQ_TYPES)} value={f.propTypes} onChange={(v) => set("propTypes", v)} />
        </Field>
        {needsFloor(f.propTypes) && <Field label="الدور المطلوب" full><MultiCheck options={FLOORS} value={f.floors} onChange={(v) => set("floors", v)} /></Field>}
        <Field label="الجهة *" full>
          <MultiCheck options={RIYADH_ZONES.map((z) => z.ar)} value={f.zones} onChange={(v) => {
            set("zones", v);
            // Drop districts that no longer belong to a chosen zone (typed-in districts outside the list stay).
            set("districts", f.districts.filter((d) => { const z = zoneOf(d); return !z || v.includes(z.ar); }));
          }} />
        </Field>
        <Field label="الأحياء" full>
          {f.zones.length ? <DistrictPicker all={zoneDists} value={f.districts} onChange={(v) => set("districts", v)} />
            : <span className="crm-hint">اختر الجهة أولاً لتظهر أحياؤها</span>}
        </Field>
        <Field label="طريقة الدفع"><Select value={f.payment} onChange={(v) => set("payment", v)} options={PAY} blank="—" /></Field>
        <Field label="الأولوية"><Select value={f.priority} onChange={(v) => set("priority", v)} options={PRIO} /></Field>
        <Field label="درجة اهتمام العميل"><Select value={f.temp} onChange={(v) => set("temp", v)} options={TEMPS} blank="لم يُحدد" /></Field>
        <Field label="تفاصيل الطلب" full>
          <textarea rows={3} value={f.requirements} placeholder="مثال: واجهة شمالية، قريب من المدارس، جاهز للسكن…" onChange={(e) => set("requirements", e.target.value)} />
        </Field>
        <More title="تفاصيل أدق (اختياري)" open={!!(f.areaMin || f.bedroomsMin || f.bank || f.source || f.notes)}>
          <Field label="أقل مساحة (م²)"><input inputMode="decimal" value={f.areaMin} onChange={(e) => set("areaMin", e.target.value)} /></Field>
          <Field label="أقل عدد غرف"><input inputMode="decimal" value={f.bedroomsMin} onChange={(e) => set("bedroomsMin", e.target.value)} /></Field>
          <Field label="البنك (في حال التمويل)"><input value={f.bank} onChange={(e) => set("bank", e.target.value)} /></Field>
          <Field label="المصدر"><Select value={f.source} onChange={(v) => set("source", v)} options={withCurrent(data.sources, [f.source])} blank="—" /></Field>
          <Field label="ملاحظات" full><textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </More>
        <Sec>المرحلة والمسؤول</Sec>
        <Field label="المرحلة"><Select value={f.status} onChange={(v) => set("status", v)} options={REQ.filter((v) => can(data, "recordDeals") || !SOLD_ST.includes(v) || v === rec?.status).map((v) => [v, lbl(v)] as [string, string])} /></Field>
        <Field label="المسؤول"><MemberSelect value={f.assignee} onChange={(v) => set("assignee", v)} lock={!data.isMgr} auto={!rec && data.isMgr} owner={ownerNow} /></Field>
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
  const { f, set, setF } = useForm({
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
  const [uploading, setUploading] = useState(0);
  const [zipping, setZipping] = useState(false);
  const { user } = useAuth();
  const [activating, setActivating] = useState(false);
  const [siteOffer, setSiteOffer] = useState<Offer | null>(null);
  useEffect(() => {
    if (!rec || !data.isMgr) return;
    listOffers().then((os) => setSiteOffer(os.find((o) => o.property_id === rec.id) || null)).catch(() => {});
  }, [rec, data.isMgr]);
  // Photos from the phone/computer go to Firebase Storage (offers/…, public read, staff-only write).
  const uploadFiles = async (files: FileList | null) => {
    const list = Array.from(files || []).filter((x) => x.type.startsWith("image/"));
    if (!list.length) return;
    setUploading(list.length);
    const urls: string[] = [];
    for (const file of list) {
      try { urls.push((await uploadOfferImage(file)).url); }
      catch { toast("تعذّر رفع الصورة " + file.name); }
      setUploading((n) => n - 1);
    }
    if (urls.length) setF((p) => ({ ...p, images: [...p.images, ...urls] }));
  };
  const dists = useMemo(() => allDistricts(data, DISTRICTS), [data]);

  const setUnit = (i: number, k: keyof Unit, v: string) =>
    set("units", f.units.map((u, j) => (j === i ? { ...u, [k]: ["area", "price", "bedrooms"].includes(k) ? num(v) : v || null } : u)));

  function genWa() {
    if (f.waMessage.trim() && !waArmed) {
      setWaArmed(true);
      return toast("توجد رسالة مكتوبة، اضغط مرة أخرى لاستبدالها");
    }
    setWaArmed(false);
    const me = nameOf(data, data.uid);
    const us = f.units.filter((u) => u.name || u.price || u.area);
    set("waMessage",
      "السلام عليكم ورحمة الله" + (me && me !== "أنا" ? "، معك " + me : "") + " من بن سلمه العقارية\n\n" +
      propSummary({ ...f, price: num(f.price), area: num(f.area), bedrooms: num(f.bedrooms), bathrooms: num(f.bathrooms), streetWidth: num(f.streetWidth) } as unknown as Partial<Property>, us.length ? us : null) +
      "\n\nللاستفسار والزيارة تواصل معنا.");
  }

  async function save() {
    if (!f.title.trim()) return toast("يرجى تعبئة حقل: اسم العقار");
    setBusy(true);
    try {
      const body: Partial<Property> = {
        title: f.title.trim(), type: f.type, purpose: f.purpose, price: num(f.price), status: f.status, district: f.district.trim() || null,
        area: num(f.area), bedrooms: num(f.bedrooms), bathrooms: num(f.bathrooms), floor: needsFloor([f.type]) && f.floor ? f.floor : null, priceNote: f.priceNote || null,
        link: f.link.trim() || null, images: f.images, ownerKind: f.ownerKind, contactName: f.contactName.trim() || null,
        contactPhone: f.contactPhone.trim() || null, commissionNote: f.commissionNote.trim() || null, waMessage: f.waMessage.trim() || null,
        units: f.units.filter((u) => u.name || u.area || u.price).map((u, i) => ({ ...u, name: u.name || "وحدة " + (i + 1), status: u.status || "متاح" })),
        features: f.features.trim() || null, city: f.city.trim() || null, buildArea: num(f.buildArea), livingRooms: num(f.livingRooms),
        floors: num(f.floors), facing: f.facing || null, streetWidth: num(f.streetWidth), age: f.age.trim() || null,
        videoLink: f.videoLink.trim() || null, notes: f.notes.trim() || null, updatedAt: nowStamp(),
      };
      if (rec) await writeProperty(rec.id, { ...body, updatedBy: data.uid });
      else await write("properties", null, { ...body, createdAt: nowStamp(), createdBy: data.uid, updatedBy: data.uid });
      toast("تم الحفظ");
      closeModal();
    } catch {
      toast("تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalFrame title={rec ? "تعديل عقار" + (rec.ref ? " #" + rec.ref : "") : "إضافة عقار"} onClose={closeModal}
      footer={
        <>
          <div className="flex flex-wrap gap-2">
            {can(data, "manageProps") ? <button type="button" className="crm-btn primary" disabled={busy} onClick={save}>حفظ</button>
              : <span className="crm-hint self-center">للاطلاع فقط — لا تملك صلاحية تعديل العقارات</span>}
            <button type="button" className="crm-btn" onClick={closeModal}>إغلاق</button>
            {rec && <button type="button" className="crm-btn" onClick={() => openModal({ kind: "propReqs", propId: rec.id })}>العملاء المناسبون</button>}
          </div>
          {rec && can(data, "manageProps") && <ConfirmButton onConfirm={async () => { await remove("properties", rec.id); toast("تم الحذف"); closeModal(); }}>حذف</ConfirmButton>}
        </>
      }>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
        {rec && (
          <p className="crm-hint m-0 sm:col-span-2">
            أضافه: <b>{rec.createdBy ? nameOf(data, rec.createdBy) : "غير مسجّل"}</b>
            {rec.createdAt && <> · <span className="num">{fmtStamp(rec.createdAt)}</span></>}
            {rec.updatedBy && rec.updatedBy !== rec.createdBy && <> — آخر تعديل: <b>{nameOf(data, rec.updatedBy)}</b>{rec.updatedAt && <> · <span className="num">{fmtStamp(rec.updatedAt)}</span></>}</>}
          </p>
        )}
        <Sec>العقار</Sec>
        <Field label="اسم العقار *" full><input value={f.title} placeholder="فيلا 250م النرجس" onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="النوع"><Select value={f.type} onChange={(v) => set("type", v)} options={withCurrent(data.propTypes, [f.type])} /></Field>
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
        {needsFloor([f.type]) && <Field label="الدور"><Select value={f.floor} onChange={(v) => set("floor", v)} options={FLOORS} blank="—" /></Field>}
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
          <div className="flex flex-wrap gap-2">
            <label className={"crm-btn primary cursor-pointer" + (uploading ? " pointer-events-none opacity-60" : "")}>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { uploadFiles(e.target.files); e.target.value = ""; }} />
              {uploading ? "جارٍ رفع " + uploading + " صورة…" : "📷 رفع صور"}
            </label>
            <input className="crm-input min-w-[180px] flex-1" dir="ltr" value={f.newImg} placeholder="أو الصق رابط صورة https://…" onChange={(e) => set("newImg", e.target.value)} />
            <button type="button" className="crm-btn" onClick={() => { if (f.newImg.trim()) { set("images", [...f.images, f.newImg.trim()]); set("newImg", ""); } }}>+ إضافة صورة</button>
          </div>
          {f.images.length > 0 && (
            <button type="button" className="crm-btn justify-self-start" disabled={zipping} onClick={async () => {
              setZipping(true);
              try {
                const r = await downloadAllImages(f.images, (rec?.ref ? "#" + rec.ref + " " : "") + (f.title || "صور العقار"));
                toast(r.ok ? "تم تنزيل " + r.ok + " صورة" + (r.failed ? " — تعذّر تنزيل " + r.failed : "") : "تعذّر تنزيل الصور");
              } catch (e) { toast(e instanceof Error ? e.message : "تعذّر تنزيل الصور"); }
              finally { setZipping(false); }
            }}>{zipping ? "جارٍ تجهيز الصور…" : "⬇ تنزيل كل الصور (" + f.images.length + ")"}</button>
          )}
          <span className="crm-hint">ارفع الصور من جهازك أو جوالك (تُصغَّر تلقائياً)، أو الصق رابطاً. الصورة الأولى هي الغلاف، وتنتقل الصور إلى الموقع عند «تفعيل في الموقع».</span>
        </div>

        {rec && data.isMgr && (
          <>
            <Sec>الموقع الإلكتروني</Sec>
            <div className="grid gap-2 sm:col-span-2">
              {siteOffer ? (
                <a className="crm-btn justify-self-start" href={"/ar/admin/offers/" + siteOffer.id + "/edit"} target="_blank" rel="noopener">🌐 {siteOffer.status === "published" ? "معروض في الموقع" : "مسودة في الموقع"} — تعديل إعلان الموقع</a>
              ) : rec.status === "مباع" ? <span className="crm-hint">العقار مباع — لا يُعلن في الموقع.</span> : (
                <button type="button" className="crm-btn primary justify-self-start" disabled={activating} onClick={async () => {
                  if (!user) return;
                  setActivating(true);
                  try {
                    const err = await activateOnSite(rec, user.uid, await user.getIdToken());
                    if (err) toast(err); else { toast("تم تفعيل العقار في الموقع"); listOffers().then((os) => setSiteOffer(os.find((o) => o.property_id === rec.id) || null)).catch(() => {}); }
                  } catch (e) { console.error("activateOnSite", e); toast("تعذّر التفعيل: " + (e instanceof Error ? e.message : String(e))); }
                  finally { setActivating(false); }
                }}>{activating ? "جارٍ التفعيل…" : "🌐 تفعيل في الموقع"}</button>
              )}
              <span className="crm-hint">يُفعَّل بآخر بيانات محفوظة للعقار (احفظ تعديلاتك أولاً). الإعلان نسخة منفصلة: تعدّل فيه الوصف والصور والسعر المعروض بدون ما يتغير العقار في النظام.</span>
            </div>
          </>
        )}

        <Sec>المسؤول عن العقار</Sec>
        <Field label="نوع المعلن"><Select value={f.ownerKind} onChange={(v) => set("ownerKind", v)} options={OWNERK} /></Field>
        <Field label="اسم المعلن (المالك أو المسوق)"><input value={f.contactName} onChange={(e) => set("contactName", e.target.value)} /></Field>
        <Field label="جوال المعلن"><input dir="ltr" value={f.contactPhone} placeholder="05xxxxxxxx" onChange={(e) => set("contactPhone", e.target.value)} /></Field>
        <Field label="السعي / الاتفاق"><input value={f.commissionNote} placeholder="2.5% على المشتري" onChange={(e) => set("commissionNote", e.target.value)} /></Field>

        <Sec>رسالة الواتساب الجاهزة</Sec>
        <Field full label="الرسالة التي ينسخها الموظف ويرسلها إلى العميل (تتضمن التفاصيل والموقع)"
          hint={<button type="button" className="crm-btn sm" onClick={genWa}>إنشاء الرسالة تلقائياً من بيانات العقار</button>}>
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
                        <td><Select value={u.type} onChange={(v) => setUnit(i, "type", v)} options={withCurrent(data.propTypes, [u.type])} blank="نفس المشروع" /></td>
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
              <p className="crm-hint m-0 mb-1.5">إذا كان العقار وحدة مستقلة فاترك هذا القسم فارغاً، وإذا كان مشروعاً فأضف كل وحدة بمساحتها وسعرها.</p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button type="button" className="crm-btn sm" onClick={() => set("units", [...f.units, { name: "", status: "متاح" }])}>+ إضافة وحدة</button>
              {f.units.length > 0 && <button type="button" className="crm-btn sm" onClick={() => set("units", [...f.units, { ...f.units[f.units.length - 1], name: "" }])}>+ تكرار آخر وحدة</button>}
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

  // A task given to an employee by someone else is read-only for them (client 2026-10-26): they can only open it and mark it done.
  const readOnly = !!rec && !data.isMgr && rec.createdBy !== data.uid;
  if (rec && readOnly) {
    const cl = clientById(data, rec.clientId), pr = data.props.find((p) => p.id === rec.propertyId);
    return (
      <ModalFrame title="مهمة" onClose={closeModal} width={560}
        footer={
          <div className="flex flex-wrap gap-2">
            {rec.assignee === data.uid && !rec.done && (
              <button type="button" className="crm-btn primary" onClick={async () => { await toggleTask(data, rec.id, true); toast("أحسنت، تم إنجاز المهمة"); closeModal(); }}>تم الإنجاز</button>
            )}
            <button type="button" className="crm-btn" onClick={closeModal}>إغلاق</button>
          </div>
        }>
        <div className="grid gap-2.5 text-[14px]">
          <b className="font-heading text-[16px]">{rec.title}</b>
          {rec.done && <Pill tone="ok">منجزة</Pill>}
          <div className="grid gap-1 text-[13.5px] text-[var(--crm-ink-2)]">
            <span>الموعد: {rec.due || "—"}</span>
            <span>الأولوية: {rec.priority || "عادية"}</span>
            {rec.createdBy && <span>من: {nameOf(data, rec.createdBy)}</span>}
            {cl && <span>العميل: {cl.name}</span>}
            {pr && <span>العقار: {pr.title}</span>}
          </div>
          {rec.notes && <p className="m-0 whitespace-pre-wrap rounded-lg bg-[var(--crm-surface-2)] px-3 py-2">{rec.notes}</p>}
          <span className="crm-hint">المهام التي تصلك من الإدارة لا تُعدَّل، وإنما تضغط «تم الإنجاز» عند الانتهاء منها.</span>
        </div>
      </ModalFrame>
    );
  }

  async function save() {
    if (!f.title.trim()) return toast("يرجى تعبئة حقل: المهمة");
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
        <Field label="المهمة *" full><input value={f.title} autoFocus={!rec} placeholder="مثال: ترتيب زيارة فيلا النرجس مع أنس" onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="المُسند إليه"><MemberSelect value={f.assignee} onChange={(v) => set("assignee", v)} /></Field>
        <Field label="التاريخ"><input type="date" value={f.due} onChange={(e) => set("due", e.target.value)} /></Field>
        <Field label="الأولوية"><Select value={f.priority} onChange={(v) => set("priority", v)} options={PRIO} /></Field>
        <Field label="العميل (اختياري)"><Select value={f.clientId} onChange={(v) => set("clientId", v)} options={visibleClients(data).map((c) => [c.id, c.name] as [string, string])} blank="—" /></Field>
        <Field label="العقار (اختياري)"><Select value={f.propertyId} onChange={(v) => set("propertyId", v)} options={data.props.map((p) => [p.id, p.title] as [string, string])} blank="—" /></Field>
        <Field label="تفاصيل" full><textarea rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      </form>
    </ModalFrame>
  );
}
