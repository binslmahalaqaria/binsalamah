"use client";

/** "المبيعات" — the month's sales and commission, open deposits, and priced negotiations. All come from requests. */
import { useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { REQ_TONE, SOLD_ST } from "@/lib/crm/constants";
import { clientById, comm, nameOf, propById, visibleRequests } from "@/lib/crm/logic";
import type { Request } from "@/lib/crm/types";
import { exportCsv, fmtInt, money, ym } from "@/lib/crm/util";
import { Empty, PageHeader, Pill } from "@/components/crm/ui";

export default function SalesPage() {
  const { data, loaded, openModal, toast } = useCrm();
  const [month, setMonth] = useState(ym());
  if (!loaded) return <Empty>جاري تحميل البيانات…</Empty>;

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
      "القيمة": r.price ?? "", "السعي %": r.commissionPct ?? 2.5, "السعي": Math.round(comm(r)), "المسؤول": nameOf(data, r.assignee),
    }))) || toast("ما فيه بيانات للتصدير");

  const table = (title: string, rows: Request[]) => (
    <>
      <div className="mt-4 mb-2 flex items-baseline gap-2.5"><h2 className="text-[15.5px]">{title}</h2><span className="num muted">{rows.length}</span></div>
      {rows.length ? (
        <div className="crm-card overflow-x-auto p-1.5">
          <table className="crm-table min-w-[760px]">
            <thead><tr><th>التاريخ</th><th>العميل</th><th>العقار</th><th>القيمة</th><th>السعي</th><th>المرحلة</th><th>المسؤول</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => {
                const c = clientById(data, r.clientId), p = propById(data, r.propertyId);
                return (
                  <tr key={r.id}>
                    <td className="num">{String((r.status === "تم البيع" ? r.closedAt : r.depositAt || r.updatedAt) || "").slice(0, 10)}</td>
                    <td><b className="link" onClick={() => openModal({ kind: "request", id: r.id })}>{c?.name || "—"}</b></td>
                    <td>{p ? p.title : "—"}{r.unit ? " · " + r.unit : ""}</td>
                    <td className="num">{r.price ? fmtInt(r.price) : <button type="button" className="crm-btn sm" onClick={() => openModal({ kind: "close", reqId: r.id, to: r.status })}>أكمل البيانات</button>}</td>
                    <td className="num">{fmtInt(comm(r))}</td>
                    <td><Pill tone={REQ_TONE[r.status]}>{r.status}</Pill></td>
                    <td>{nameOf(data, r.assignee)}</td>
                    <td className="whitespace-nowrap">
                      {SOLD_ST.includes(r.status) ? (
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
      ) : <Empty>ما فيه.</Empty>}
    </>
  );

  const Stat = ({ v, l, gold }: { v: string; l: string; gold?: boolean }) => (
    <div className="crm-card flex flex-col-reverse gap-0.5 px-4 py-3.5">
      <b className={"font-heading text-[26px] " + (gold ? "text-[var(--crm-gold-ink)]" : "")}>{v}</b>
      <span className="text-[12.5px] text-[var(--crm-ink-3)]">{l}</span>
    </div>
  );

  return (
    <>
      <PageHeader eyebrow="المبيعات" title="المبيعات" sub="العربونات والمبيعات والسعي" />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="muted" htmlFor="salesMonth">الشهر:</label>
        <input id="salesMonth" type="month" value={month} onChange={(e) => setMonth(e.target.value || ym())} />
        <span className="flex-1" />
        <button type="button" className="crm-btn" onClick={exportRows}>تصدير Excel</button>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat gold v={money(sum(sold, comm))} l={"سعي محصّل هذا الشهر (" + sold.length + " بيع)"} />
        <Stat v={money(sum(sold, (r) => r.price || 0))} l="قيمة المبيعات هذا الشهر" />
        <Stat v={String(dep.length)} l={"عربونات قائمة · سعي " + money(sum(dep, comm))} />
        <Stat v={String(nego.length)} l={"في التفاوض · سعي متوقع " + money(sum(nego, comm))} />
      </div>
      {table("المبيعات هذا الشهر", sold)}
      {table("عربونات قائمة", dep)}
      {table("في التفاوض (بقيمة محددة)", nego)}
      <p className="crm-hint mt-3">المبيعات تتسجّل من قسم الطلبات: انقل الطلب لمرحلة &quot;عربون&quot; أو &quot;تم البيع&quot; ويطلب منك العقار والوحدة والقيمة.</p>
    </>
  );
}
