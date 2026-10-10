/**
 * Firestore writes for the sales CRM. Each mirrors a behavior of the
 * original artifact CRM: logging a client update also advances the
 * client's open request, closing a sale marks the unit/property sold,
 * cancelling releases it, reassigning a client moves its open requests,
 * and overdue clients escalate back to the sales manager.
 */
import {
  addDoc, collection, deleteDoc, doc, setDoc, updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { REQ, SOLD_ST, UPD, UPD_STAGE } from "./constants";
import {
  clientById, nameOf, OPEN_REQ, propById, reqsOf, unitsOf, type CrmData,
} from "./logic";
import type { Client, LogEntry, Request } from "./types";
import { addDays, dayDiff, fmtVisit, moneyFull, nowStamp, today } from "./util";

const LOG_MAX = 80;
const clean = <T extends object>(o: T) => JSON.parse(JSON.stringify(o)) as T; // drop undefined

export async function write(col: string, id: string | null, data: object, mode: "set" | "update" = "set") {
  if (id) {
    const ref = doc(db, col, id);
    if (mode === "update") await updateDoc(ref, clean(data) as Record<string, unknown>);
    else await setDoc(ref, clean(data));
    return id;
  }
  const ref = await addDoc(collection(db, col), clean(data));
  return ref.id;
}
export const remove = (col: string, id: string) => deleteDoc(doc(db, col, id));

function pushLog(c: Client, entry: LogEntry) {
  return [entry].concat(c.log || []).slice(0, LOG_MAX);
}

/** Moves the client's newest open request forward to `to` (never backwards, except cancel/sold). */
export async function advanceReq(d: CrmData, clientId: string, to: string) {
  const c = clientById(d, clientId);
  if (!c || !to) return;
  const r = reqsOf(d, c)[0];
  if (!r) return;
  const cur = REQ.indexOf((r.status || "جديد") as never),
    nx = REQ.indexOf(to as never);
  if (to === "ملغي" || to === "تم البيع" || nx > cur) await write("requests", r.id, { status: to, updatedAt: nowStamp() }, "update");
}

/** Logs what happened with a client and sets their next call. Doesn't touch requests. */
export async function applyUpdate0(d: CrmData, id: string, type: string, next: string | null, text: string, propertyId: string | null) {
  const c = clientById(d, id);
  if (!c) return false;
  const u = UPD.find((x) => x.k === type);
  const entry: LogEntry = { at: nowStamp(), byId: d.uid || null, type, text: text || "", propertyId: propertyId || null };
  const patch: Partial<Client> = {
    log: pushLog(c, entry),
    lastUpdate: type,
    lastUpdateAt: entry.at,
    nextCall: next,
    updatedAt: nowStamp(),
    unseen: false,
  };
  if (u?.status) patch.status = u.status;
  if (type === "زار العقار" || u?.status) {
    patch.visitAt = null;
    patch.visitConfirmed = false;
  }
  if (propertyId && !c.interestIn) patch.interestIn = propertyId;
  await write("clients", id, patch, "update");
  return true;
}

export async function applyUpdate(d: CrmData, id: string, type: string, next: string | null, text: string, propertyId: string | null) {
  const ok = await applyUpdate0(d, id, type, next, text, propertyId);
  if (ok && UPD_STAGE[type]) await advanceReq(d, id, UPD_STAGE[type]);
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
      log: pushLog(c, { at: nowStamp(), byId: d.uid, type: "تأكيد زيارة", text: "أكد موعد الزيارة " + fmtVisit(c.visitAt) }),
      updatedAt: nowStamp(),
    },
    "update"
  );
}

export async function visitNoShow(d: CrmData, id: string) {
  const c = clientById(d, id);
  if (!c) return;
  await write(
    "clients",
    id,
    {
      visitAt: null,
      visitConfirmed: false,
      nextCall: today(),
      log: pushLog(c, { at: nowStamp(), byId: d.uid, type: "ما حضر", text: "ما حضر موعد الزيارة " + fmtVisit(c.visitAt) }),
      updatedAt: nowStamp(),
    },
    "update"
  );
}

/** Sets (or clears) a visit for the request's client, and moves the request to "معاينة". */
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
        text: clear ? "انلغى موعد الزيارة" : fmtVisit(at) + (note ? " — " + note : ""),
        propertyId: propId,
      }),
      lastUpdate: clear ? c.lastUpdate || null : "حدد موعد زيارة",
      lastUpdateAt: nowStamp(),
      nextCall: day && diff > 0 ? addDays(diff - 1) : c.nextCall || null,
      updatedAt: nowStamp(),
    },
    "update"
  );
  if (!clear) await advanceReq(d, c.id, "معاينة");
  return true;
}

/** Puts a booked/sold unit (or whole property) back on the market. */
export async function releaseUnit(d: CrmData, pid: string, unit: string | null | undefined) {
  const p = propById(d, pid);
  if (!p) return;
  if (unit && unitsOf(p).length) {
    if (!(p.units || []).some((u) => u && u.name === unit && u.status !== "متاح")) return;
    const units = (p.units || []).map((u) => (u && u.name === unit ? { ...u, status: "متاح" } : u));
    await write("properties", p.id, { units, updatedAt: nowStamp() }, "update");
  } else if (!unitsOf(p).length && p.status !== "متاح") await write("properties", p.id, { status: "متاح", updatedAt: nowStamp() }, "update");
}

async function markUnit(d: CrmData, pid: string, unit: string | null, st: string) {
  const p = propById(d, pid);
  if (!p) return;
  if (unit && unitsOf(p).length) {
    const units = (p.units || []).map((u) => (u && u.name === unit ? { ...u, status: st } : u));
    await write("properties", p.id, { units, updatedAt: nowStamp() }, "update");
  } else if (!unitsOf(p).length) await write("properties", p.id, { status: st, updatedAt: nowStamp() }, "update");
}

/** Records a deposit (عربون) or a completed sale (تم البيع) on a request. */
export async function saveClose(
  d: CrmData,
  reqId: string,
  to: string,
  v: { propertyId: string; unit: string | null; price: number; pct: number; extra: string }
) {
  const r = d.requests.find((x) => x.id === reqId);
  if (!r) return false;
  const patch: Partial<Request> = {
    status: to, propertyId: v.propertyId, unit: v.unit || null, price: v.price, commissionPct: v.pct, updatedAt: nowStamp(),
  };
  if (to === "عربون") {
    patch.depositAt = r.depositAt || nowStamp();
    patch.deposit = v.extra ? Number(v.extra) || null : null;
  } else {
    patch.closedAt = v.extra ? new Date(v.extra + "T12:00:00").toISOString() : nowStamp();
    if (!r.depositAt) patch.depositAt = patch.closedAt;
  }
  await write("requests", r.id, patch, "update");
  if (r.propertyId && SOLD_ST.includes(r.status) && (r.propertyId !== v.propertyId || (r.unit || null) !== (v.unit || null)))
    await releaseUnit(d, r.propertyId, r.unit);
  const p = propById(d, v.propertyId);
  await markUnit(d, v.propertyId, v.unit, to === "تم البيع" ? "مباع" : "محجوز");
  if (r.clientId)
    await applyUpdate0(
      d, r.clientId, to === "تم البيع" ? "تم الإغلاق" : "دفع عربون", null,
      (p ? p.title : "") + (v.unit ? " — " + v.unit : "") + " · " + moneyFull(v.price), v.propertyId
    );
  if (to === "تم البيع" && r.clientId) await write("clients", r.clientId, { status: "مغلق" }, "update");
  return true;
}

/** Cancels a deposit/sale: releases the unit, moves the request back, and reopens the client. */
export async function cancelSale(d: CrmData, reqId: string, to: string, note: string) {
  const r = d.requests.find((x) => x.id === reqId);
  if (!r) return false;
  const was = r.status;
  await write("requests", r.id, { status: to, depositAt: null, closedAt: null, deposit: null, updatedAt: nowStamp() }, "update");
  if (r.propertyId) await releaseUnit(d, r.propertyId, r.unit);
  if (r.clientId) {
    const c = clientById(d, r.clientId);
    if (c && c.status === "مغلق") await write("clients", c.id, { status: "نشط" }, "update");
    await applyUpdate0(
      d, r.clientId, "اتصلت عليه", addDays(1),
      "إلغاء " + (was === "تم البيع" ? "البيع" : "العربون") + (note ? ": " + note : ""), r.propertyId || null
    );
  }
  return true;
}

/** Changes a request's stage directly (callers route deposit/sale/cancel through the modals first). */
export async function setReqStage(reqId: string, to: string) {
  await write("requests", reqId, { status: to, updatedAt: nowStamp() }, "update");
}

/** Records that a property was sent to a request's client; nudges early-stage requests forward. */
export async function reqSent(d: CrmData, reqId: string, pid: string) {
  const r = d.requests.find((x) => x.id === reqId);
  if (!r) return;
  if (r.clientId) await applyUpdate(d, r.clientId, "تم إرسال التفاصيل", addDays(3), "", pid);
  const early = ["جديد", "جاري البحث"].includes(r.status || "جديد");
  const sent = [...new Set((r.sent || []).concat(pid))];
  await write("requests", reqId, { sent, updatedAt: nowStamp(), ...(early ? { status: "أرسلنا خيارات" } : {}) }, "update");
}

/** Assigns a client and its open requests (plus `reqId`, if given) to a staff member. */
export async function assignClient(d: CrmData, cid: string | null, uid: string | null, reqId?: string) {
  const c = clientById(d, cid);
  if (c)
    await write(
      "clients", c.id,
      { assignee: uid, assignedAt: nowStamp(), assignedBy: d.uid, unseen: !!uid && uid !== d.uid, escalatedFrom: null, updatedAt: nowStamp() },
      "update"
    );
  const rs = d.requests.filter((r) => (c ? r.clientId === c.id && OPEN_REQ(r) : false) || r.id === reqId);
  for (const r of rs) if (r.assignee !== uid) await write("requests", r.id, { assignee: uid, updatedAt: nowStamp() }, "update");
  return { n: rs.length, name: uid ? nameOf(d, uid) : null };
}

export async function toggleTask(d: CrmData, id: string, done: boolean) {
  await write("tasks", id, { done, doneAt: done ? nowStamp() : null, doneBy: done ? d.uid : null, updatedAt: nowStamp() }, "update");
}
export async function markTasksSeen(d: CrmData) {
  for (const t of d.tasks.filter((x) => x.seen === false && x.assignee === d.uid)) await write("tasks", t.id, { seen: true }, "update");
}

export async function checkIO(uid: string, kind: "in" | "out") {
  const ref = doc(db, "attendance", uid, "days", today());
  if (kind === "in") await setDoc(ref, { date: today(), in: nowStamp(), out: null });
  else await updateDoc(ref, { out: nowStamp() });
}

export async function saveAttendance(uid: string, date: string, inT: string, outT: string, by: string) {
  const mk = (v: string) => (v ? new Date(date + "T" + v + ":00").toISOString() : null);
  await setDoc(doc(db, "attendance", uid, "days", date), { date, in: mk(inT), out: mk(outT), editedBy: by });
}
export const deleteAttendance = (uid: string, date: string) => deleteDoc(doc(db, "attendance", uid, "days", date));

export async function sendChat(d: CrmData, text: string, clientId: string | null) {
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
          at: nowStamp(), byId: d.uid, type: "رجع لمدير المبيعات",
          text: "ما تم التواصل خلال " + days + " أيام من الموعد (كان عند " + nameOf(d, c.assignee) + ")",
        }),
        updatedAt: nowStamp(),
      },
      "update"
    );
    const r = reqsOf(d, c)[0];
    if (r && r.assignee === c.assignee) await write("requests", r.id, { assignee: mgr, updatedAt: nowStamp() }, "update");
  }
  return list.length;
}
