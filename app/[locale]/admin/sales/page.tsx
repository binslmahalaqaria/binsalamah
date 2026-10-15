"use client";

/**
 * "المبيعات" — the month's sales and commission, open deposits, and priced negotiations. All come from requests.
 * Employees see only their own deals; managers see everyone's, who closed each one, and a per-employee breakdown.
 */
import { useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { REQ_TONE, SOLD_ST, lbl } from "@/lib/crm/constants";
import { clientById, comm, nameOf, propById, visibleRequests, can } from "@/lib/crm/logic";
import type { Request } from "@/lib/crm/types";
import { exportCsv, fmtInt, money, num, ym } from "@/lib/crm/util";
import { Empty, PageHeader, Pill } from "@/components/crm/ui";

/** Who recorded the deal: the sale's closer, else the deposit's recorder (older records have neither). */
const closerOf = (r: Request) => (r.status === "تم البيع" ? r.closedBy || r.depositBy : r.depositBy) || null;

export default function SalesPage() {
  const { data, loaded, openModal, setViewAs, toast } = useCrm();
  const [month, setMonth] = useState(ym());
  if (!loaded) return <Empty>جارٍ تحميل البيانات…</Empty>;
  if (!can(data, "viewSales")) return <Empty>لا تملك صلاحية الاطلاع على هذه الصفحة.</Empty>;

  const mgr = data.isMgr;
  const all = visibleRequests(data);
  const inM = (s: string | null | undefined) => String(s || "").slice(0, 7) === month;
  const sold = all.filter((r) => r.status === "تم البيع" && inM(r.closedAt));
  const dep = all.filter((r) => r.status === "عربون");
  const nego = all.filter((r) => r.status === "تفاوض" && r.price);
  const sum = (a: Request[], f: (r: Request) => number) => a.reduce((s, r) => s + f(r), 0);

  const exportRows = () =>
    exportCsv("المبيعات", all.filter((r) => ["تفاوض", "عربون", "تم البيع"].includes(r.status)).map((r) => ({
      "المرحلة": r.status, "تاريخ العربون": String(r.depositAt || "").slice(0, 10), "تاريخ البيع": String(r.closedAt || "").slice(0, 10),
      "العميل": clientById(data, r.clientId)?.name || "", "العقار": propById(data, r.propertyId)?.title || "", "الوحدة": r.unit || "",
      "العربون": r.deposit ?? "", "القيمة": r.price ?? "", "السعي %": r.commissionPct ?? 2.5, "السعي": Math.round(comm(r)),
      "المسؤول": nameOf(data, r.assignee), "سجّله": closerOf(r) ? nameOf(data, closerOf(r)) : "",
    }))) || toast("لا توجد بيانات للتصدير");

  const table = (title: string, rows: Request[]) => (
    <>
      <div className="mt-4 mb-2 flex items-baseline gap-2.5"><h2 className="text-[15.5px]">{title}</h2><span className="num muted">{rows.length}</span></div>
      {rows.length ? (
        <div className="crm-card overflow-x-auto p-1.5">
          <table className={"crm-table " + (mgr ? "min-w-[960px]" : "min-w-[780px]")}>
            <thead>
              <tr>
                <th>التاريخ</th><th>العميل</th><th>العقار</th><th>العربون</th><th>القيمة</th><th>السعي</th><th>المرحلة</th>
                {mgr && <><th>المسؤول</th><th>سجّله</th></>}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = clientById(data, r.clientId), p = propById(data, r.propertyId);
                const by = closerOf(r);
                return (
                  <tr key={r.id}>
                    <td className="num">{String((r.status === "تم البيع" ? r.closedAt : r.depositAt || r.updatedAt) || "").slice(0, 10)}</td>
                    <td><b className="link" onClick={() => openModal({ kind: "request", id: r.id })}>{c?.name || "—"}</b></td>
                    <td>{p ? p.title : "—"}{r.unit ? " · " + r.unit : ""}</td>
                    <td className="num">{num(r.deposit) ? <b>{fmtInt(num(r.deposit)!)}</b> : r.status === "عربون" ? <button type="button" className="crm-btn sm" onClick={() => openModal({ kind: "close", reqId: r.id, to: r.status })}>سجّل المبلغ</button> : "—"}</td>
                    <td className="num">{r.price ? fmtInt(r.price) : <button type="button" className="crm-btn sm" onClick={() => openModal({ kind: "close", reqId: r.id, to: r.status })}>أكمل البيانات</button>}</td>
                    <td className="num">{fmtInt(comm(r))}</td>
                    <td><Pill tone={REQ_TONE[r.status]}>{lbl(r.status)}</Pill></td>
                    {mgr && (
                      <>
                        <td>{nameOf(data, r.assignee)}</td>
                        <td>{by ? (by === r.assignee ? <span className="muted">نفسه</span> : nameOf(data, by)) : <span className="muted">—</span>}</td>
                      </>
                    )}
                    <td className="whitespace-nowrap">
                      {!can(data, "recordDeals") ? null : SOLD_ST.includes(r.status) ? (
                        <>
                          <button type="button" className="crm-btn sm" onClick={() => openModal({ kind: "close", reqId: r.id, to: r.status })}>تعديل</button>{" "}
                          <button type="button" className="crm-btn ghost sm" onClick={() => openModal({ kind: "cancel", reqId: r.id })}>إلغاء</button>
                        </>
                      ) : (
                        <button type="button" className="crm-btn sm" onClick={() => openModal({ kind: "request", id: r.id })}>تعديل</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <Empty>لا يوجد.</Empty>}
    </>
  );

  const Stat = ({ v, l, gold }: { v: string; l: string; gold?: boolean }) => (
    <div className="crm-card flex flex-col-reverse gap-0.5 px-4 py-3.5">
      <b className={"font-heading text-[26px] " + (gold ? "text-[var(--crm-gold-ink)]" : "")}>{v}</b>
      <span className="text-[12.5px] text-[var(--crm-ink-3)]">{l}</span>
    </div>
  );

  // Per-employee breakdown for managers looking at the whole team.
  const team = mgr && !data.viewAs;
  const people = team
    ? [...new Set([...sold, ...dep, ...nego].map((r) => r.assignee || ""))].map((id) => {
        const mine = (a: Request[]) => a.filter((r) => (r.assignee || "") === id);
        const s = mine(sold), d = mine(dep), n = mine(nego);
        return { id, sold: s.length, value: sum(s, (r) => r.price || 0), commission: sum(s, comm), dep: d.length, depSum: sum(d, (r) => num(r.deposit) || 0), nego: n.length };
      }).sort((a, b) => b.commission - a.commission || b.dep - a.dep)
    : [];

  const viewing = mgr && data.viewAs && data.viewAs !== "none" ? nameOf(data, data.viewAs) : null;

  return (
    <>
      <PageHeader eyebrow="المبيعات" title={mgr ? (viewing ? "مبيعات " + viewing : "المبيعات") : "مبيعاتي"}
        sub={mgr ? "مبيعات الفريق وعربوناته ومن أتمّها" : "عربوناتك ومبيعاتك وسعيك"} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="muted" htmlFor="salesMonth">الشهر:</label>
        <input id="salesMonth" type="month" value={month} onChange={(e) => setMonth(e.target.value || ym())} />
        <span className="flex-1" />
        {can(data, "export") && <button type="button" className="crm-btn" onClick={exportRows}>تصدير Excel</button>}
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat gold v={money(sum(sold, comm))} l={"سعي محصّل هذا الشهر (" + sold.length + " بيع)"} />
        <Stat v={money(sum(sold, (r) => r.price || 0))} l="قيمة المبيعات هذا الشهر" />
        <Stat v={String(dep.length)} l={"عربونات قائمة · مجموعها " + money(sum(dep, (r) => num(r.deposit) || 0)) + " · سعي " + money(sum(dep, comm))} />
        <Stat v={String(nego.length)} l={"في التفاوض · سعي متوقع " + money(sum(nego, comm))} />
      </div>

      {team && people.length > 0 && (
        <>
          <div className="mt-2 mb-2 flex items-baseline gap-2.5"><h2 className="text-[15.5px]">حسب الموظف</h2><span className="muted text-xs">اضغط على الاسم لعرض صفقاته فقط</span></div>
          <div className="crm-card overflow-x-auto p-1.5">
            <table className="crm-table min-w-[640px]">
              <thead><tr><th>الموظف</th><th>بيع</th><th>قيمة المبيعات</th><th>السعي</th><th>عربونات قائمة</th><th>مجموع العربون</th><th>تفاوض</th></tr></thead>
              <tbody>
                {people.map((x) => (
                  <tr key={x.id || "none"}>
                    <td>{x.id ? <b className="link" onClick={() => setViewAs(x.id)}>{nameOf(data, x.id)}</b> : <span className="muted">غير مسند</span>}</td>
                    <td className="num">{x.sold}</td>
                    <td className="num">{x.value ? fmtInt(x.value) : "—"}</td>
                    <td className="num text-[var(--crm-gold-ink)]">{x.commission ? fmtInt(x.commission) : "—"}</td>
                    <td className="num">{x.dep}</td>
                    <td className="num">{x.depSum ? fmtInt(x.depSum) : "—"}</td>
                    <td className="num">{x.nego}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {table("المبيعات هذا الشهر", sold)}
      {table("عربونات قائمة", dep)}
      {table("في التفاوض (بقيمة محددة)", nego)}
      <p className="crm-hint mt-3">
        تُسجَّل المبيعات من قسم الطلبات بنقل الطلب إلى مرحلة &quot;عربون&quot; أو &quot;تم البيع&quot;، ثم إدخال العقار والوحدة والقيمة.
        {mgr && " يوضّح عمود «سجّله» الموظف الذي سجّل العربون أو البيع إذا كان غير الموظف المسؤول، ولا تتوفر هذه المعلومة للصفقات المسجّلة قبل هذا التحديث."}
      </p>
    </>
  );
}
