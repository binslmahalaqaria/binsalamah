"use client";

/**
 * "لوحة المدير" — team performance at a glance for managers/owner: period
 * totals, a per-employee scoreboard (calls, visits, sent offers, new
 * requests, deposits, sales, commission, routine, attendance, goal pace),
 * the request pipeline, and what needs attention right now (overdue calls,
 * overdue tasks, missed visits, unassigned clients, absent staff).
 * Everything is computed from the same live data as the rest of the CRM.
 */
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useCrm } from "@/lib/crm/store";
import { NOCALL, OPEN_STAGES, REQ_TONE, SENT_T } from "@/lib/crm/constants";
import {
  actualsFor, attToday, comm, goalOf, goalVals, isActive, lateMin, members, nameOf, pace, planFor, type CrmData, type Pace,
} from "@/lib/crm/logic";
import { addDays, fmtStamp, hm, localDay, money, today, ym } from "@/lib/crm/util";
import { Empty, PageHeader, Pill } from "@/components/crm/ui";

type Period = "today" | "week" | "month";
const PERIOD_AR: Record<Period, string> = { today: "اليوم", week: "آخر 7 أيام", month: "هذا الشهر" };

function range(p: Period): [string, string] {
  const t = today();
  if (p === "today") return [t, t];
  if (p === "week") return [addDays(-6), t];
  return [ym() + "-01", t];
}

interface Row {
  id: string;
  calls: number;
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
}

function scoreboard(d: CrmData, ids: string[], p: Period): Row[] {
  const [from, to] = range(p);
  const inR = (s: string | null | undefined) => {
    const x = localDay(s);
    return !!x && x >= from && x <= to;
  };
  const t = today();
  return ids.map((id) => {
    let calls = 0, visits = 0, sent = 0;
    for (const c of d.clients)
      for (const l of c.log || []) {
        if (l.byId !== id || !inR(l.at)) continue;
        if (!NOCALL.includes(l.type)) calls++;
        if (l.type === "زار العقار") visits++;
        if (SENT_T.includes(l.type)) sent++;
      }
    const mine = d.requests.filter((r) => r.assignee === id);
    const soldR = mine.filter((r) => r.status === "تم البيع" && inR(r.closedAt));
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
      id, calls, visits, sent,
      reqs: mine.filter((r) => inR(r.createdAt)).length,
      deposits: mine.filter((r) => inR(r.depositAt) && ["عربون", "تم البيع"].includes(r.status)).length,
      sales: soldR.length,
      commission: soldR.reduce((s, r) => s + comm(r), 0),
      active: cs.length,
      late: cs.filter((c) => c.nextCall && c.nextCall < t).length,
      tasksLate: d.tasks.filter((x) => !x.done && x.assignee === id && x.due && x.due < t).length,
      plan: [plan.filter((x) => x.done).length, plan.length],
      att: a ? hm(a.in) + (a.out ? " – " + hm(a.out) : "") : "",
      attLate: lateMin(d, a, id),
      pace: worst,
    };
  });
}

function Tile({ v, l, gold }: { v: string | number; l: string; gold?: boolean }) {
  return (
    <div className="crm-card flex flex-col-reverse gap-0.5 px-4 py-3.5">
      <b className={"num font-heading text-[26px] " + (gold ? "text-[var(--crm-gold-ink)]" : "")}>{v}</b>
      <span className="text-[12.5px] text-[var(--crm-ink-3)]">{l}</span>
    </div>
  );
}

function TH({ k, cur, set, children }: { k: keyof Row; cur: keyof Row; set: (k: keyof Row) => void; children: React.ReactNode }) {
  return (
    <th>
      <button type="button" className={"font-medium " + (cur === k ? "text-[var(--crm-ink)] underline" : "")} onClick={() => set(k)}>{children}</button>
    </th>
  );
}

export default function ManagerPage() {
  const { data, loaded, setViewAs, openClient } = useCrm();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("today");
  const [sortK, setSortK] = useState<keyof Row>("calls");

  if (!loaded) return <Empty>جاري تحميل البيانات…</Empty>;
  if (!data.isMgr) return <Empty>هذي الصفحة للمدير والمالك بس.</Empty>;

  const ids = members(data);
  const rows = scoreboard(data, ids, period).sort((a, b) => Number(b[sortK]) - Number(a[sortK]));
  const sum = (k: keyof Row) => rows.reduce((s, r) => s + Number(r[k]), 0);
  const maxCalls = Math.max(1, ...rows.map((r) => r.calls));
  const t = today();

  // Pipeline: open requests by stage across the whole team.
  const openReqs = data.requests.filter((r) => OPEN_STAGES.includes(r.status as never) || !r.status);
  const stageCount = OPEN_STAGES.map((st) => [st, openReqs.filter((r) => (r.status || "جديد") === st).length] as const);
  const maxStage = Math.max(1, ...stageCount.map(([, n]) => n));

  // Attention list.
  const lateClients = data.clients.filter((c) => isActive(c) && c.nextCall && c.nextCall < t).sort((a, b) => (a.nextCall as string).localeCompare(b.nextCall as string));
  const missedVisits = data.clients.filter((c) => isActive(c) && c.visitAt && c.visitAt.slice(0, 10) < t);
  const unassigned = data.clients.filter((c) => isActive(c) && !c.assignee);
  const absent = ids.filter((id) => !attToday(data, id));
  const lateTasks = data.tasks.filter((x) => !x.done && x.due && x.due < t);

  const view = (id: string) => {
    setViewAs(id);
    router.push("/admin");
  };

  const sortProps = { cur: sortK, set: setSortK };

  return (
    <>
      <PageHeader eyebrow="الفريق" title="لوحة المدير" sub="أداء الفريق وش يحتاج متابعة"
        action={
          <div className="crm-seg">
            {(Object.keys(PERIOD_AR) as Period[]).map((p) => (
              <button key={p} type="button" className={period === p ? "on" : ""} onClick={() => setPeriod(p)}>{PERIOD_AR[p]}</button>
            ))}
          </div>
        } />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Tile v={sum("calls")} l="مكالمات" />
        <Tile v={sum("visits")} l="زيارات" />
        <Tile v={sum("sent")} l="عروض انرسلت" />
        <Tile v={sum("reqs")} l="طلبات جديدة" />
        <Tile v={sum("deposits") + " / " + sum("sales")} l="عربون / بيع" />
        <Tile gold v={money(sum("commission"))} l="سعي محصّل" />
      </div>

      <div className="mb-2 flex items-baseline gap-2.5"><h2 className="text-[15.5px]">أداء الموظفين — {PERIOD_AR[period]}</h2><span className="muted text-xs">اضغط عنوان العمود للترتيب، واسم الموظف تشوف شغله</span></div>
      <div className="crm-card mb-5 overflow-x-auto p-1.5">
        <table className="crm-table min-w-[980px]">
          <thead>
            <tr>
              <th>الموظف</th>
              <TH k="calls" {...sortProps}>مكالمات</TH><TH k="visits" {...sortProps}>زيارات</TH><TH k="sent" {...sortProps}>إرسال</TH><TH k="reqs" {...sortProps}>طلبات</TH>
              <TH k="deposits" {...sortProps}>عربون</TH><TH k="sales" {...sortProps}>بيع</TH><TH k="commission" {...sortProps}>السعي</TH>
              <TH k="active" {...sortProps}>عملاء نشطين</TH><TH k="late" {...sortProps}>متأخرين</TH><th>روتين اليوم</th><th>الحضور</th><th>الأهداف</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const s = data.staff.find((x) => x.id === r.id);
              return (
                <tr key={r.id}>
                  <td>
                    <b className="link" onClick={() => view(r.id)}>{nameOf(data, r.id)}</b>
                    {s?.lastSeen && <div className="muted text-[11.5px]">آخر دخول {fmtStamp(s.lastSeen)}</div>}
                  </td>
                  <td>
                    <div className="flex min-w-[90px] items-center gap-2">
                      <b className="num w-6">{r.calls}</b>
                      <span className="crm-bar h-1.5 flex-1"><i style={{ width: Math.round((r.calls / maxCalls) * 100) + "%" }} /></span>
                    </div>
                  </td>
                  <td className="num">{r.visits}</td>
                  <td className="num">{r.sent}</td>
                  <td className="num">{r.reqs}</td>
                  <td className="num">{r.deposits}</td>
                  <td className="num">{r.sales}</td>
                  <td className="num text-[var(--crm-gold-ink)]">{money(r.commission)}</td>
                  <td className="num">{r.active}</td>
                  <td className={"num " + (r.late ? "font-semibold text-[var(--crm-danger)]" : "")}>{r.late}{r.tasksLate > 0 && <span className="muted text-[11.5px]"> · {r.tasksLate} مهام</span>}</td>
                  <td>
                    {r.plan[1] ? (
                      <div className="flex min-w-[90px] items-center gap-2">
                        <span className="num text-[12.5px]">{r.plan[0]}/{r.plan[1]}</span>
                        <span className="crm-bar ok h-1.5 flex-1"><i style={{ width: Math.round((r.plan[0] / r.plan[1]) * 100) + "%" }} /></span>
                      </div>
                    ) : "—"}
                  </td>
                  <td>{r.att ? <span className="text-[12.5px]">{r.att}{r.attLate > 0 && <> <Pill tone="warm">متأخر {r.attLate}د</Pill></>}</span> : <Pill tone="hot">ما حضر</Pill>}</td>
                  <td>{r.pace === "bad" ? <Pill tone="hot">متأخر</Pill> : r.pace === "warn" ? <Pill tone="warm">يحتاج متابعة</Pill> : r.pace === "ok" ? <Pill tone="ok">ماشي صح</Pill> : <Pill tone="muted">بدون أهداف</Pill>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="crm-card grid content-start gap-2.5 p-4">
          <h2 className="text-[15.5px]">الطلبات المفتوحة حسب المرحلة <span className="num muted text-sm">({openReqs.length})</span></h2>
          {stageCount.map(([st, n]) => (
            <div key={st} className="grid grid-cols-[110px_1fr_32px] items-center gap-2.5 text-[13.5px]">
              <Pill tone={REQ_TONE[st]}>{st}</Pill>
              <span className="crm-bar"><i style={{ width: Math.round((n / maxStage) * 100) + "%" }} /></span>
              <b className="num text-end">{n}</b>
            </div>
          ))}
          <button type="button" className="crm-btn sm justify-self-start" onClick={() => router.push("/admin/requests")}>افتح الطلبات</button>
        </section>

        <section className="crm-card grid content-start gap-2.5 p-4">
          <h2 className="text-[15.5px]">يحتاج متابعة الحين</h2>
          {[
            [absent.length, "موظف ما سجّل حضور اليوم", absent.map((id) => nameOf(data, id)).join("، ")],
            [lateClients.length, "عميل متأخر الاتصال عليه", ""],
            [missedVisits.length, "زيارة فاتت بدون نتيجة", ""],
            [lateTasks.length, "مهمة متأخرة", ""],
            [unassigned.length, "عميل غير مسند", ""],
          ].map(([n, l, extra]) => (
            <div key={String(l)} className={"flex flex-wrap items-baseline gap-2 rounded-lg px-3 py-2 text-[13.5px] " + (Number(n) ? "bg-[var(--crm-warn-soft)] text-[var(--crm-warn)]" : "bg-[var(--crm-surface-2)] text-[var(--crm-ink-3)]")}>
              <b className="num">{n}</b> {l}{extra && <span className="text-[12.5px]">: {extra}</span>}
            </div>
          ))}
          {lateClients.length > 0 && (
            <div className="grid gap-1 border-t border-[var(--crm-line)] pt-2">
              <span className="muted text-xs">أكثر العملاء تأخير:</span>
              {lateClients.slice(0, 6).map((c) => (
                <div key={c.id} className="flex cursor-pointer justify-between gap-2 rounded-md px-1.5 py-1 text-[13px] hover:bg-[var(--crm-surface-2)]" onClick={() => openClient(c.id)}>
                  <span>{c.name} <span className="muted">· {nameOf(data, c.assignee)}</span></span>
                  <span className="text-[var(--crm-danger)]">{c.nextCall}</span>
                </div>
              ))}
            </div>
          )}
          {unassigned.length > 0 && (
            <button type="button" className="crm-btn sm justify-self-start" onClick={() => { setViewAs("none"); router.push("/admin/clients"); }}>وزّع غير المسندين</button>
          )}
        </section>
      </div>
    </>
  );
}
