/**
 * Pure business logic for the sales CRM, ported from the original artifact
 * CRM: property↔request matching, the request "journey", visibility rules,
 * the auto-built daily routine, monthly goal pacing, and payroll. Every
 * function takes the loaded data (`CrmData`) explicitly so it stays easy to
 * test and reason about — no Firestore access here (see actions.ts).
 */
import {
  FLOOR_TYPES, NOCALL, OPEN_STAGES, PSTATUS, REQ, SENT_T, SOLD_ST, TEMPS, PRIO,
} from "./constants";
import type {
  AttendanceDay, Client, Demand, Goal, HrFile, PayrollRow, Property, Request, Task, Unit,
} from "./types";
import { addDays, dayDiff, localDay, moneyFull, num, splitList, today, ym } from "./util";
import type { Staff } from "@/lib/types";

export interface CrmData {
  clients: Client[];
  props: Property[];
  requests: Request[];
  tasks: Task[];
  staff: Staff[];
  goals: Goal[];
  att: Record<string, AttendanceDay[]>;
  hr: HrFile[];
  payroll: PayrollRow[];
  uid: string;
  isMgr: boolean;
  isAdmin: boolean;
  /** Manager filter: "" = whole team, "none" = unassigned, otherwise a staff uid. */
  viewAs: string;
}

/* ---------- people ---------- */
export const staffById = (d: CrmData, id: string | null | undefined) => (id ? d.staff.find((s) => s.id === id) : undefined);
export function nameOf(d: CrmData, id: string | null | undefined) {
  if (!id) return "غير مسند";
  const s = staffById(d, id);
  return s?.name || (id === d.uid ? "أنا" : "عضو في الفريق");
}
export const isMgrId = (d: CrmData, id: string | null | undefined) => {
  const s = staffById(d, id);
  return !!s && (s.role === "admin" || s.role === "manager");
};
export const members = (d: CrmData) =>
  d.staff.filter((s) => s.active).map((s) => s.id).sort((a, b) => nameOf(d, a).localeCompare(nameOf(d, b), "ar"));

/* ---------- lookups ---------- */
export const clientById = (d: CrmData, id: string | null | undefined) => (id ? d.clients.find((c) => c.id === id) : undefined);
export const propById = (d: CrmData, id: string | null | undefined) => (id ? d.props.find((p) => p.id === id) : undefined);
export const typesOf = (c: Demand) => (Array.isArray(c.propTypes) ? c.propTypes : []);
export const isActive = (c: Client) => (c.status || "نشط") === "نشط";
export const OPEN_REQ = (r: Request) => !["تم البيع", "ملغي"].includes(r.status || "جديد");
export const comm = (r: { price?: number | null; commissionPct?: number | null }) =>
  ((num(r.price) || 0) * (num(r.commissionPct) ?? 2.5)) / 100;

/* ---------- visibility (employees see their own; managers see all or filter by viewAs) ---------- */
export function visibleClients(d: CrmData) {
  if (d.isMgr)
    return d.viewAs === "none"
      ? d.clients.filter((c) => !c.assignee)
      : d.viewAs
        ? d.clients.filter((c) => c.assignee === d.viewAs)
        : d.clients;
  return d.clients.filter((c) => c.assignee === d.uid);
}
export function visibleRequests(d: CrmData) {
  if (d.isMgr)
    return d.viewAs === "none"
      ? d.requests.filter((r) => !r.assignee)
      : d.viewAs
        ? d.requests.filter((r) => r.assignee === d.viewAs)
        : d.requests;
  return d.requests.filter((r) => r.assignee === d.uid);
}
export function visibleTasks(d: CrmData) {
  if (d.isMgr && !d.viewAs) return d.tasks;
  const who = d.isMgr ? d.viewAs : d.uid;
  return d.tasks.filter((t) => t.assignee === who || (!d.isMgr && t.createdBy === d.uid));
}
export const myTasksOpen = (d: CrmData) => d.tasks.filter((t) => !t.done && t.assignee === d.uid);
export const activeClients = (d: CrmData) => visibleClients(d).filter(isActive);

export function dueCalls(d: CrmData) {
  const t = today();
  return activeClients(d)
    .filter((c) => c.nextCall && c.nextCall <= t)
    .sort(
      (a, b) =>
        (a.nextCall as string).localeCompare(b.nextCall as string) ||
        TEMPS.indexOf(a.temp as never) - TEMPS.indexOf(b.temp as never)
    );
}
export function upcoming(d: CrmData) {
  const t = today(),
    lim = addDays(7);
  return activeClients(d)
    .filter((c) => c.nextCall && c.nextCall > t && c.nextCall <= lim)
    .sort((a, b) => (a.nextCall as string).localeCompare(b.nextCall as string));
}
export const noDate = (d: CrmData) => activeClients(d).filter((c) => !c.nextCall);

/* ---------- requests ---------- */
export function reqsOf(d: CrmData, c: Client) {
  return d.requests
    .filter((r) => r.clientId === c.id && OPEN_REQ(r))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}
/** The client's current demand: their newest open request, falling back to legacy fields on the client. */
export const demandOf = (d: CrmData, c: Client): Demand => reqsOf(d, c)[0] || c;

export function wantLine(d: CrmData, c: Client) {
  const x = demandOf(d, c);
  const ts = typesOf(x);
  return [
    x.purpose && x.purpose !== "شراء" ? x.purpose : "",
    ts.join(" / "),
    x.districts ? splitList(x.districts).slice(0, 2).join("، ") : "",
    x.budget ? money0(x.budget) : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
const money0 = (n: number) => (n >= 1e6 ? Math.round(n / 1e4) / 100 + " مليون" : Math.round(n).toLocaleString("en-US") + " ر.س");

/* ---------- units & matching ---------- */
export const unitsOf = (p: Property): Unit[] =>
  Array.isArray(p.units) ? p.units.filter((u) => u && (u.name || u.price || u.area)) : [];
export const availUnits = (p: Property) => unitsOf(p).filter((u) => (u.status || "متاح") === "متاح");
export function unitView(p: Property, u: Unit): Property & { unit: string } {
  return {
    ...p,
    type: u.type || p.type,
    area: u.area ?? p.area,
    price: u.price ?? p.price,
    bedrooms: u.bedrooms ?? p.bedrooms,
    floor: u.floor || p.floor,
    status: u.status || "متاح",
    units: [],
    unit: u.name || "",
  };
}

export interface Match {
  score: number;
  why: string[];
  unit?: Unit;
  units?: Unit[];
}

export function match(c: Demand, p: Property): Match | null {
  const us = unitsOf(p);
  if (us.length) {
    if ((p.status || "متاح") === "مباع") return null;
    const hits = us
      .map((u) => ({ u, m: match1(c, unitView(p, u)) }))
      .filter((x): x is { u: Unit; m: Match } => !!x.m)
      .sort((a, b) => b.m.score - a.m.score);
    if (!hits.length) return null;
    const best = hits[0];
    return {
      score: best.m.score,
      why: best.m.why.concat(hits.length > 1 ? [hits.length + " وحدات مناسبة"] : ["وحدة " + (best.u.name || "")]),
      unit: best.u,
      units: hits.map((h) => h.u),
    };
  }
  return match1(c, p);
}

function match1(c: Demand, p: Property): Match | null {
  if ((p.status || "متاح") !== "متاح") return null;
  const want = c.purpose === "إيجار" ? "إيجار" : "بيع";
  if (p.purpose && p.purpose !== want) return null;
  let score = 0;
  const why: string[] = [];
  const budget = num(c.budget),
    price = num(p.price);
  if (budget && price) {
    if (price <= budget) {
      score += 40;
      why.push("ضمن الميزانية");
    } else if (price <= budget * 1.1) {
      score += 20;
      why.push("أعلى بـ " + Math.round((price / budget - 1) * 100) + "%");
    } else return null;
  } else score += 10;
  const ds = splitList(c.districts);
  if (ds.length) {
    if (ds.some((x) => String(p.district || "").includes(x) || String(p.title || "").includes(x))) {
      score += 30;
      why.push("الحي مطابق");
    }
  } else score += 10;
  const ts = typesOf(c);
  if (ts.length) {
    if (p.type && ts.includes(p.type)) {
      score += 15;
      why.push(p.type);
    } else if (p.type) return null;
  }
  const am = num(c.areaMin),
    pa = num(p.area);
  if (am && pa) {
    if (pa >= am * 0.95) {
      score += 10;
      why.push(pa + " م²");
    } else score -= 10;
  }
  const fl = Array.isArray(c.floors) ? c.floors : [];
  if (fl.length && p.type && FLOOR_TYPES.includes(p.type) && p.floor) {
    if (fl.includes(p.floor)) {
      score += 5;
      why.push("الدور " + p.floor);
    } else return null;
  }
  const bm = num(c.bedroomsMin),
    pb = num(p.bedrooms);
  if (bm && pb) {
    if (pb >= bm) {
      score += 5;
      why.push(pb + " غرف");
    } else score -= 10;
  }
  return score >= 40 ? { score: Math.min(score, 100), why } : null;
}

export function matchesForReq(d: CrmData, r: Demand) {
  return d.props
    .map((p) => ({ p, m: match(r, p) }))
    .filter((x): x is { p: Property; m: Match } => !!x.m)
    .sort((a, b) => b.m.score - a.m.score);
}
export function matchesFor(d: CrmData, c: Client) {
  const rs = reqsOf(d, c);
  if (!rs.length) return matchesForReq(d, c);
  const best: Record<string, { p: Property; m: Match }> = {};
  rs.forEach((r) =>
    matchesForReq(d, r).forEach((x) => {
      if (!best[x.p.id] || best[x.p.id].m.score < x.m.score) best[x.p.id] = x;
    })
  );
  return Object.values(best).sort((a, b) => b.m.score - a.m.score);
}
export function clientMatchesProp(d: CrmData, c: Client, p: Property) {
  const rs = reqsOf(d, c);
  return rs.length ? rs.some((r) => match(r, p)) : !!match(c, p);
}

/* ---------- property text ---------- */
export function propPrice(p: Property) {
  const us = unitsOf(p);
  if (us.length) {
    const av = availUnits(p);
    const r = range((av.length ? av : us).map((u) => u.price ?? p.price), money0);
    return r ? "من " + r : p.price ? money0(p.price) : "—";
  }
  return p.price ? money0(p.price) : "—";
}
export function propAreas(p: Property) {
  const us = unitsOf(p);
  if (us.length) return range(us.map((u) => u.area ?? p.area), (x) => String(x));
  return p.area ? String(p.area) : "";
}
function range(vals: (number | null | undefined)[], fmt: (n: number) => string) {
  const v = vals.map(num).filter((x): x is number => x != null);
  if (!v.length) return "";
  const a = Math.min(...v),
    b = Math.max(...v);
  return a === b ? fmt(a) : fmt(a) + " – " + fmt(b);
}

export function propSummary(p: Partial<Property>, unitsList?: Unit[] | null) {
  const L: string[] = [];
  if (p.title) L.push(p.title);
  if (unitsList && unitsList.length)
    L.push(
      unitsList
        .map(
          (u) =>
            "• " +
            (u.name || "وحدة") +
            ": " +
            [u.area && u.area + " م²", u.bedrooms && u.bedrooms + " غرف", u.price && moneyFull(num(u.price))]
              .filter(Boolean)
              .join(" · ")
        )
        .join("\n")
    );
  if (p.price) L.push("السعر: " + moneyFull(num(p.price)) + (p.priceNote ? " (" + p.priceNote + ")" : ""));
  const bits = [
    p.district && "حي " + p.district,
    p.area && p.area + " م²",
    p.bedrooms && p.bedrooms + " غرف",
    p.bathrooms && p.bathrooms + " دورات مياه",
    p.facing && "واجهة " + p.facing,
    p.streetWidth && "شارع " + p.streetWidth + "م",
  ].filter(Boolean);
  if (bits.length) L.push(bits.join(" · "));
  if (p.features) L.push(p.features);
  if (p.link) L.push("الموقع: " + p.link);
  if (p.videoLink) L.push(p.videoLink);
  return L.join("\n");
}
export const propMsg = (p: Property, unitsList?: Unit[] | null) =>
  p.waMessage && String(p.waMessage).trim() ? String(p.waMessage).trim() : propSummary(p, unitsList);

/* ---------- request journey ---------- */
export interface Journey {
  c: Client | undefined;
  sent: { at: string; prop?: Property; type?: string } | null;
  visit: { at: string; ok: boolean; prop?: Property; past: boolean } | null;
  visited: { at: string } | null;
}
export function journey(d: CrmData, r: Request): Journey {
  const c = clientById(d, r.clientId);
  const log = c?.log || [];
  const since = String(r.createdAt || "").slice(0, 10);
  const sentLog = log.find((l) => SENT_T.includes(l.type) && String(l.at) >= since);
  const sent = sentLog
    ? { at: sentLog.at, prop: propById(d, sentLog.propertyId), type: sentLog.type }
    : (r.sent || []).length
      ? { at: r.updatedAt, prop: propById(d, r.sent![r.sent!.length - 1]) }
      : null;
  const visit = c?.visitAt
    ? { at: c.visitAt, ok: !!c.visitConfirmed, prop: propById(d, c.visitProperty), past: c.visitAt.slice(0, 10) < today() }
    : null;
  const vl = log.find((l) => l.type === "زار العقار" && String(l.at) >= since);
  return { c, sent, visit, visited: vl ? { at: vl.at } : null };
}
export function followState(d: CrmData, r: Request): "visit" | "sent" | "none" {
  const j = journey(d, r);
  return j.visit || j.visited ? "visit" : j.sent ? "sent" : "none";
}
export const needsSaleInfo = (r: Request) => SOLD_ST.includes(r.status) && (!r.propertyId || !num(r.price));

export function sortRequests(d: CrmData, rs: Request[]) {
  return rs.sort((a, b) => {
    const ca = clientById(d, a.clientId)?.nextCall || "9",
      cb = clientById(d, b.clientId)?.nextCall || "9";
    return (
      PRIO.indexOf(b.priority as never) - PRIO.indexOf(a.priority as never) ||
      ca.localeCompare(cb) ||
      String(a.createdAt).localeCompare(String(b.createdAt))
    );
  });
}
export const stageIndex = (s: string) => REQ.indexOf(s as never);
export { OPEN_STAGES };

/* ---------- today ---------- */
export function calledToday(c: Client) {
  const t = today();
  return (c.log || []).find((l) => localDay(l.at) === t && l.type !== "تأجيل");
}
export function allDistricts(d: CrmData, base: readonly string[]) {
  const s = new Set(base);
  d.props.forEach((p) => p.district && s.add(p.district.trim()));
  d.clients.forEach((c) => splitList(c.districts).forEach((x) => s.add(x)));
  d.requests.forEach((r) => splitList(r.districts).forEach((x) => s.add(x)));
  return [...s];
}

/* ---------- HR / attendance ---------- */
export const hrOf = (d: CrmData, id: string): Partial<HrFile> => d.hr.find((x) => x.id === id) || {};
const mins = (t: string | null | undefined) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t || "");
  return m ? +m[1] * 60 + +m[2] : null;
};
/** Minutes late (counted only past a 15-minute grace period after the shift start). */
export function lateMin(d: CrmData, rec: AttendanceDay | undefined, id: string) {
  if (!rec || !rec.in) return 0;
  const st = mins(hrOf(d, id).workStart || "09:00") ?? 540;
  const t = new Date(rec.in);
  const v = t.getHours() * 60 + t.getMinutes() - st - 15;
  return v > 0 ? v + 15 : 0;
}
export const hoursOf = (rec: AttendanceDay | undefined) =>
  !rec || !rec.in || !rec.out ? 0 : Math.max(0, (new Date(rec.out).getTime() - new Date(rec.in).getTime()) / 36e5);
export const attToday = (d: CrmData, uid: string) => (d.att[uid] || []).find((x) => x.id === today());

/* ---------- sales ---------- */
export const salesOf = (d: CrmData, uid: string, month: string) =>
  d.requests.filter((r) => r.assignee === uid && r.status === "تم البيع" && String(r.closedAt || "").slice(0, 7) === month);

export function payFor(d: CrmData, id: string, month: string) {
  const h = hrOf(d, id),
    pr: Partial<PayrollRow> = d.payroll.find((x) => x.id === month + "_" + id) || {};
  const basic = num(h.salary) || 0,
    allow = (num(h.housing) || 0) + (num(h.transport) || 0) + (num(h.otherAllow) || 0);
  const ds = salesOf(d, id, month);
  const sa3y = ds.reduce((s, r) => s + comm(r), 0);
  const cpct = num(h.commissionPct) || 0;
  const commission = Math.round((sa3y * cpct) / 100);
  const bonus = num(pr.bonus) || 0,
    deduction = num(pr.deduction) || 0;
  return {
    basic, allow, deals: ds.length, sa3y, cpct, commission, bonus, deduction,
    net: basic + allow + commission + bonus - deduction, paid: !!pr.paid, note: pr.note || "",
  };
}

/* ---------- team stats ---------- */
export function statsFor(d: CrmData, id: string) {
  const cs = d.clients.filter((c) => c.assignee === id && isActive(c));
  const t = today();
  const mine = d.requests.filter((r) => r.assignee === id);
  return {
    active: cs.length,
    due: cs.filter((c) => c.nextCall && c.nextCall <= t).length,
    late: cs.filter((c) => c.nextCall && c.nextCall < t).length,
    tasks: d.tasks.filter((x) => !x.done && x.assignee === id).length,
    tlate: d.tasks.filter((x) => !x.done && x.assignee === id && x.due && x.due < t).length,
    deals: mine.filter((r) => ["تفاوض", "عربون"].includes(r.status)).length,
    closed: mine.filter((r) => r.status === "تم البيع").reduce((s, r) => s + comm(r), 0),
  };
}

/* ---------- goals ---------- */
export const goalOf = (d: CrmData, uid: string, month: string) => d.goals.find((g) => g.id === month + "_" + uid) || null;
export function monthInfo(month: string) {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const cur = month === ym(),
    past = month < ym();
  const elapsed = cur ? new Date().getDate() : past ? days : 0;
  return { days, elapsed, left: cur ? days - elapsed : 0, cur };
}
export function actualsFor(d: CrmData, uid: string, month: string) {
  const inM = (s: string | null | undefined) => String(s || "").slice(0, 7) === month;
  const t = today();
  let calls = 0,
    callsToday = 0,
    visits = 0;
  for (const c of d.clients)
    for (const l of c.log || []) {
      if (l.byId !== uid || !l.at) continue;
      const day = localDay(l.at);
      if (day.slice(0, 7) !== month) continue;
      if (!NOCALL.includes(l.type)) {
        calls++;
        if (day === t) callsToday++;
      }
      if (l.type === "زار العقار") visits++;
    }
  const mine = d.requests.filter((r) => r.assignee === uid);
  const reqs = mine.filter((r) => inM(r.createdAt)).length;
  const deals = mine.filter((r) => SOLD_ST.includes(r.status) && (inM(r.depositAt) || inM(r.closedAt))).length;
  const commission = mine.filter((r) => r.status === "تم البيع" && inM(r.closedAt)).reduce((s, r) => s + comm(r), 0);
  const mi = monthInfo(month);
  return {
    calls, callsToday, reqs, visits, deals, commission,
    callsAvg: mi.elapsed ? Math.round((calls / mi.elapsed) * 10) / 10 : 0,
  };
}
export type Pace = "ok" | "warn" | "bad";
export function pace(actual: number, target: number | null, month: string): Pace | null {
  if (!target) return null;
  const mi = monthInfo(month);
  const expect = target * (mi.elapsed / mi.days);
  if (actual >= target || !expect) return "ok";
  const r = actual / expect;
  return r >= 0.9 ? "ok" : r >= 0.6 ? "warn" : "bad";
}
export const PACE_TXT: Record<Pace, string> = { ok: "ماشي صح", warn: "تحتاج تسرّع", bad: "متأخر" };
export const fmtK = (k: string, v: number) =>
  k === "commission" ? (v >= 1000 ? Math.round(v / 1000) + " ألف" : String(Math.round(v))) : String(v);
export const goalVals = (a: ReturnType<typeof actualsFor>) => ({
  calls: a.callsAvg, reqs: a.reqs, visits: a.visits, deals: a.deals, commission: a.commission,
});

/* ---------- daily routine (auto-built from the employee's own data) ---------- */
export interface PlanItem {
  sec: "الصباح" | "خلال اليوم" | "آخر اليوم";
  k: string;
  label: string;
  left: number;
  total: number;
  done: boolean;
  hint: string;
}
export function planFor(d: CrmData, uid: string, hmFmt: (s: string | null) => string): PlanItem[] {
  const t = today(),
    tm = addDays(1);
  const mine = d.clients.filter((c) => c.assignee === uid && isActive(c));
  const touched = (c: Client) => (c.log || []).some((l) => l.byId === uid && localDay(l.at) === t && !NOCALL.includes(l.type));
  const att = (d.att[uid] || []).find((x) => x.id === t);
  const dueNow = mine.filter((c) => c.nextCall && c.nextCall <= t);
  const lateN = dueNow.filter((c) => (c.nextCall as string) < t).length;
  const calledN = mine.filter((c) => touched(c) && !(c.nextCall && c.nextCall <= t)).length;
  const tmV = mine.filter((c) => c.visitAt && c.visitAt.slice(0, 10) === tm);
  const tmLeft = tmV.filter((c) => !c.visitConfirmed).length;
  const pastV = mine.filter((c) => c.visitAt && c.visitAt.slice(0, 10) < t).length;
  const visitedToday = d.clients.reduce(
    (n, c) => n + (c.log || []).filter((l) => l.byId === uid && l.type === "زار العقار" && localDay(l.at) === t).length,
    0
  );
  const myReq = d.requests.filter((r) => r.assignee === uid && OPEN_REQ(r));
  const fresh = myReq.filter((r) => (r.status || "جديد") === "جديد");
  const freshLeft = fresh.filter((r) => {
    const c = clientById(d, r.clientId);
    return !c || !(c.log || []).some((l) => String(l.at) >= String(r.createdAt || ""));
  }).length;
  const toSend = myReq.filter((r) => followState(d, r) === "none" && d.props.some((p) => match(r, p))).length;
  const sentToday = d.clients.reduce(
    (n, c) =>
      n + (c.assignee === uid ? (c.log || []).filter((l) => l.byId === uid && SENT_T.includes(l.type) && localDay(l.at) === t).length : 0),
    0
  );
  const tasks = d.tasks.filter((x) => x.assignee === uid && x.due && x.due <= t);
  const tasksLeft = tasks.filter((x) => !x.done).length;
  const I: PlanItem[] = [];
  const add = (sec: PlanItem["sec"], k: string, label: string, left: number, total: number, hint: string) => {
    if (total > 0) I.push({ sec, k, label, left, total, done: left === 0, hint });
  };
  add("الصباح", "checkin", "سجّل حضورك", att ? 0 : 1, 1, att ? "حضرت " + hmFmt(att.in) : "");
  add("الصباح", "late", "اتصل على المتأخرين", lateN, lateN + (lateN ? 0 : calledN ? 1 : 0), lateN ? lateN + " عميل" : "خلصتهم");
  add("الصباح", "confirm", "أكّد زيارات بكرة", tmLeft, tmV.length, tmV.length - tmLeft + " من " + tmV.length + " مؤكدة");
  add("الصباح", "fresh", "تواصل مع الطلبات الجديدة", freshLeft, fresh.length && freshLeft ? freshLeft : 0, freshLeft + " طلب ما أحد كلمهم");
  add("خلال اليوم", "calls", "مكالمات اليوم", dueNow.length, dueNow.length + calledN, calledN + " من " + (dueNow.length + calledN) + " تمت");
  add("خلال اليوم", "send", "أرسل عقارات تناسب عملاء ما انرسل لهم شي", toSend, toSend + sentToday, toSend ? toSend + " طلب له عقار مناسب" : "أرسلت " + sentToday);
  add("خلال اليوم", "tasks", "المهام المطلوبة", tasksLeft, tasks.length, tasks.length - tasksLeft + " من " + tasks.length);
  add("آخر اليوم", "outcome", "سجّل نتيجة الزيارات", pastV, pastV + visitedToday, pastV ? pastV + " زيارة بدون نتيجة" : "تمت");
  add("آخر اليوم", "checkout", "سجّل انصرافك", att && att.out ? 0 : 1, att ? 1 : 0, att && att.out ? "انصرفت " + hmFmt(att.out) : "");
  return I;
}

/* ---------- misc ---------- */
export const findByPhone = (d: CrmData, norm: (p: string | null | undefined) => string | null, p: string, exceptId?: string | null) => {
  const n = norm(p);
  if (!n) return null;
  return d.clients.find((c) => c.id !== exceptId && norm(c.phone) === n) || null;
};
export const isLate = (date: string | null | undefined) => (dayDiff(date) ?? 0) < 0;
export { PSTATUS };
