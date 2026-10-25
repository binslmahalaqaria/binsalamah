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
import { Link, useRouter } from "@/i18n/navigation";
import { useCrm } from "@/lib/crm/store";
import { OPEN_STAGES, REQ_TONE, lbl } from "@/lib/crm/constants";
import { attToday, fmtDur, hrOf, isActive, members, nameOf } from "@/lib/crm/logic";
import { PERIOD_AR, scoreboard, type Period, type Row } from "@/lib/crm/report";
import { fmtStamp, money, today, ym } from "@/lib/crm/util";
import { ManagerTabs } from "@/components/crm/PageTabs";
import { Empty, PageHeader, Pill } from "@/components/crm/ui";
import { CallLog, type CallFilter } from "@/components/crm/CallLog";

function Tile({ v, l, gold, onClick }: { v: string | number; l: string; gold?: boolean; onClick?: () => void }) {
  const body = (
    <>
      <b className={"num font-heading text-[26px] " + (gold ? "text-[var(--crm-gold-ink)]" : "")}>{v}</b>
      <span className="text-[12.5px] text-[var(--crm-ink-3)]">{l}{onClick && " ←"}</span>
    </>
  );
  return onClick
    ? <button type="button" onClick={onClick} className="crm-card flex flex-col-reverse gap-0.5 px-4 py-3.5 text-start hover:border-[var(--crm-ink-3)]">{body}</button>
    : <div className="crm-card flex flex-col-reverse gap-0.5 px-4 py-3.5">{body}</div>;
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
  const [custom, setCustom] = useState<[string, string]>(() => [ym() + "-01", today()]);
  const [callF, setCallF] = useState<CallFilter>("all");
  // The call tiles open the call log below, filtered.
  const showCalls = (f: CallFilter) => { setCallF(f); setTimeout(() => document.getElementById("calls")?.scrollIntoView({ behavior: "smooth" }), 0); };

  if (!loaded) return <Empty>جارٍ تحميل البيانات…</Empty>;
  if (!data.isMgr) return <Empty>هذه الصفحة مخصصة للمدير والمالك فقط.</Empty>;

  const ids = members(data);
  const rows = scoreboard(data, ids, period, custom).sort((a, b) => Number(b[sortK]) - Number(a[sortK]));
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
      <ManagerTabs />
      <PageHeader eyebrow="الفريق" title="لوحة المدير" sub="أداء الفريق وما يحتاج إلى متابعة"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="crm-seg">
              {(Object.keys(PERIOD_AR) as Period[]).map((p) => (
                <button key={p} type="button" className={period === p ? "on" : ""} onClick={() => setPeriod(p)}>{PERIOD_AR[p]}</button>
              ))}
            </div>
            {period === "custom" && (
              <span className="flex items-center gap-1.5 text-[13px]">
                من <input type="date" className="!w-auto" value={custom[0]} max={custom[1]} onChange={(e) => e.target.value && setCustom([e.target.value, custom[1]])} />
                إلى <input type="date" className="!w-auto" value={custom[1]} min={custom[0]} onChange={(e) => e.target.value && setCustom([custom[0], e.target.value])} />
              </span>
            )}
            <Link className="crm-btn primary" href={"/admin/report?p=" + period + (period === "custom" ? "&from=" + custom[0] + "&to=" + custom[1] : "")}>📄 التقرير الاحترافي</Link>
          </div>
        } />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        <Tile v={sum("calls")} l="مكالمات" onClick={() => showCalls("all")} />
        <Tile v={sum("answered") + (sum("calls") ? " (" + Math.round((sum("answered") / sum("calls")) * 100) + "%)" : "")} l="مكالمات ناجحة" onClick={() => showCalls("ok")} />
        <Tile v={sum("noAnswer")} l="مكالمات غير ناجحة" onClick={() => showCalls("no")} />
        <Tile v={sum("visits")} l="زيارات" />
        <Tile v={sum("sent")} l="عروض مُرسلة" />
        <Tile v={sum("reqs")} l="طلبات جديدة" />
        <Tile v={sum("deposits") + " / " + sum("sales")} l="عربون / بيع" />
        <Tile gold v={money(sum("commission"))} l="سعي محصّل" />
      </div>

      <div className="mb-2 flex items-baseline gap-2.5"><h2 className="text-[15.5px]">أداء الموظفين — {PERIOD_AR[period]}</h2><span className="muted text-xs">اضغط على عنوان العمود للترتيب، وعلى اسم الموظف لعرض أعماله</span></div>
      <div className="crm-card mb-5 overflow-x-auto p-1.5">
        <table className="crm-table min-w-[980px]">
          <thead>
            <tr>
              <th>الموظف</th>
              <TH k="calls" {...sortProps}>مكالمات</TH><TH k="answered" {...sortProps}>ناجحة</TH><TH k="noAnswer" {...sortProps}>غير ناجحة</TH><TH k="visits" {...sortProps}>زيارات</TH><TH k="sent" {...sortProps}>إرسال</TH><TH k="reqs" {...sortProps}>طلبات</TH>
              <TH k="deposits" {...sortProps}>عربون</TH><TH k="sales" {...sortProps}>بيع</TH><TH k="commission" {...sortProps}>السعي</TH>
              <TH k="active" {...sortProps}>عملاء نشطون</TH><TH k="late" {...sortProps}>المتأخرون</TH>
              {period === "today" ? <><th>روتين اليوم</th><th>الحضور</th></> : <><TH k="attDays" {...sortProps}>أيام الحضور</TH><TH k="attLateDays" {...sortProps}>أيام التأخير</TH><TH k="hours" {...sortProps}>ساعات العمل</TH></>}
              <th>الأهداف</th>
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
                    {period !== "today" && <div className="num muted text-[11.5px]">{r.from} ← {r.to}{period === "hire" && !hrOf(data, r.id).hireDate ? " (أول ظهور)" : ""}</div>}
                  </td>
                  <td>
                    <div className="flex min-w-[90px] items-center gap-2">
                      <b className="num w-6">{r.calls}</b>
                      <span className="crm-bar h-1.5 flex-1"><i style={{ width: Math.round((r.calls / maxCalls) * 100) + "%" }} /></span>
                    </div>
                  </td>
                  <td className="num">{r.answered}{r.calls ? <span className="muted text-[11px]"> ({Math.round((r.answered / r.calls) * 100)}%)</span> : null}</td>
                  <td className={"num " + (r.noAnswer ? "text-[var(--crm-danger)]" : "")}>{r.noAnswer}</td>
                  <td className="num">{r.visits}</td>
                  <td className="num">{r.sent}</td>
                  <td className="num">{r.reqs}</td>
                  <td className="num">{r.deposits}</td>
                  <td className="num">{r.sales}</td>
                  <td className="num text-[var(--crm-gold-ink)]">{money(r.commission)}</td>
                  <td className="num">{r.active}</td>
                  <td className={"num " + (r.late ? "font-semibold text-[var(--crm-danger)]" : "")}>{r.late}{r.tasksLate > 0 && <span className="muted text-[11.5px]"> · {r.tasksLate} مهام</span>}</td>
                  {period === "today" ? (<>
                  <td>
                    {r.plan[1] ? (
                      <div className="flex min-w-[90px] items-center gap-2">
                        <span className="num text-[12.5px]">{r.plan[0]}/{r.plan[1]}</span>
                        <span className="crm-bar ok h-1.5 flex-1"><i style={{ width: Math.round((r.plan[0] / r.plan[1]) * 100) + "%" }} /></span>
                      </div>
                    ) : "—"}
                  </td>
                  <td>{r.att ? <span className="text-[12.5px]">{r.att}{r.attLate > 0 && <> <Pill tone="warm">متأخر {fmtDur(r.attLate)}</Pill></>}</span> : <Pill tone="hot">لم يحضر</Pill>}</td>
                  </>) : (<>
                    <td className="num">{r.attDays}</td>
                    <td className={"num " + (r.attLateDays ? "text-[var(--crm-warn)]" : "")}>{r.attLateDays}</td>
                    <td className="num">{r.hours}</td>
                  </>)}
                  <td>{r.pace === "bad" ? <Pill tone="hot">متأخر</Pill> : r.pace === "warn" ? <Pill tone="warm">يحتاج إلى متابعة</Pill> : r.pace === "ok" ? <Pill tone="ok">على المسار الصحيح</Pill> : <Pill tone="muted">بدون أهداف</Pill>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <CallLog period={period} custom={custom} filter={callF} setFilter={setCallF} />

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="crm-card grid content-start gap-2.5 p-4">
          <h2 className="text-[15.5px]">الطلبات قيد المتابعة حسب المرحلة <span className="num muted text-sm">({openReqs.length})</span></h2>
          {stageCount.map(([st, n]) => (
            <div key={st} className="grid grid-cols-[110px_1fr_32px] items-center gap-2.5 text-[13.5px]">
              <Pill tone={REQ_TONE[st]}>{lbl(st)}</Pill>
              <span className="crm-bar"><i style={{ width: Math.round((n / maxStage) * 100) + "%" }} /></span>
              <b className="num text-end">{n}</b>
            </div>
          ))}
          <button type="button" className="crm-btn sm justify-self-start" onClick={() => router.push("/admin/requests")}>فتح الطلبات</button>
        </section>

        <section className="crm-card grid content-start gap-2.5 p-4">
          <h2 className="text-[15.5px]">يحتاج إلى متابعة الآن</h2>
          {[
            [absent.length, "موظف لم يسجّل حضوره اليوم", absent.map((id) => nameOf(data, id)).join("، ")],
            [lateClients.length, "عميل تأخر الاتصال به", ""],
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
              <span className="muted text-xs">أكثر العملاء تأخراً:</span>
              {lateClients.slice(0, 6).map((c) => (
                <div key={c.id} className="flex cursor-pointer justify-between gap-2 rounded-md px-1.5 py-1 text-[13px] hover:bg-[var(--crm-surface-2)]" onClick={() => openClient(c.id)}>
                  <span>{c.name} <span className="muted">· {nameOf(data, c.assignee)}</span></span>
                  <span className="text-[var(--crm-danger)]">{c.nextCall}</span>
                </div>
              ))}
            </div>
          )}
          {unassigned.length > 0 && (
            <button type="button" className="crm-btn sm justify-self-start" onClick={() => { setViewAs("none"); router.push("/admin/clients"); }}>توزيع غير المسندين</button>
          )}
        </section>
      </div>
    </>
  );
}
