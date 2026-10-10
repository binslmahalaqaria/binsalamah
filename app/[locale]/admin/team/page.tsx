"use client";

/**
 * "الفريق" — performance cards, monthly goals, and (owner only) HR files,
 * attendance, payroll, and CRM settings. Staff accounts and website
 * settings keep their own screens (/admin/staff, /admin/settings), linked
 * from here.
 */
import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useCrm } from "@/lib/crm/store";
import { GOALK } from "@/lib/crm/constants";
import {
  actualsFor, fmtK, goalOf, goalVals, hoursOf, hrOf, isMgrId, lateMin, members, nameOf, pace, payFor, planFor, statsFor,
  type Pace,
} from "@/lib/crm/logic";
import { write } from "@/lib/crm/actions";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { dayDiff, exportCsv, fmtInt, fmtStamp, hm, iso, money, monthName, num, nowStamp, today, ym } from "@/lib/crm/util";
import { ContactIcons, Empty, PageHeader, Pill } from "@/components/crm/ui";
import { ImportOld } from "@/components/crm/ImportOld";

const ROLE_AR: Record<string, string> = { admin: "المالك", manager: "مدير مبيعات", sales: "موظف" };

export default function TeamPage() {
  const { data, loaded, me } = useCrm();
  const [tab, setTab] = useState("perf");
  if (!loaded || !me) return <Empty>جاري تحميل البيانات…</Empty>;
  const tabs: [string, string][] = data.isAdmin
    ? [["perf", "الأداء"], ["goals", "الأهداف"], ["staff", "الملفات"], ["att", "الحضور"], ["pay", "الرواتب"], ["settings", "الإعدادات"]]
    : data.isMgr ? [["perf", "الأداء"], ["goals", "الأهداف"]] : [];
  return (
    <>
      <PageHeader eyebrow="الفريق" title="الفريق" sub="الأداء والأهداف والملفات والحضور والرواتب" />
      {tabs.length > 0 && (
        <div className="crm-seg mb-4">
          {tabs.map(([k, l]) => <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
        </div>
      )}
      {tab === "perf" && <Perf />}
      {tab === "goals" && <Goals />}
      {tab === "staff" && <HrFiles />}
      {tab === "att" && <Attendance />}
      {tab === "pay" && <Payroll />}
      {tab === "settings" && <Settings />}
    </>
  );
}

function Perf() {
  const { data, me, setViewAs, openModal, toast } = useCrm();
  const router = useRouter();
  const self = data.staff.find((s) => s.id === data.uid);
  const [nick, setNick] = useState(self?.name || "");
  const [phone, setPhone] = useState(self?.phone || "");
  const ids = members(data);
  return (
    <>
      {data.isMgr && (
        <div className="crm-card mb-3 p-4">
          <h2 className="mb-1.5 text-base">إضافة موظف</h2>
          <p className="m-0 text-sm text-[var(--crm-ink-2)]">
            {data.isAdmin ? <>من صفحة <Link href="/admin/staff" className="font-semibold text-[var(--crm-gold-ink)] underline">حسابات الموظفين</Link> تنشئ له حساب (إيميل وكلمة مرور مؤقتة) وتختار دوره. </> : "المالك ينشئ حسابات الموظفين. "}
            الموظف يشوف عملاءه بس، ومدير المبيعات والمالك يشوفون الكل ويسندون العملاء.
          </p>
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-2.5">
        {ids.map((id) => {
          const s = data.staff.find((x) => x.id === id)!;
          const st = data.isMgr ? statsFor(data, id) : null;
          const plan = data.isMgr ? planFor(data, id, hm) : [];
          const pd = plan.filter((x) => x.done).length;
          return (
            <article key={id} className="crm-card grid gap-2.5 p-3.5">
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--crm-surface-2)] font-semibold">{(s.name || "؟").slice(0, 1)}</div>
                <div className="min-w-0">
                  <b>{s.name}{id === data.uid && <span className="muted"> (أنا)</span>}</b>
                  {s.phone && <div className="num muted text-[13px]">{s.phone}</div>}
                  {data.isMgr && <div className="muted text-[12.5px]" dir="ltr">{s.email}</div>}
                </div>
                <span className="ms-auto"><Pill tone={s.role === "sales" ? "accent" : "gold"}>{ROLE_AR[s.role]}</Pill></span>
              </div>
              {st && (
                <>
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    {[[st.active, "عملاء نشطين", false], [st.due, "اتصالات اليوم" + (st.late ? " (" + st.late + " متأخر)" : ""), st.late > 0], [st.tasks, "مهام مفتوحة", st.tlate > 0], [st.deals, "صفقات مفتوحة", false]].map(([v, l, red], i) => (
                      <div key={i} className="rounded-lg bg-[var(--crm-surface-2)] px-0.5 py-1.5">
                        <b className={"num block font-heading text-lg " + (red ? "text-[var(--crm-danger)]" : "")}>{String(v)}</b>
                        <span className="text-[11.5px] text-[var(--crm-ink-3)]">{String(l)}</span>
                      </div>
                    ))}
                  </div>
                  {plan.length > 0 && (
                    <div className="flex items-center justify-between gap-1.5 text-[13px]">
                      <span className="muted">روتين اليوم: <b className={"num " + (pd === plan.length ? "text-[var(--crm-ok)]" : "text-[var(--crm-ink)]")}>{pd} من {plan.length}</b></span>
                      <span className="crm-bar ok max-w-40 flex-1"><i style={{ width: Math.round((pd / plan.length) * 100) + "%" }} /></span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-[13px]">
                    <span className="muted">سعي محصّل: <b className="text-[var(--crm-gold-ink)]">{money(st.closed)}</b></span>
                    {s.lastSeen && <span className="muted">آخر دخول: {fmtStamp(s.lastSeen)}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button type="button" className="crm-btn sm" onClick={() => { setViewAs(id); router.push("/admin"); }}>اعرض شغله</button>
                    <button type="button" className="crm-btn sm" onClick={() => openModal({ kind: "task", preset: { assignee: id } })}>+ مهمة له</button>
                    <ContactIcons phone={s.phone} />
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
      {me && (
        <div className="crm-card mt-3 p-4">
          <h2 className="mb-2 text-base">ملفي</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="crm-field"><label htmlFor="pf-nick">الاسم اللي يظهر للفريق</label><input id="pf-nick" value={nick} onChange={(e) => setNick(e.target.value)} /></div>
            <div className="crm-field"><label htmlFor="pf-phone">جوالي</label><input id="pf-phone" dir="ltr" value={phone} placeholder="05xxxxxxxx" onChange={(e) => setPhone(e.target.value)} /></div>
          </div>
          <button type="button" className="crm-btn primary mt-2.5" onClick={async () => {
            if (!nick.trim()) return toast("اكتب اسمك");
            await write("staff", data.uid, { name: nick.trim(), phone: phone.trim() || null }, "update");
            toast("تم حفظ ملفك");
          }}>حفظ</button>
        </div>
      )}
    </>
  );
}

function Goals() {
  const { data, openModal, setViewAs } = useCrm();
  const router = useRouter();
  const months = [-2, -1, 0].map((o) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + o); return iso(d).slice(0, 7); });
  const [month, setMonth] = useState(ym());
  const ids = members(data);
  const rank: Record<Pace, number> = { ok: 0, warn: 1, bad: 2 };
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {months.map((m) => <button key={m} type="button" className={"crm-btn " + (m === month ? "primary" : "")} onClick={() => setMonth(m)}>{monthName(m)}</button>)}
        <span className="flex-1" />
        {data.isMgr && <button type="button" className="crm-btn primary" onClick={() => openModal({ kind: "goal", uid: ids.find((id) => !isMgrId(data, id)) || ids[0], month })}>تحديد الأهداف</button>}
      </div>
      <div className="crm-card overflow-x-auto px-2 py-1.5">
        <table className="crm-table min-w-[820px]">
          <thead><tr><th>الموظف</th>{GOALK.map((x) => <th key={x[0]}>{x[2]}</th>)}<th>الوضع</th>{data.isMgr && <th />}</tr></thead>
          <tbody>
            {ids.map((id) => {
              const g = goalOf(data, id, month);
              const v = goalVals(actualsFor(data, id, month));
              let worst: Pace | null = null;
              const cells = GOALK.map(([k]) => {
                const target = g ? num(g[k]) : null;
                const val = v[k];
                if (!target) return <td key={k}><div className="grid gap-1 text-[13px]"><b className="num">{fmtK(k, val)}</b><span className="muted text-[11.5px]">بدون هدف</span></div></td>;
                const st: Pace = k === "calls" ? (val >= target * 0.9 ? "ok" : val >= target * 0.6 ? "warn" : "bad") : pace(val, target, month) || "ok";
                if (worst == null || rank[st] > rank[worst]) worst = st;
                return (
                  <td key={k}><div className="grid min-w-[92px] gap-1 text-[13px]"><span><b className="num">{fmtK(k, val)}</b> / {fmtK(k, target)}</span>
                    <div className={"crm-bar h-1.5 " + st}><i style={{ width: Math.min(100, Math.round((val / target) * 100)) + "%" }} /></div></div></td>
                );
              });
              const w = worst as Pace | null;
              return (
                <tr key={id}>
                  <td><b className="link" onClick={() => { setViewAs(id); router.push("/admin"); }}>{nameOf(data, id)}</b>{isMgrId(data, id) && <span className="muted text-xs"> مدير</span>}{g?.note && <div className="muted text-xs">{g.note}</div>}</td>
                  {cells}
                  <td>{!g ? <Pill tone="muted">ما تحدد له أهداف</Pill> : w === "bad" ? <Pill tone="hot">متأخر</Pill> : w === "warn" ? <Pill tone="warm">يحتاج متابعة</Pill> : <Pill tone="ok">ماشي صح</Pill>}</td>
                  {data.isMgr && <td><button type="button" className="crm-btn sm" onClick={() => openModal({ kind: "goal", uid: id, month })}>{g ? "تعديل" : "حدد"}</button></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="crm-hint mt-2.5">الأرقام تنحسب تلقائياً من شغل الموظف: المكالمات من التحديثات اللي يسجّلها، والزيارات من «زار العقار»، والعربون والبيع والسعي من قسم الطلبات. «ماشي صح» يعني وصل للنسبة المتوقعة حسب الأيام اللي مضت من الشهر. اضغط اسم الموظف وتشوف شغله.</p>
    </>
  );
}

function HrFiles() {
  const { data, openModal } = useCrm();
  const [now] = useState(() => Date.now());
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-2.5">
        {members(data).map((id) => {
          const x = hrOf(data, id);
          const has = data.hr.some((h) => h.id === id);
          const end = x.contractEnd ? dayDiff(x.contractEnd) : null;
          const total = (num(x.salary) || 0) + (num(x.housing) || 0) + (num(x.transport) || 0) + (num(x.otherAllow) || 0);
          const tenure = x.hireDate ? Math.max(0, Math.floor((now - new Date(x.hireDate).getTime()) / (864e5 * 30.44))) : null;
          return (
            <article key={id} className="crm-card grid gap-2.5 p-3.5">
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--crm-surface-2)] font-semibold">{nameOf(data, id).slice(0, 1)}</div>
                <div><b>{nameOf(data, id)}</b><div className="muted text-[13px]">{x.jobTitle || "بدون مسمى"}{x.contractType ? " · " + x.contractType : ""}</div></div>
                <button type="button" className="crm-btn sm ms-auto" onClick={() => openModal({ kind: "hr", uid: id })}>{has ? "تعديل الملف" : "أنشئ ملف"}</button>
              </div>
              {has ? (
                <>
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    {[[total ? money(total) : "—", "الراتب الشامل"], [x.commissionPct != null ? x.commissionPct + "%" : "—", "عمولة من السعي"], [tenure != null ? (tenure >= 12 ? Math.floor(tenure / 12) + " سنة" : tenure + " شهر") : "—", "مدة الخدمة"], [String((x.docs || []).length), "مستندات"]].map(([v, l]) => (
                      <div key={l} className="rounded-lg bg-[var(--crm-surface-2)] px-0.5 py-1.5"><b className="num block font-heading text-[15px]">{v}</b><span className="text-[11.5px] text-[var(--crm-ink-3)]">{l}</span></div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 text-[13px]">
                    {x.hireDate && <span className="muted">المباشرة: {x.hireDate}</span>}
                    {x.contractEnd && (end != null && end <= 30 ? <Pill tone="hot">نهاية العقد: {x.contractEnd}{end < 0 ? " (منتهي)" : " (باقي " + end + " يوم)"}</Pill> : <span className="muted">نهاية العقد: {x.contractEnd}</span>)}
                    <span className="muted">الدوام: {x.workStart || "09:00"} – {x.workEnd || "17:00"}</span>
                  </div>
                </>
              ) : <p className="crm-hint m-0">ما فيه ملف موارد بشرية لهذا الموظف.</p>}
            </article>
          );
        })}
      </div>
      <p className="crm-hint mt-2.5">ملفات الموظفين والرواتب والحضور يشوفها المالك بس. الموظف يشوف حضوره هو.</p>
    </>
  );
}

function Attendance() {
  const { data, openModal } = useCrm();
  const [month, setMonth] = useState(ym());
  const [open, setOpen] = useState<string | null>(null);
  const ids = members(data);
  const t = today();
  return (
    <>
      <div className="mb-3 flex items-center gap-2"><label className="muted" htmlFor="attM">الشهر:</label><input id="attM" type="month" value={month} onChange={(e) => setMonth(e.target.value || ym())} /></div>
      <div className="crm-card mb-2.5 flex flex-wrap gap-1.5 p-3.5">
        <b className="me-1">اليوم:</b>
        {ids.map((id) => {
          const r = (data.att[id] || []).find((x) => x.id === t);
          const lm = lateMin(data, r, id);
          return <span key={id} className={"crm-chip " + (r ? "" : "warn")}>{nameOf(data, id)}: {r ? hm(r.in) + (r.out ? " – " + hm(r.out) : "") + (lm ? " (متأخر " + lm + "د)" : "") : "ما حضر"}</span>;
        })}
      </div>
      <div className="crm-card overflow-x-auto p-1.5">
        <table className="crm-table min-w-[760px]">
          <thead><tr><th>الموظف</th><th>أيام الحضور</th><th>مرات التأخير</th><th>دقائق التأخير</th><th>ساعات العمل</th><th>بدون انصراف</th><th /></tr></thead>
          <tbody>
            {ids.flatMap((id) => {
              const rs = (data.att[id] || []).filter((x) => x.id.slice(0, 7) === month);
              const late = rs.map((r) => lateMin(data, r, id)).filter(Boolean);
              const rows = [
                <tr key={id}>
                  <td><b>{nameOf(data, id)}</b></td><td className="num">{rs.length}</td><td className="num">{late.length}</td>
                  <td className="num">{late.reduce((a, b) => a + b, 0)}</td><td className="num">{rs.reduce((a, r) => a + hoursOf(r), 0).toFixed(1)}</td>
                  <td className="num">{rs.filter((r) => r.in && !r.out).length}</td>
                  <td><button type="button" className="crm-btn ghost sm" onClick={() => setOpen(open === id ? null : id)}>التفاصيل</button></td>
                </tr>,
              ];
              if (open === id)
                rows.push(
                  <tr key={id + "-d"}><td colSpan={7}>
                    <div className="grid gap-1 rounded-lg bg-[var(--crm-surface-2)] p-2">
                      {rs.length ? rs.sort((a, b) => b.id.localeCompare(a.id)).map((r) => (
                        <div key={r.id} className="grid grid-cols-[100px_1fr_1fr_60px_auto_auto] items-center gap-2 text-[13px]">
                          <span className="num">{r.id}</span><span>حضور {hm(r.in)}</span><span>انصراف {hm(r.out)}</span><span>{hoursOf(r).toFixed(1)} س</span>
                          {lateMin(data, r, id) ? <Pill tone="warm">متأخر {lateMin(data, r, id)}د</Pill> : <span />}
                          <button type="button" className="crm-btn ghost sm" onClick={() => openModal({ kind: "attEdit", uid: id, date: r.id })}>تعديل</button>
                        </div>
                      )) : <span className="crm-hint">ما فيه سجلات هذا الشهر.</span>}
                      <button type="button" className="crm-btn sm justify-self-start" onClick={() => openModal({ kind: "attEdit", uid: id, date: "" })}>+ أضف يوم</button>
                    </div>
                  </td></tr>
                );
              return rows;
            })}
          </tbody>
        </table>
      </div>
      <p className="crm-hint mt-2.5">التأخير يُحسب بعد 15 دقيقة من بداية الدوام في ملف الموظف (الافتراضي 9:00).</p>
    </>
  );
}

function Payroll() {
  const { data, toast } = useCrm();
  const [month, setMonth] = useState(ym());
  const ids = members(data);
  const tot = ids.reduce((a, id) => a + payFor(data, id, month).net, 0);
  const savePay = async (id: string, field: string, value: unknown) => {
    const k = month + "_" + id;
    const cur = data.payroll.find((x) => x.id === k) || {};
    const body = { ...cur, [field]: field === "note" || field === "paid" ? value : num(value), month, member: id, updatedAt: nowStamp() } as Record<string, unknown>;
    delete body.id;
    await write("payroll", k, body);
    toast("انحفظ");
  };
  const exportPay = () =>
    exportCsv("رواتب " + month, ids.map((id) => {
      const p = payFor(data, id, month), x = hrOf(data, id);
      return {
        "الموظف": nameOf(data, id), "المسمى": x.jobTitle || "", "الآيبان": x.iban || "", "الأساسي": p.basic, "البدلات": p.allow, "مبيعات": p.deals,
        "السعي المحصّل": Math.round(p.sa3y), "نسبة العمولة %": p.cpct, "العمولة": p.commission, "مكافأة": p.bonus, "خصم": p.deduction,
        "الصافي": p.net, "ملاحظة": p.note, "صُرف": p.paid ? "نعم" : "لا",
      };
    }));
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="muted" htmlFor="payM">الشهر:</label><input id="payM" type="month" value={month} onChange={(e) => setMonth(e.target.value || ym())} />
        <span className="flex-1" />
        <button type="button" className="crm-btn" onClick={exportPay}>تصدير Excel</button>
      </div>
      <div className="crm-card overflow-x-auto p-1.5">
        <table className="crm-table min-w-[760px]">
          <thead><tr><th>الموظف</th><th>الأساسي</th><th>البدلات</th><th>العمولة</th><th>مكافأة</th><th>خصم</th><th>الصافي</th><th>ملاحظة</th><th>صُرف</th></tr></thead>
          <tbody>
            {ids.map((id) => {
              const p = payFor(data, id, month);
              return (
                <tr key={id + month}>
                  <td><b>{nameOf(data, id)}</b></td>
                  <td className="num">{fmtInt(p.basic)}</td>
                  <td className="num">{fmtInt(p.allow)}</td>
                  <td className="num">{fmtInt(p.commission)}{p.deals > 0 && <div className="crm-hint">{p.deals} صفقة × {p.cpct}%</div>}</td>
                  <td><input inputMode="decimal" className="min-w-[70px]" defaultValue={p.bonus || ""} placeholder="0" onBlur={(e) => e.target.value !== String(p.bonus || "") && savePay(id, "bonus", e.target.value)} /></td>
                  <td><input inputMode="decimal" className="min-w-[70px]" defaultValue={p.deduction || ""} placeholder="0" onBlur={(e) => e.target.value !== String(p.deduction || "") && savePay(id, "deduction", e.target.value)} /></td>
                  <td className="num"><b>{fmtInt(p.net)}</b></td>
                  <td><input defaultValue={p.note} placeholder="—" onBlur={(e) => e.target.value !== p.note && savePay(id, "note", e.target.value)} /></td>
                  <td><input type="checkbox" className="h-4 w-4 accent-[var(--crm-gold)]" checked={p.paid} aria-label="تم الصرف" onChange={(e) => savePay(id, "paid", e.target.checked)} /></td>
                </tr>
              );
            })}
            <tr className="font-semibold"><td>الإجمالي</td><td colSpan={5} /><td className="num"><b>{fmtInt(tot)} ر.س</b></td><td colSpan={2} /></tr>
          </tbody>
        </table>
      </div>
      <p className="crm-hint mt-2.5">العمولة = مجموع سعي طلبات الموظف اللي صارت &quot;تم البيع&quot; في هذا الشهر × نسبة عمولته في ملفه. المكافأة والخصم والملاحظة تنحفظ لما تطلع من الخانة.</p>
    </>
  );
}

function Settings() {
  const { data, settings, toast } = useCrm();
  const ids = members(data);
  const [sm, setSm] = useState(settings.salesManager || data.staff.find((s) => s.role === "admin")?.id || "");
  const [days, setDays] = useState(String(settings.escalateDays || 2));
  const [off, setOff] = useState(!!settings.escalateOff);
  return (
    <div className="grid max-w-2xl gap-3">
      <div className="crm-card grid gap-3.5 p-4">
        <h2 className="text-base">رجوع العميل لمدير المبيعات</h2>
        <p className="crm-hint m-0">إذا الموظف ما تواصل مع العميل وعدّى موعد الاتصال بعدد الأيام المحدد، العميل وطلبه يرجعون تلقائي لمدير المبيعات، وينسجل في سجل العميل.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="crm-field"><label htmlFor="set-sm">مدير المبيعات</label>
            <select id="set-sm" value={sm} onChange={(e) => setSm(e.target.value)}>{ids.map((id) => <option key={id} value={id}>{nameOf(data, id)}</option>)}</select></div>
          <div className="crm-field"><label htmlFor="set-days">يرجع بعد كم يوم تأخير؟</label>
            <select id="set-days" value={days} onChange={(e) => setDays(e.target.value)}>{[1, 2, 3, 5, 7].map((n) => <option key={n} value={n}>{n}{n === 1 ? " يوم" : n === 2 ? " يومين" : " أيام"}</option>)}</select></div>
          <label className="crm-check sm:col-span-2"><input type="checkbox" checked={off} onChange={(e) => setOff(e.target.checked)} /><span>أوقف الرجوع التلقائي</span></label>
        </div>
        <div><button type="button" className="crm-btn primary" onClick={async () => {
          await setDoc(doc(db, "crm", "settings"), { salesManager: sm || null, escalateDays: Number(days) || 2, escalateOff: off });
          toast("انحفظت الإعدادات");
        }}>حفظ</button></div>
        <p className="crm-hint m-0">الرجوع يصير لما يكون المدير أو المالك فاتح النظام.</p>
      </div>
      <div className="crm-card flex flex-wrap items-center gap-2 p-4">
        <span className="flex-1 text-sm">حسابات الموظفين وإعدادات الموقع (رقم الواتساب والتواصل):</span>
        <Link href="/admin/staff" className="crm-btn">حسابات الموظفين</Link>
        <Link href="/admin/settings" className="crm-btn">إعدادات الموقع</Link>
      </div>
      <ImportOld />
    </div>
  );
}
