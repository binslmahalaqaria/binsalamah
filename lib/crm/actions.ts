/**
 * Firestore writes for the sales CRM. Each mirrors a behavior of the
 * original artifact CRM: logging a client update also advances the
 * client's open request, closing a sale marks the unit/property sold,
 * cancelling releases it, reassigning a client moves its open requests,
 * and overdue clients escalate back to the sales manager.
 */
import {
  addDoc, collection, deleteDoc, doc, getDoc, runTransaction, setDoc, updateDoc,
  writeBatch, type DocumentReference,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { assertWritable, isPreview } from "./preview";
import { CALL_AFTER, CALL_T, MISSED, NO_RESP, PROP_OPEN, REQ, SOLD_ST, TO_CONTACT, UPD, UPD_STAGE, WA_LOG } from "./constants";
import {
  answeredSince, clientById, missedStreak, nameOf, OPEN_REQ, propById, reqsOf, unitsOf, type CrmData,
} from "./logic";
import type { AttendanceDay, Client, LogEntry, Proposal, Request, Unit, Viewing } from "./types";
import { syncWebOffer } from "./web-sync";
import { addDays, dayDiff, fmtVisit, localDay, moneyFull, normPhone, nowStamp, num, today } from "./util";

const LOG_MAX = 80;
const clean = <T extends object>(o: T) => JSON.parse(JSON.stringify(o)) as T; // drop undefined

export async function write(col: string, id: string | null, data: object, mode: "set" | "update" = "set") {
  assertWritable();
  if (id) {
    const ref = doc(db, col, id);
    if (mode === "update") await updateDoc(ref, clean(data) as Record<string, unknown>);
    else await setDoc(ref, clean(data));
    return id;
  }
  const ref = await addDoc(collection(db, col), clean(data));
  return ref.id;
}
/** Property writes also update the property's website listing, if it has one (lib/crm/web-sync.ts). */
export async function writeProperty(id: string, data: { units?: Unit[]; status?: string | null } & Record<string, unknown>) {
  await write("properties", id, data, "update");
  await syncWebOffer(id, data).catch(() => {});
}
/**
 * One client per phone number, enforced by the database (client 2026-10-21): every new client also
 * creates `phones/<normalised number>` in the same batch/transaction, and the rules allow creating
 * that document but never overwriting it — so a second client with the same number fails even when
 * two people save at the same moment. (Numbers already in the CRM are also checked in the browser.)
 */
type Writer = { set(ref: DocumentReference, data: object): unknown; delete(ref: DocumentReference): unknown };
export function claimPhone(w: Writer, phone: string | null | undefined, clientId: string) {
  const n = normPhone(phone);
  if (n) w.set(doc(db, "phones", n), { clientId, at: nowStamp() });
}
export function releasePhone(w: Writer, phone: string | null | undefined) {
  const n = normPhone(phone);
  if (n) w.delete(doc(db, "phones", n));
}
/** Firestore refused the write: with claimPhone in it, that means the number is already taken. */
export const isPhoneTaken = (e: unknown) => (e as { code?: string })?.code === "permission-denied";
export const PHONE_TAKEN = "ترا الرقم هذا موجود — سُجّل لعميل آخر قبل لحظات. ابحث عنه في العملاء.";

/** Creates a client and reserves its phone number in one batch. */
export async function createClient(data: { phone?: string | null } & Record<string, unknown>) {
  assertWritable();
  const ref = doc(collection(db, "clients"));
  const b = writeBatch(db);
  b.set(ref, clean(data));
  claimPhone(b, data.phone, ref.id);
  await b.commit();
  return ref.id;
}
/** Updates a client; when the phone changes, the new number is reserved and the old one freed. */
export async function updateClient(c: Client, patch: { phone?: string | null } & Record<string, unknown>) {
  assertWritable();
  const changed = patch.phone !== undefined && normPhone(patch.phone) !== normPhone(c.phone);
  if (!changed) return write("clients", c.id, patch, "update");
  const b = writeBatch(db);
  b.update(doc(db, "clients", c.id), clean(patch) as Record<string, unknown>);
  claimPhone(b, patch.phone, c.id);
  releasePhone(b, c.phone);
  await b.commit();
  return c.id;
}
/** Deletes a client with their requests (no orphan «عميل محذوف» requests), frees their number and any property they held. */
export async function deleteClient(d: CrmData, c: Client) {
  assertWritable();
  const reqs = d.requests.filter((r) => r.clientId === c.id);
  const b = writeBatch(db);
  b.delete(doc(db, "clients", c.id));
  for (const r of reqs) b.delete(doc(db, "requests", r.id));
  releasePhone(b, c.phone);
  await b.commit();
  for (const r of reqs) if (SOLD_ST.includes(r.status) && r.propertyId) await releaseUnit(d, r.propertyId, r.unit);
}

export const remove = (col: string, id: string) => {
  assertWritable();
  return deleteDoc(doc(db, col, id));
};

function pushLog(c: Client, entry: LogEntry) {
  return [entry].concat(c.log || []).slice(0, LOG_MAX);
}

/** Moves the client's newest open request forward to `to` (never backwards, except cancel/sold). */
/** `reqId`: the request the update was made from (else the client's newest open request). */
export async function advanceReq(d: CrmData, clientId: string, to: string, reqId?: string) {
  const c = clientById(d, clientId);
  if (!c || !to) return;
  const r = (reqId && d.requests.find((x) => x.id === reqId && x.clientId === c.id && OPEN_REQ(x))) || reqsOf(d, c)[0];
  if (!r) return;
  const cur = REQ.indexOf((r.status || "جديد") as never),
    nx = REQ.indexOf(to as never);
  // A client who backs out while holding a deposit/sale: clear the deal and free the property or unit too
  // (it used to stay «محجوز» with the request cancelled).
  if (to === "ملغي" && SOLD_ST.includes(r.status || "")) {
    await write("requests", r.id, { status: to, depositAt: null, closedAt: null, deposit: null, depositBy: null, closedBy: null, updatedAt: nowStamp() }, "update");
    if (r.propertyId) await releaseUnit(d, r.propertyId, r.unit);
    return;
  }
  if (to === "ملغي" || to === "تم البيع" || nx > cur) await write("requests", r.id, { status: to, updatedAt: nowStamp() }, "update");
}

/** Logs what happened with a client and sets their next call. Doesn't touch requests. */
export async function applyUpdate0(d: CrmData, id: string, type: string, next: string | null, text: string, propertyId: string | null, opts: { call?: boolean } = {}) {
  const c = clientById(d, id);
  if (!c) return false;
  const u = UPD.find((x) => x.k === type);
  const entry: LogEntry = { at: nowStamp(), byId: d.uid || null, type, text: text || "", propertyId: propertyId || null, call: opts.call ?? CALL_T.includes(type) };
  const patch: Partial<Client> = {
    log: pushLog(c, entry),
    lastUpdate: type,
    lastUpdateAt: entry.at,
    nextCall: next,
    updatedAt: nowStamp(),
    unseen: false,
  };
  if (u?.status) patch.status = u.status;
  // A «لا يوجد رد» client who answers later is active again, with everything kept.
  else if (c.status === NO_RESP && entry.call && !MISSED.includes(type)) { patch.status = "نشط"; patch.waSentAt = null; }
  if (type === "زار العقار" || u?.status) {
    patch.visitAt = null;
    patch.visitConfirmed = false;
  }
  if (propertyId && !c.interestIn) patch.interestIn = propertyId;
  await write("clients", id, patch, "update");
  // Third unanswered call in a row → a task to send a WhatsApp message as the fourth attempt (once).
  if (MISSED.includes(type) && missedStreak(c) + 1 >= 3 && !c.waSentAt &&
      !d.tasks.some((x) => x.kind === "wa4" && x.clientId === id && !x.done)) {
    await write("tasks", null, {
      kind: "wa4", title: "إرسال رسالة واتساب (المحاولة الرابعة) — لم يرد على 3 مكالمات", assignee: c.assignee || d.uid,
      due: today(), priority: "مهمة", clientId: id, propertyId: null, notes: null, done: false, seen: c.assignee === d.uid,
      createdBy: d.uid, createdAt: nowStamp(), updatedAt: nowStamp(),
    });
  }
  return true;
}

/** The fourth attempt: WhatsApp message sent. Not a call; 48 h without a reply moves the client to «لا يوجد رد». */
export async function markWaSent(d: CrmData, clientId: string) {
  const c = clientById(d, clientId);
  if (!c) return;
  const at = nowStamp();
  await write("clients", c.id, {
    waSentAt: at, nextCall: addDays(2), updatedAt: at,
    log: pushLog(c, { at, byId: d.uid, type: WA_LOG, text: "المحاولة الرابعة: رسالة واتساب بعد 3 مكالمات لم يُرد عليها", call: false }),
  }, "update");
  for (const x of d.tasks.filter((x) => x.kind === "wa4" && x.clientId === c.id && !x.done))
    await write("tasks", x.id, { done: true, doneAt: at, doneBy: d.uid, updatedAt: at }, "update");
}

/** Clients 48 h past the WhatsApp message with no answered call since → «لا يوجد رد» (runs in staff browsers). */
export async function runNoResponse(d: CrmData, done: Set<string>) {
  const cut = new Date(Date.now() - 48 * 3600e3).toISOString();
  const mine = (c: Client) => d.isMgr || c.assignee === d.uid;
  for (const c of d.clients) {
    if (!c.waSentAt || c.waSentAt > cut || done.has(c.id) || !mine(c)) continue;
    if (![ "نشط", TO_CONTACT ].includes(c.status || "نشط") || answeredSince(c, c.waSentAt)) continue;
    done.add(c.id);
    await write("clients", c.id, {
      status: NO_RESP, nextCall: null, updatedAt: nowStamp(),
      log: pushLog(c, { at: nowStamp(), byId: d.uid, type: "نقل إلى لا يوجد رد", text: "لم يرد خلال 48 ساعة من رسالة الواتساب", call: false }),
    }, "update");
  }
}

/** Brings a «لا يوجد رد» client back to the active list, calling today. */
export async function reactivateClient(d: CrmData, clientId: string) {
  const c = clientById(d, clientId);
  if (!c) return;
  await write("clients", c.id, {
    status: "نشط", waSentAt: null, nextCall: today(), updatedAt: nowStamp(),
    log: pushLog(c, { at: nowStamp(), byId: d.uid, type: "إعادة تفعيل", text: "أُعيد من قائمة لا يوجد رد", call: false }),
  }, "update");
}

export async function applyUpdate(d: CrmData, id: string, type: string, next: string | null, text: string, propertyId: string | null, opts: { call?: boolean; reqId?: string } = {}) {
  const ok = await applyUpdate0(d, id, type, next, text, propertyId, opts);
  // The first real update on a website request clears «بانتظار تحديث الموظف» (who and when are kept).
  if (ok) {
    const w = (opts.reqId && d.requests.find((x) => x.id === opts.reqId && x.awaitingUpdate)) || (!opts.reqId && d.requests.find((x) => x.clientId === id && x.awaitingUpdate && OPEN_REQ(x)));
    if (w) await write("requests", w.id, { awaitingUpdate: false, firstUpdateAt: nowStamp(), firstUpdateBy: d.uid || null, updatedAt: nowStamp() }, "update");
  }
  if (ok && UPD_STAGE[type]) await advanceReq(d, id, UPD_STAGE[type], opts.reqId);
  return ok;
}

export async function postpone(d: CrmData, id: string) {
  const c = clientById(d, id);
  if (!c) return null;
  const next = addDays(3);
  await write(
    "clients",
    id,
    { nextCall: next, log: pushLog(c, { at: nowStamp(), byId: d.uid, type: "تأجيل", text: "تأجيل الاتصال 3 أيام" }), updatedAt: nowStamp() },
    "update"
  );
  return next;
}

export async function confirmVisit(d: CrmData, id: string) {
  const c = clientById(d, id);
  if (!c) return;
  await write(
    "clients",
    id,
    {
      visitConfirmed: true,
      log: pushLog(c, { at: nowStamp(), byId: d.uid, type: "تأكيد زيارة", text: "تم تأكيد موعد المعاينة " + fmtVisit(c.visitAt) }),
      updatedAt: nowStamp(),
    },
    "update"
  );
}

/** Sets (or clears) the client's visit date; the request keeps its stage (a visit is not a stage). */
export async function saveVisit(d: CrmData, reqId: string, at: string | null, propId: string | null, note: string) {
  const r = d.requests.find((x) => x.id === reqId);
  const c = r && clientById(d, r.clientId);
  if (!c) return false;
  const clear = !at;
  const day = at ? at.slice(0, 10) : null;
  // Call the day before the visit to confirm it.
  const diff = day ? dayDiff(day) ?? 0 : 0;
  await write(
    "clients",
    c.id,
    {
      visitAt: at,
      visitProperty: propId,
      visitConfirmed: false,
      log: pushLog(c, {
        at: nowStamp(),
        byId: d.uid,
        type: clear ? "إلغاء موعد" : "حدد موعد زيارة",
        text: clear ? "تم إلغاء موعد المعاينة" : fmtVisit(at) + (note ? " — " + note : ""),
        propertyId: propId,
      }),
      lastUpdate: clear ? c.lastUpdate || null : "حدد موعد زيارة",
      lastUpdateAt: nowStamp(),
      nextCall: day && diff > 0 ? addDays(diff - 1) : c.nextCall || null,
      updatedAt: nowStamp(),
    },
    "update"
  );
  return true;
}

/** Puts a booked/sold unit (or whole property) back on the market. */
export async function releaseUnit(d: CrmData, pid: string, unit: string | null | undefined) {
  const p = propById(d, pid);
  if (!p) return;
  if (unit && unitsOf(p).length) {
    if (!(p.units || []).some((u) => u && u.name === unit && u.status !== "متاح")) return;
    const units = (p.units || []).map((u) => (u && u.name === unit ? { ...u, status: "متاح" } : u));
    await writeProperty(p.id, { units, updatedAt: nowStamp() });
  } else if (!unitsOf(p).length && p.status !== "متاح") await writeProperty(p.id, { status: "متاح", updatedAt: nowStamp() });
}

async function markUnit(d: CrmData, pid: string, unit: string | null, st: string) {
  const p = propById(d, pid);
  if (!p) return;
  if (unit && unitsOf(p).length) {
    const units = (p.units || []).map((u) => (u && u.name === unit ? { ...u, status: st } : u));
    await writeProperty(p.id, { units, updatedAt: nowStamp() });
  } else if (!unitsOf(p).length) await writeProperty(p.id, { status: st, updatedAt: nowStamp() });
}

/** Records a deposit (عربون) or a completed sale (تم البيع) on a request. */
export async function saveClose(
  d: CrmData,
  reqId: string,
  to: string,
  v: { propertyId: string; unit: string | null; price: number; pct: number; extra: string; depositDay?: string | null }
) {
  const r = d.requests.find((x) => x.id === reqId);
  if (!r) return false;
  const patch: Partial<Request> = {
    status: to, propertyId: v.propertyId, unit: v.unit || null, price: v.price, commissionPct: v.pct, updatedAt: nowStamp(),
  };
  if (to === "عربون") {
    // Keep the original timestamp unless the user picked a different day for the deposit.
    patch.depositAt =
      v.depositDay && v.depositDay !== localDay(r.depositAt)
        ? (v.depositDay === today() ? nowStamp() : new Date(v.depositDay + "T12:00:00").toISOString())
        : r.depositAt || nowStamp();
    patch.deposit = num(v.extra);
    patch.depositBy = r.status === "عربون" && r.depositBy ? r.depositBy : d.uid;
  } else {
    patch.closedBy = r.status === "تم البيع" && r.closedBy ? r.closedBy : d.uid;
    patch.closedAt = v.extra ? new Date(v.extra + "T12:00:00").toISOString() : nowStamp();
    if (!r.depositAt) {
      patch.depositAt = patch.closedAt;
      patch.depositBy = d.uid;
    }
  }
  await write("requests", r.id, patch, "update");
  if (r.propertyId && SOLD_ST.includes(r.status) && (r.propertyId !== v.propertyId || (r.unit || null) !== (v.unit || null)))
    await releaseUnit(d, r.propertyId, r.unit);
  const p = propById(d, v.propertyId);
  await markUnit(d, v.propertyId, v.unit, to === "تم البيع" ? "مباع" : "محجوز");
  if (r.clientId)
    await applyUpdate0(
      d, r.clientId, to === "تم البيع" ? "تم الإغلاق" : "دفع عربون", null,
      (to === "عربون" && patch.deposit ? "عربون " + moneyFull(patch.deposit) + " · " : "") +
        (p ? p.title : "") + (v.unit ? " — " + v.unit : "") + " · قيمة البيع " + moneyFull(v.price), v.propertyId
    );
  if (to === "تم البيع" && r.clientId && !d.requests.some((x) => x.clientId === r.clientId && x.id !== r.id && OPEN_REQ(x)))
    await write("clients", r.clientId, { status: "مغلق" }, "update");
  return true;
}

/** Cancels a deposit/sale: releases the unit, moves the request back, and reopens the client. */
export async function cancelSale(d: CrmData, reqId: string, to: string, note: string) {
  const r = d.requests.find((x) => x.id === reqId);
  if (!r) return false;
  const was = r.status;
  await write("requests", r.id, { status: to, depositAt: null, closedAt: null, deposit: null, depositBy: null, closedBy: null, updatedAt: nowStamp() }, "update");
  if (r.propertyId) await releaseUnit(d, r.propertyId, r.unit);
  if (r.clientId) {
    const c = clientById(d, r.clientId);
    if (c && c.status === "مغلق") await write("clients", c.id, { status: "نشط" }, "update");
    // Logged as a deal cancellation, not as a call (it used to count as «تم الاتصال» in the call figures).
    await applyUpdate0(
      d, r.clientId, "إلغاء صفقة", null,
      "إلغاء " + (was === "تم البيع" ? "البيع" : "العربون") + (note ? ": " + note : ""), r.propertyId || null
    );
  }
  return true;
}

/** Changes a request's stage directly (callers route deposit/sale/cancel through the modals first). */
/** Interest level (ساخن / دافئ / بارد) is set by hand only; the change is logged with who and when. */
export async function setTemp(d: CrmData, c: Client, to: string) {
  await write("clients", c.id, { temp: to || null, updatedAt: nowStamp(), log: pushLog(c, { at: nowStamp(), byId: d.uid, type: "درجة الاهتمام", text: (c.temp || "لم يُحدد") + " ← " + (to || "لم يُحدد"), call: false }) }, "update");
}

export async function setReqStage(reqId: string, to: string, d?: CrmData) {
  await write("requests", reqId, { status: to, updatedAt: nowStamp() }, "update");
  // An explicit stage change is kept in the client's log (who, when, from → to).
  const r = d?.requests.find((x) => x.id === reqId);
  const c = d && r && clientById(d, r.clientId);
  if (d && r && c) await write("clients", c.id, { log: pushLog(c, { at: nowStamp(), byId: d.uid, type: "تغيير المرحلة", text: (r.status || "جديد") + " ← " + to, call: false }), updatedAt: nowStamp() }, "update");
}

/** Records that a property was sent to a request's client; nudges early-stage requests forward. */
export async function reqSent(d: CrmData, reqId: string, pid: string) {
  const r = d.requests.find((x) => x.id === reqId);
  if (!r) return;
  // A property sent from the matching screen / WhatsApp is not a call.
  if (r.clientId) await applyUpdate(d, r.clientId, "تم إرسال التفاصيل", addDays(3), "", pid, { call: false });
  const early = ["جديد", "جاري البحث"].includes(r.status || "جديد");
  const sent = [...new Set((r.sent || []).concat(pid))];
  await recordProposal(d, r, pid);
  await write("requests", reqId, { sent, updatedAt: nowStamp(), ...(early ? { status: "أرسلنا خيارات" } : {}) }, "update");
}

/** Assigns a client and its open requests (plus `reqId`, if given) to a staff member. */
export async function assignClient(d: CrmData, cid: string | null, uid: string | null, reqId?: string) {
  const c = clientById(d, cid);
  if (c)
    await write(
      "clients", c.id,
      {
        assignee: uid, assignedAt: nowStamp(), assignedBy: d.uid, unseen: !!uid && uid !== d.uid, escalatedFrom: null, updatedAt: nowStamp(), freezeFrom: null,
        ...(c.assignee !== uid ? { log: pushLog(c, { at: nowStamp(), byId: d.uid, type: "إسناد", text: "الإسناد: " + (uid ? nameOf(d, uid) : "بدون مسؤول"), call: false }) } : {}),
      },
      "update"
    );
  const rs = d.requests.filter((r) => (c ? r.clientId === c.id && OPEN_REQ(r) : false) || r.id === reqId);
  for (const r of rs) if (r.assignee !== uid) await write("requests", r.id, { assignee: uid, updatedAt: nowStamp(), freezeFrom: null }, "update");
  return { n: rs.length, name: uid ? nameOf(d, uid) : null };
}

/**
 * «تحويل الطلب» (client 2026-10-21): hands a request to another employee. The client goes with it
 * (with their other open requests — one client, one owner), and the client's file records who moved it
 * and why («تحويل», never counted as a call).
 */
export async function transferRequest(d: CrmData, r: Request, to: string, note: string) {
  const c = clientById(d, r.clientId);
  const from = r.assignee || c?.assignee || null;
  const res = await assignClient(d, r.clientId, to, r.id);
  if (c) {
    const text = "تحويل الطلب من " + (from ? nameOf(d, from) : "غير مسند") + " إلى " + nameOf(d, to) + (note ? ": " + note : "");
    await write("clients", c.id, { log: pushLog(clientById(d, c.id) || c, { at: nowStamp(), byId: d.uid, type: "تحويل", text, call: false }), updatedAt: nowStamp() }, "update");
  }
  return res;
}

export async function toggleTask(d: CrmData, id: string, done: boolean) {
  await write("tasks", id, { done, doneAt: done ? nowStamp() : null, doneBy: done ? d.uid : null, updatedAt: nowStamp() }, "update");
}
export async function markTasksSeen(d: CrmData) {
  for (const t of d.tasks.filter((x) => x.seen === false && x.assignee === d.uid)) await write("tasks", t.id, { seen: true }, "update");
}

export async function checkIO(uid: string, kind: "in" | "out", loc: AttendanceDay["inLoc"] = null) {
  assertWritable();
  const ref = doc(db, "attendance", uid, "days", today());
  if (kind === "in") await setDoc(ref, { date: today(), in: nowStamp(), out: null, inLoc: loc });
  else await updateDoc(ref, { out: nowStamp(), outLoc: loc });
}

export async function saveAttendance(uid: string, date: string, inT: string, outT: string, by: string) {
  assertWritable();
  const mk = (v: string) => (v ? new Date(date + "T" + v + ":00").toISOString() : null);
  await setDoc(doc(db, "attendance", uid, "days", date), { date, in: mk(inT), out: mk(outT), editedBy: by });
}
export const deleteAttendance = (uid: string, date: string) => {
  assertWritable();
  return deleteDoc(doc(db, "attendance", uid, "days", date));
};

export async function sendChat(d: CrmData, text: string, clientId: string | null) {
  assertWritable();
  await addDoc(collection(db, "chat"), { text: text.slice(0, 2000), by: d.uid, at: nowStamp(), clientId: clientId || null });
}

/**
 * Escalation: active clients whose next call is overdue by more than
 * `days` go back to the sales manager (logged on the client). Runs in the
 * browser of whichever manager has the CRM open, like the original.
 */
export async function runEscalation(d: CrmData, mgr: string, days: number, done: Set<string>) {
  const list = d.clients.filter(
    (c) =>
      (c.status || "نشط") === "نشط" && c.assignee && c.assignee !== mgr && c.nextCall &&
      (dayDiff(c.nextCall) ?? 0) < -days && !done.has(c.id)
  );
  for (const c of list) {
    done.add(c.id);
    await write(
      "clients", c.id,
      {
        assignee: mgr, escalatedFrom: c.assignee, escalatedAt: nowStamp(), assignedAt: nowStamp(), assignedBy: null, unseen: true,
        log: pushLog(c, {
          at: nowStamp(), byId: d.uid, type: "أُعيد إلى مدير المبيعات",
          text: "لم يتم التواصل خلال " + days + " أيام من الموعد (كان عند " + nameOf(d, c.assignee) + ")",
        }),
        updatedAt: nowStamp(),
      },
      "update"
    );
    for (const r of reqsOf(d, c)) if (r.assignee === c.assignee) await write("requests", r.id, { assignee: mgr, updatedAt: nowStamp() }, "update");
  }
  return list.length;
}

/**
 * Round-robin: the next active employee in crm/lists.rr.order after the last one who got a request.
 * Runs in a transaction so two managers adding requests at once never get the same turn.
 * Returns null when auto-assignment is off or nobody in the list is active.
 */
export async function nextAssignee(d: CrmData): Promise<string | null> {
  assertWritable();
  const ref = doc(db, "crm", "lists");
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const rr = (snap.exists() ? snap.data().rr : null) as { on?: boolean; order?: string[]; last?: string | null } | null;
    // The order set in Settings; without one, every active sales employee in turn (same as website requests).
    const set = (rr?.order || []).filter((id) => d.staff.some((s) => s.id === id && s.active));
    const order = set.length ? set : d.staff.filter((s) => s.active && s.role === "sales").sort((a, b) => (a.created_at || 0) - (b.created_at || 0)).map((s) => s.id);
    if (!order.length) return null;
    const i = rr?.last ? order.indexOf(rr.last) : -1;
    const next = order[(i + 1) % order.length];
    tx.set(ref, { rr: { on: false, order: [], ...(rr || {}), last: next } }, { merge: true });
    return next;
  });
}

/** Private message to one colleague (collection "dm"). */
export async function sendDm(d: CrmData, to: string, text: string, clientId: string | null) {
  assertWritable();
  const members = [d.uid, to].sort() as [string, string];
  await addDoc(collection(db, "dm"), { members, by: d.uid, to, text: text.slice(0, 2000), at: nowStamp(), clientId: clientId || null, read: false });
}
/** Marks private messages sent to me as read (only the "read" flag may change). */
export async function markDmRead(ids: string[]) {
  if (isPreview() || !ids.length) return;
  const b = writeBatch(db);
  ids.forEach((id) => b.update(doc(db, "dm", id), { read: true }));
  await b.commit().catch(() => {});
}

/** Deletes a request after a confirmation; a property/unit it had reserved or sold goes back on the market. */
export async function deleteRequest(d: CrmData, r: Request) {
  const c = clientById(d, r.clientId);
  if (!window.confirm("حذف هذا الطلب" + (c ? " للعميل " + c.name : "") + " نهائياً؟ يبقى العميل نفسه.")) return false;
  await remove("requests", r.id);
  if (SOLD_ST.includes(r.status) && r.propertyId) await releaseUnit(d, r.propertyId, r.unit);
  return true;
}

/* ---------- offers and viewings (trial 2026-10-22) ---------- */
const ev = (d: CrmData, status: string, note?: string | null) => ({ at: nowStamp(), by: d.uid || null, status, note: note || null });
const pTitle = (d: CrmData, pid: string | null | undefined) => propById(d, pid)?.title || "عقار";

/** Every property sent to a customer becomes an offer (once per request + property; re-sending refreshes it). */
export async function recordProposal(d: CrmData, r: Request, pid: string, unit?: string | null) {
  const old = d.proposals.find((x) => x.requestId === r.id && x.propertyId === pid && (x.unit || null) === (unit || null));
  if (old) {
    await write("proposals", old.id, { sentAt: nowStamp(), status: "أُرسل", history: [...(old.history || []), ev(d, "أُرسل", "أُعيد الإرسال")], updatedAt: nowStamp() }, "update");
    return old.id;
  }
  const p = propById(d, pid);
  return write("proposals", null, {
    requestId: r.id, clientId: r.clientId, propertyId: pid, unit: unit || null, price: p?.price ?? null,
    sentAt: nowStamp(), by: d.uid || null, assignee: r.assignee || clientById(d, r.clientId)?.assignee || d.uid || null,
    status: "أُرسل", feedback: null, history: [ev(d, "أُرسل")], updatedAt: nowStamp(),
  });
}

/** Back to the property search list (even from a later stage) unless a deal is recorded. */
async function backToSearch(d: CrmData, requestId: string | null | undefined) {
  const r = d.requests.find((x) => x.id === requestId);
  if (r && OPEN_REQ(r) && !SOLD_ST.includes(r.status || "")) await write("requests", r.id, { status: "جاري البحث", updatedAt: nowStamp() }, "update");
}

/** Changes an offer's status; «غير مناسب» returns the request to the search list when no other offer is still open. */
export async function setProposalStatus(d: CrmData, p: Proposal, status: string, feedback?: string) {
  await write("proposals", p.id, {
    status, ...(feedback !== undefined ? { feedback: feedback || null } : {}),
    history: [...(p.history || []), ev(d, status, feedback)], updatedAt: nowStamp(),
  }, "update");
  const c = clientById(d, p.clientId);
  if (c && ["مهتم", "غير مناسب"].includes(status))
    await write("clients", c.id, {
      log: pushLog(c, { at: nowStamp(), byId: d.uid, type: status === "مهتم" ? "مهتم بعرض" : "عرض غير مناسب", text: pTitle(d, p.propertyId) + (feedback ? " — " + feedback : ""), propertyId: p.propertyId, call: false }),
      ...(status === "مهتم" ? { interestIn: p.propertyId } : {}), updatedAt: nowStamp(),
    }, "update");
  if (status === "غير مناسب" && !d.proposals.some((x) => x.requestId === p.requestId && x.id !== p.id && PROP_OPEN.includes(x.status)))
    await backToSearch(d, p.requestId);
}

/** Books a viewing: a viewing record, the client's visit (reminder/call the day before), the request to «معاينة», the offer linked. */
export async function scheduleViewing(d: CrmData, reqId: string, at: string, propId: string | null, note: string) {
  const r = d.requests.find((x) => x.id === reqId);
  if (!r) return false;
  // Never a second open viewing for the same request and property: the existing one is moved instead.
  const dup = d.viewings.find((x) => x.requestId === r.id && (x.propertyId || null) === (propId || null) && ["مجدولة", "مؤجلة"].includes(x.status));
  if (dup) { if (dup.at !== at) await postponeViewing(d, dup, at, note); return true; }
  await write("viewings", null, {
    requestId: r.id, clientId: r.clientId, propertyId: propId, at, status: "مجدولة", feedback: null, followUp: null,
    assignee: r.assignee || clientById(d, r.clientId)?.assignee || d.uid || null, by: d.uid || null,
    history: [ev(d, "مجدولة", note)], createdAt: nowStamp(), updatedAt: nowStamp(),
  });
  await saveVisit(d, r.id, at, propId, note);
  return true;
}

/** Postpones a viewing to a new time (status «مؤجلة»; still upcoming). */
export async function postponeViewing(d: CrmData, v: Viewing, at: string, note: string) {
  await write("viewings", v.id, { at, status: "مؤجلة", history: [...(v.history || []), ev(d, "مؤجلة", note || "إلى " + fmtVisit(at))], updatedAt: nowStamp() }, "update");
  if (v.requestId) await saveVisit(d, v.requestId, at, v.propertyId, "تأجيل المعاينة" + (note ? ": " + note : ""));
}

/** Cancels a viewing (kept in the record as «ملغاة»). */
export async function cancelViewing(d: CrmData, v: Viewing, note: string) {
  await write("viewings", v.id, { status: "ملغاة", history: [...(v.history || []), ev(d, "ملغاة", note)], updatedAt: nowStamp() }, "update");
  if (v.requestId) await saveVisit(d, v.requestId, null, null, note);
}

/**
 * Records how a viewing went. Interested → negotiation; unsuitable → the offer «غير مناسب» and the request
 * back to the search list; thinking → just a follow-up. Always schedules the post-viewing follow-up call.
 */
export async function viewingResult(d: CrmData, v: Viewing, result: "interested" | "unsuitable" | "thinking", feedback: string, followUp: string | null) {
  await write("viewings", v.id, {
    status: "تمت", feedback: feedback || null, followUp, updatedAt: nowStamp(),
    history: [...(v.history || []), ev(d, "تمت", { interested: "مهتم", unsuitable: "غير مناسب", thinking: "يفكر" }[result] + (feedback ? " — " + feedback : ""))],
  }, "update");
  await applyUpdate0(d, v.clientId, "زار العقار", followUp, (feedback || "") + (result === "interested" ? " (مهتم)" : result === "unsuitable" ? " (غير مناسب)" : ""), v.propertyId);
  const p = v.propertyId && d.proposals.find((x) => x.requestId === v.requestId && x.propertyId === v.propertyId);
  if (result === "interested") {
    if (p && p.status !== "مهتم") await setProposalStatus(d, p, "مهتم", "بعد المعاينة");
    if (v.requestId) await advanceReq(d, v.clientId, "تفاوض", v.requestId);
  } else if (result === "unsuitable") {
    if (p) await setProposalStatus(d, p, "غير مناسب", feedback || "بعد المعاينة");
    else await backToSearch(d, v.requestId);
  }
}

/**
 * One-time clean-up (client 2026-10-24): before the new rule, every update set a call date. Customers with a
 * request now get one only after options are sent, after a visit, or before a viewing — older dates that don't
 * fit are cleared once (owner session; flagged in settings/migrations so it never runs again).
 */
export async function cleanOldCallDates(d: CrmData) {
  if (!d.isAdmin) return;
  const flag = doc(db, "settings", "migrations");
  const f = await getDoc(flag);
  if (f.exists() && f.data().callDates20261024) return;
  const hasOpen = new Set(d.requests.filter(OPEN_REQ).map((r) => r.clientId));
  const stale = d.clients.filter((c) => c.nextCall && hasOpen.has(c.id) && !c.visitAt && !CALL_AFTER.includes((c.log || [])[0]?.type || ""));
  for (let k = 0; k < stale.length; k += 400) {
    const b = writeBatch(db);
    stale.slice(k, k + 400).forEach((c) => b.update(doc(db, "clients", c.id), { nextCall: null }));
    await b.commit();
  }
  await setDoc(flag, { callDates20261024: true, cleared: stale.length, at: nowStamp() }, { merge: true });
}

/**
 * Gives every property without a number the next one (#1, #2, … in the order they were added), using the
 * counters/props counter in a transaction so two open sessions never hand out the same number.
 */
export async function assignPropRefs(d: CrmData) {
  const todo = d.props.filter((p) => !p.ref).sort((x, y) => String(x.createdAt || "").localeCompare(String(y.createdAt || "")));
  for (const p of todo) {
    await runTransaction(db, async (tx) => {
      const cRef = doc(db, "counters", "props"), pRef = doc(db, "properties", p.id);
      const [c, cur] = await Promise.all([tx.get(cRef), tx.get(pRef)]);
      if (!cur.exists() || cur.data().ref) return;
      const n = (c.exists() ? Number(c.data().last) || 0 : 0) + 1;
      tx.set(cRef, { last: n }, { merge: true });
      tx.update(pRef, { ref: n });
    });
  }
}
