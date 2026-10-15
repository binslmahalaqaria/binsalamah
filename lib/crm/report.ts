/**
 * Per-employee performance over a period (shared by لوحة المدير and the printable
 * report): activity from client logs and requests, attendance days / late days /
 * hours, active and overdue clients, today's routine, and this month's goal pace.
 * "منذ المباشرة" runs from each person's HR start date (or first appearance).
 */
import {
  absentDays, activityFor, actualsFor, overtimeMin, attToday, goalOf, goalVals, hoursOf, hrOf, isActive, lateMin, nameOf, pace, planFor, type CrmData, type Pace,
} from "./logic";
import { addDays, hm, today, ym } from "./util";

export type Period = "today" | "week" | "month" | "hire" | "custom";
export const PERIOD_AR: Record<Period, string> = { today: "اليوم", week: "آخر 7 أيام", month: "هذا الشهر", hire: "منذ المباشرة", custom: "فترة محددة" };

/** Date range per employee: "منذ المباشرة" starts at the HR file's start date (or the first day they appear in the data). */
export function rangeFor(d: CrmData, id: string, p: Period, custom: [string, string]): [string, string] {
  const t = today();
  if (p === "today") return [t, t];
  if (p === "week") return [addDays(-6), t];
  if (p === "month") return [ym() + "-01", t];
  if (p === "custom") return custom;
  return [hrOf(d, id).hireDate || firstSeen(d, id) || t, t];
}
/** Earliest day this person shows up (attendance, a log entry, or a request) — used when no start date is on file. */
export function firstSeen(d: CrmData, id: string) {
  const days = [
    ...(d.att[id] || []).map((a) => a.id),
    ...d.clients.flatMap((c) => (c.log || []).filter((l) => l.byId === id).map((l) => String(l.at).slice(0, 10))),
    ...d.requests.filter((r) => r.assignee === id).map((r) => String(r.createdAt).slice(0, 10)),
  ].filter(Boolean).sort();
  return days[0] || null;
}

export interface Row {
  id: string;
  calls: number;
  /** Calls where the client answered (every logged call except "لم يرد"). */
  answered: number;
  noAnswer: number;
  visits: number;
  sent: number;
  reqs: number;
  deposits: number;
  sales: number;
  commission: number;
  active: number;
  late: number;
  tasksLate: number;
  plan: [number, number];
  att: string;
  attLate: number;
  pace: Pace | null;
  from: string;
  to: string;
  attDays: number;
  attLateDays: number;
  /** Total minutes late over the range. */
  attLateMin: number;
  /** Overtime minutes and working days without a check-in over the range. */
  overtime: number;
  absent: number;
  hours: number;
  name: string;
}

export function scoreboard(d: CrmData, ids: string[], p: Period, custom: [string, string]): Row[] {
  const t = today();
  return ids.map((id) => {
    const [from, to] = rangeFor(d, id, p, custom);
    const act = activityFor(d, id, from, to);
    const days = (d.att[id] || []).filter((x) => x.id >= from && x.id <= to && x.in);
    const cs = d.clients.filter((c) => c.assignee === id && isActive(c));
    const plan = planFor(d, id, hm);
    const a = attToday(d, id);
    // Worst goal pace this month across the goals that are set.
    const g = goalOf(d, id, ym());
    let worst: Pace | null = null;
    if (g) {
      const v = goalVals(actualsFor(d, id, ym()));
      const rank: Record<Pace, number> = { ok: 0, warn: 1, bad: 2 };
      (["reqs", "visits", "deals", "commission"] as const).forEach((k) => {
        const st = pace(v[k], g[k], ym());
        if (st && (worst == null || rank[st] > rank[worst])) worst = st;
      });
    }
    return {
      id, calls: act.calls, answered: act.answered, noAnswer: act.calls - act.answered, visits: act.visits, sent: act.sent, reqs: act.reqs,
      deposits: act.deposits.length,
      sales: act.sales.length,
      commission: act.commission,
      active: cs.length,
      late: cs.filter((c) => c.nextCall && c.nextCall < t).length,
      tasksLate: d.tasks.filter((x) => !x.done && x.assignee === id && x.due && x.due < t).length,
      plan: [plan.filter((x) => x.done).length, plan.length],
      att: a ? hm(a.in) + (a.out ? " – " + hm(a.out) : "") : "",
      attLate: lateMin(d, a, id),
      pace: worst,
      from, to,
      attDays: days.length,
      attLateDays: days.filter((x) => lateMin(d, x, id) > 0).length,
      attLateMin: days.reduce((m, x) => m + lateMin(d, x, id), 0),
      overtime: days.reduce((m, x) => m + overtimeMin(d, x, id), 0),
      absent: absentDays(d, id, from, to),
      hours: Math.round(days.reduce((s2, x) => s2 + hoursOf(x), 0)),
      name: nameOf(d, id),
    };
  });
}

