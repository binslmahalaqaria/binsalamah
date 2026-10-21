"use client";

/**
 * "تقرير الأداء" — a printable, branded performance report (managers/owner):
 * team KPIs, comparison charts and a card per employee for a chosen period
 * (today, 7 days, this month, since each person's start date, or a custom
 * range). Laid out as A4 pages; "طباعة / حفظ PDF" uses the browser's print
 * dialog, and the print stylesheet hides everything but the report.
 */
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCrm } from "@/lib/crm/store";
import { fmtDur, members, nameOf } from "@/lib/crm/logic";
import { PERIOD_AR, scoreboard, type Period, type Row } from "@/lib/crm/report";
import { fmtStamp, money, nowStamp, today, ym } from "@/lib/crm/util";
import { ManagerTabs } from "@/components/crm/PageTabs";
import { Empty } from "@/components/crm/ui";

const ROLE_AR: Record<string, string> = { admin: "المالك", manager: "مدير مبيعات", sales: "موظف مبيعات" };
const GOLD = "#b8b8b8", INK = "#333333";
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const fmtDate = (s: string) => { const [y, m, d] = s.split("-"); return d && m && y ? +d + "/" + +m + "/" + y : s; };
const daysBetween = (a: string, b: string) => Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 864e5) + 1);

export default function ReportPage() {
  return <Suspense fallback={<Empty>جارٍ تجهيز التقرير…</Empty>}><Report /></Suspense>;
}

function Report() {
  const { data, loaded } = useCrm();
  const sp = useSearchParams();
  const p0 = sp.get("p") as Period | null;
  const [period, setPeriod] = useState<Period>(p0 && p0 in PERIOD_AR ? p0 : "month");
  const [custom, setCustom] = useState<[string, string]>([sp.get("from") || ym() + "-01", sp.get("to") || today()]);
  const [who, setWho] = useState("");

  if (!loaded) return <Empty>جارٍ تحميل البيانات…</Empty>;
  if (!data.isMgr) return <Empty>هذا التقرير مخصص للمدير والمالك فقط.</Empty>;

  const ids = who ? [who] : members(data);
  const rows = scoreboard(data, ids, period, custom).sort((a, b) => b.sales - a.sales || b.calls - a.calls);
  const sum = (k: keyof Row) => rows.reduce((s, r) => s + Number(r[k]), 0);
  const span = period === "hire" ? "من تاريخ مباشرة كل موظف حتى " + fmtDate(today())
    : rows[0] ? (rows[0].from === rows[0].to ? fmtDate(rows[0].from) : "من " + fmtDate(rows[0].from) + " إلى " + fmtDate(rows[0].to)) : "";
  const ansRate = sum("calls") ? Math.round((sum("answered") / sum("calls")) * 100) : 0;
  const conv = sum("reqs") ? Math.round(((sum("deposits") + sum("sales")) / sum("reqs")) * 100) : 0;
  const top = (k: keyof Row) => rows.length > 1 ? [...rows].sort((a, b) => Number(b[k]) - Number(a[k]))[0] : null;
  const best = { answered: top("answered"), calls: top("calls"), sales: top("sales"), commission: top("commission"), attDays: top("attDays") };

  return (
    <>
      <div className="crm-noprint"><ManagerTabs /></div>
      {/* controls — not printed */}
      <div className="crm-noprint mb-4 flex flex-wrap items-center gap-2">
        <div className="crm-seg">
          {(Object.keys(PERIOD_AR) as Period[]).map((k) => (
            <button key={k} type="button" className={period === k ? "on" : ""} onClick={() => setPeriod(k)}>{PERIOD_AR[k]}</button>
          ))}
        </div>
        {period === "custom" && (
          <span className="flex items-center gap-1.5 text-[13px]">
            من <input type="date" className="!w-auto" value={custom[0]} max={custom[1]} onChange={(e) => e.target.value && setCustom([e.target.value, custom[1]])} />
            إلى <input type="date" className="!w-auto" value={custom[1]} min={custom[0]} onChange={(e) => e.target.value && setCustom([custom[0], e.target.value])} />
          </span>
        )}
        <select className="!w-auto" value={who} onChange={(e) => setWho(e.target.value)} aria-label="الموظف">
          <option value="">كل الفريق</option>
          {members(data).map((id) => <option key={id} value={id}>{nameOf(data, id)}</option>)}
        </select>
        <button type="button" className="crm-btn primary ms-auto" onClick={() => window.print()}>🖨 طباعة / حفظ PDF</button>
      </div>

      <article className="crm-report mx-auto grid max-w-[900px] gap-6 rounded-2xl bg-white p-8 text-[#333] shadow-sm print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        {/* cover header */}
        <header className="flex items-start gap-4 border-b-4 pb-5" style={{ borderColor: GOLD }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-mark-dark.png" alt="" className="h-14 w-14 object-contain" />
          <div className="flex-1">
            <div className="text-[13px] font-semibold tracking-wide" style={{ color: GOLD }}>بن سلمه العقارية</div>
            <h1 className="m-0 font-heading text-[28px] leading-tight" style={{ color: INK }}>
              تقرير أداء {who ? nameOf(data, who) : "فريق المبيعات"}
            </h1>
            <div className="mt-1 text-[14px] text-[#666]">{PERIOD_AR[period]} · {span}</div>
          </div>
          <div className="text-end text-[12px] leading-5 text-[#888]">
            <div>تاريخ الإصدار</div>
            <div className="num font-semibold text-[#555]">{fmtStamp(nowStamp())}</div>
            <div>أعدّه: {nameOf(data, data.uid)}</div>
          </div>
        </header>

        {/* KPIs */}
        <section className="grid gap-3">
          <H>الملخص</H>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Kpi l="المكالمات" v={fmt(sum("calls"))} />
            <Kpi l="المكالمات الناجحة" v={fmt(sum("answered"))} hint={"نسبة الرد " + ansRate + "%"} />
            <Kpi l="المكالمات غير الناجحة" v={fmt(sum("noAnswer"))} hint="لم يرد العميل" />
            <Kpi l="الزيارات والمعاينات" v={fmt(sum("visits"))} />
            <Kpi l="العروض المرسلة" v={fmt(sum("sent"))} />
            <Kpi l="الطلبات الجديدة" v={fmt(sum("reqs"))} />
            <Kpi l="العرابين" v={fmt(sum("deposits"))} />
            <Kpi l="المبيعات" v={fmt(sum("sales"))} gold />
            <Kpi l="السعي المحصّل" v={money(sum("commission"))} gold />
            <Kpi l="نسبة التحويل" v={conv + "%"} hint="(عربون + بيع) ÷ الطلبات" />
          </div>
          {rows.length > 1 && (
            <div className="grid gap-1.5 rounded-xl p-3.5 text-[13.5px]" style={{ background: "#f7f4f1" }}>
              <b style={{ color: INK }}>أبرز النتائج</b>
              <ul className="m-0 grid gap-1 ps-5">
                {best.sales && best.sales.sales > 0 && <li>الأعلى مبيعاً: <b>{best.sales.name}</b> ({fmt(best.sales.sales)} بيع)</li>}
                {best.commission && best.commission.commission > 0 && <li>الأعلى سعياً: <b>{best.commission.name}</b> ({money(best.commission.commission)})</li>}
                {best.answered && best.answered.answered > 0 && <li>الأكثر مكالمات ناجحة: <b>{best.answered.name}</b> ({fmt(best.answered.answered)} مكالمة)</li>}
                {best.calls && best.calls.calls > 0 && <li>الأكثر مكالمات: <b>{best.calls.name}</b> ({fmt(best.calls.calls)} مكالمة)</li>}
                {best.attDays && best.attDays.attDays > 0 && <li>الأكثر حضوراً: <b>{best.attDays.name}</b> ({fmt(best.attDays.attDays)} يوم)</li>}
                {sum("late") > 0 && <li>عملاء متأخرون عن موعد الاتصال الآن: <b>{fmt(sum("late"))}</b></li>}
              </ul>
            </div>
          )}
        </section>

        {/* comparison charts */}
        {rows.length > 1 && (
          <section className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
            <Bars title="المكالمات: ناجحة / غير ناجحة" rows={rows} k="answered" k2="noAnswer" legend={["ناجحة", "غير ناجحة"]} colors={["#15803d", "#d6cfc8"]} />
            <Bars title="الطلبات الجديدة" rows={rows} k="reqs" />
            <Bars title="العرابين والمبيعات" rows={rows} k="sales" k2="deposits" />
            <Bars title="أيام الحضور" rows={rows} k="attDays" />
          </section>
        )}

        {/* ranking table */}
        {rows.length > 1 && (
          <section className="grid gap-2 break-inside-avoid">
            <H>الترتيب</H>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr style={{ background: INK, color: "#fff" }}>
                  {["#", "الموظف", "مكالمات", "ناجحة", "غير ناجحة", "زيارات", "طلبات", "عربون", "بيع", "السعي", "حضور", "تأخير"].map((h) => <th key={h} className="px-2 py-2 text-start font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 ? "#faf8f6" : "#fff" }} className="border-b border-[#eee]">
                    <td className="px-2 py-1.5">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</td>
                    <td className="px-2 py-1.5 font-semibold">{r.name}</td>
                    <td className="num px-2">{fmt(r.calls)}</td><td className="num px-2">{fmt(r.answered)}{r.calls ? <span className="text-[11px] text-[#999]"> ({Math.round((r.answered / r.calls) * 100)}%)</span> : null}</td><td className="num px-2">{fmt(r.noAnswer)}</td><td className="num px-2">{fmt(r.visits)}</td><td className="num px-2">{fmt(r.reqs)}</td>
                    <td className="num px-2">{fmt(r.deposits)}</td><td className="num px-2 font-semibold">{fmt(r.sales)}</td>
                    <td className="num px-2" style={{ color: "#555555" }}>{money(r.commission)}</td>
                    <td className="num px-2">{fmt(r.attDays)}</td><td className="num px-2">{fmt(r.attLateDays)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* one card per employee */}
        <section className="grid gap-3">
          <H>تفاصيل الموظفين</H>
          {rows.map((r) => <Card key={r.id} r={r} role={ROLE_AR[data.staff.find((s) => s.id === r.id)?.role || "sales"]} />)}
          {!rows.length && <p className="text-[#888]">لا يوجد موظفون.</p>}
        </section>

        <footer className="flex items-center justify-between border-t pt-3 text-[11.5px] text-[#999]" style={{ borderColor: "#eee" }}>
          <span>بن سلمه العقارية — تقرير داخلي للإدارة</span>
          <span>يُحسب من سجلات النظام: المكالمات من تحديثات العملاء، والحضور من تسجيل الدخول والخروج</span>
        </footer>
      </article>
    </>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="m-0 flex items-center gap-2 font-heading text-[17px]" style={{ color: INK }}><i className="inline-block h-4 w-1.5 rounded" style={{ background: GOLD }} />{children}</h2>;
}

function Kpi({ l, v, gold, hint }: { l: string; v: string; gold?: boolean; hint?: string }) {
  return (
    <div className="rounded-xl border px-3.5 py-3" style={{ borderColor: gold ? GOLD : "#eee", background: gold ? "#f7f7f7" : "#fff" }}>
      <div className="text-[12px] text-[#888]">{l}</div>
      <div className="num font-heading text-[22px] leading-tight" style={{ color: gold ? "#555555" : INK }}>{v}</div>
      {hint && <div className="text-[10.5px] text-[#aaa]">{hint}</div>}
    </div>
  );
}

function Bars({ title, rows, k, k2, legend = ["بيع", "عربون"], colors = [INK, GOLD] }: { title: string; rows: Row[]; k: keyof Row; k2?: keyof Row; legend?: [string, string]; colors?: [string, string] }) {
  const val = (r: Row) => Number(r[k]) + (k2 ? Number(r[k2]) : 0);
  const max = Math.max(1, ...rows.map(val));
  return (
    <div className="grid content-start gap-2 rounded-xl border p-3.5 break-inside-avoid" style={{ borderColor: "#eee" }}>
      <b className="text-[13.5px]" style={{ color: INK }}>{title}</b>
      {rows.map((r) => (
        <div key={r.id} className="grid grid-cols-[90px_1fr_40px] items-center gap-2 text-[12.5px]">
          <span className="truncate">{r.name}</span>
          <span className="flex h-3.5 overflow-hidden rounded-full" style={{ background: "#efefef" }}>
            <i className="block h-full" style={{ width: (Number(r[k]) / max) * 100 + "%", background: k2 ? colors[0] : GOLD }} />
            {k2 && <i className="block h-full" style={{ width: (Number(r[k2]) / max) * 100 + "%", background: colors[1] }} />}
          </span>
          <b className="num text-end">{fmt(val(r))}</b>
        </div>
      ))}
      {k2 && <div className="flex gap-3 text-[11px] text-[#888]"><span><i className="inline-block h-2 w-2 rounded-full" style={{ background: colors[0] }} /> {legend[0]}</span><span><i className="inline-block h-2 w-2 rounded-full" style={{ background: colors[1] }} /> {legend[1]}</span></div>}
    </div>
  );
}

function Card({ r, role }: { r: Row; role: string }) {
  const days = daysBetween(r.from, r.to);
  const attRate = Math.round((r.attDays / days) * 100);
  const conv = r.reqs ? Math.round(((r.deposits + r.sales) / r.reqs) * 100) : 0;
  const stat = (l: string, v: string, tone?: string) => (
    <div className="rounded-lg px-2.5 py-2" style={{ background: "#faf8f6" }}>
      <div className="text-[11px] text-[#888]">{l}</div>
      <div className="num text-[16px] font-semibold" style={{ color: tone || INK }}>{v}</div>
    </div>
  );
  return (
    <div className="grid gap-3 rounded-xl border p-4 break-inside-avoid" style={{ borderColor: "#eee" }}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full font-heading text-[18px] text-white" style={{ background: INK }}>{[...r.name][0]}</span>
        <div className="flex-1">
          <b className="font-heading text-[16px]">{r.name}</b>
          <div className="text-[12.5px] text-[#888]">{role} · <span className="num">{fmtDate(r.from)} ← {fmtDate(r.to)}</span> ({fmt(days)} يوم)</div>
        </div>
        <div className="text-end">
          <div className="text-[11px] text-[#888]">السعي</div>
          <div className="num font-heading text-[18px]" style={{ color: "#555555" }}>{money(r.commission)}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {stat("مكالمات", fmt(r.calls))}
        {stat("مكالمات ناجحة", fmt(r.answered) + (r.calls ? " (" + Math.round((r.answered / r.calls) * 100) + "%)" : ""), "#15803d")}
        {stat("غير ناجحة", fmt(r.noAnswer), r.noAnswer ? "#b91c1c" : undefined)}
        {stat("زيارات", fmt(r.visits))}
        {stat("عروض مرسلة", fmt(r.sent))}
        {stat("طلبات جديدة", fmt(r.reqs))}
        {stat("عربون", fmt(r.deposits))}
        {stat("بيع", fmt(r.sales), "#555555")}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stat("أيام الحضور", fmt(r.attDays) + (days > 1 ? " (" + attRate + "%)" : ""))}
        {stat("أيام التأخير", fmt(r.attLateDays) + (r.attLateMin ? " · " + fmtDur(r.attLateMin) : ""), r.attLateDays ? "#b45309" : undefined)}
        {stat("ساعات العمل", fmt(r.hours))}
        {stat("الفائض", r.overtime ? fmtDur(r.overtime) : "—", r.overtime ? "#15803d" : undefined)}
        {stat("أيام الغياب", fmt(r.absent), r.absent ? "#b91c1c" : undefined)}
        {stat("نسبة التحويل", conv + "%")}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-[#666]">
        <span>عملاء نشطون الآن: <b className="num">{fmt(r.active)}</b></span>
        <span>متأخرون عن الاتصال: <b className="num" style={{ color: r.late ? "#b91c1c" : undefined }}>{fmt(r.late)}</b></span>
        {r.tasksLate > 0 && <span>مهام متأخرة: <b className="num">{fmt(r.tasksLate)}</b></span>}
        {r.pace && <span>أهداف الشهر: <b>{r.pace === "ok" ? "على المسار الصحيح" : r.pace === "warn" ? "تحتاج متابعة" : "متأخرة"}</b></span>}
      </div>
    </div>
  );
}
