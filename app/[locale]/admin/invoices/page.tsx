"use client";

/**
 * "الفواتير" — all tax invoices: month totals (issued value and VAT), filters
 * by status and month, search, and "+ فاتورة جديدة". Opening a row shows the
 * invoice (or the draft editor).
 */
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useCrm } from "@/lib/crm/store";
import { can, nameOf } from "@/lib/crm/logic";
import { ym } from "@/lib/crm/util";
import { Empty, PageHeader, Pill } from "@/components/crm/ui";

const sar = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InvoicesPage() {
  const { data, loaded, invoices, settings } = useCrm();
  const [st, setSt] = useState<"" | "مسودة" | "صادرة" | "ملغاة">("");
  const [month, setMonth] = useState(ym());
  const [q, setQ] = useState("");
  if (!loaded) return <Empty>جارٍ تحميل البيانات…</Empty>;
  if (!data.isMgr && !can(data, "recordDeals")) return <Empty>لا تملك صلاحية الاطلاع على الفواتير.</Empty>;

  const inMonth = (iso: string | null | undefined) => !month || String(iso || "").slice(0, 7) === month;
  const qq = q.trim();
  const list = invoices.filter((v) => (!st || v.status === st) && inMonth(v.issueAt || v.createdAt)
    && (!qq || [v.no, v.buyerName, v.buyerPhone, ...v.lines.map((l) => l.desc)].some((x) => x && x.includes(qq))));
  // An invoice cancelled by a credit note still counts; the note then cancels it out.
  const issued = invoices.filter((v) => (v.status === "صادرة" || (v.status === "ملغاة" && v.creditNoteId)) && inMonth(v.issueAt));
  // A credit note reverses its invoice, so it counts negative.
  const tot = issued.reduce((a, v) => { const k = v.docType === "credit" ? -1 : 1; return { sub: a.sub + k * v.subtotal, vat: a.vat + k * v.vat, total: a.total + k * v.total }; }, { sub: 0, vat: 0, total: 0 });
  const drafts = invoices.filter((v) => v.status === "مسودة").length;

  return (
    <>
      <PageHeader title="الفواتير" sub="فواتير ضريبية برمز QR وفق متطلبات هيئة الزكاة والضريبة والجمارك"
        action={<Link href="/admin/invoices/new" className="crm-btn primary">+ فاتورة جديدة</Link>} />
      {!settings.vatNo && data.isAdmin && (
        <p className="mb-3 rounded-lg bg-[var(--crm-surface-2)] px-3 py-2 text-[13px]">قبل إصدار أول فاتورة: أدخل الرقم الضريبي والعنوان الوطني من <Link className="link" href="/admin/setup">الإعدادات ← أدوات ← بيانات المنشأة</Link>.</p>
      )}
      <div className="mb-3 grid gap-2.5 sm:grid-cols-4">
        <div className="crm-card p-3.5"><div className="text-xs text-[var(--crm-ink-3)]">فواتير صادرة {month ? "هذا الشهر" : ""}</div><b className="num text-2xl">{issued.length}</b></div>
        <div className="crm-card p-3.5"><div className="text-xs text-[var(--crm-ink-3)]">قبل الضريبة</div><b className="num text-xl">{sar(tot.sub)}</b></div>
        <div className="crm-card p-3.5"><div className="text-xs text-[var(--crm-ink-3)]">ضريبة القيمة المضافة</div><b className="num text-xl">{sar(tot.vat)}</b></div>
        <div className="crm-card p-3.5"><div className="text-xs text-[var(--crm-ink-3)]">الإجمالي</div><b className="num text-xl text-[var(--crm-gold-ink)]">{sar(tot.total)}</b></div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="crm-input min-w-[200px] flex-1" placeholder="ابحث برقم الفاتورة أو اسم العميل أو الوصف" value={q} onChange={(e) => setQ(e.target.value)} />
        {([["", "الكل"], ["صادرة", "صادرة"], ["مسودة", "مسودات" + (drafts ? " (" + drafts + ")" : "")], ["ملغاة", "ملغاة"]] as const).map(([k, l]) => (
          <button key={k} type="button" className={"crm-qchip" + (st === k ? " on" : "")} onClick={() => setSt(k)}>{l}</button>
        ))}
        <input type="month" className="!w-auto" value={month} onChange={(e) => setMonth(e.target.value)} />
        {month && <button type="button" className="crm-btn ghost sm" onClick={() => setMonth("")}>كل الأشهر</button>}
      </div>
      {list.length ? (
        <div className="crm-card overflow-x-auto p-1.5">
          <table className="crm-table min-w-[720px]">
            <thead><tr><th>الرقم</th><th>التاريخ</th><th>العميل</th><th>النوع</th><th>الإجمالي</th><th>الضريبة</th><th>الحالة</th><th>أصدرها</th></tr></thead>
            <tbody>
              {list.map((v) => (
                <tr key={v.id}>
                  <td><Link className="link num" href={"/admin/invoices/" + v.id}>{v.no || "مسودة"}</Link></td>
                  <td className="num">{String(v.issueAt || v.createdAt).slice(0, 10)}</td>
                  <td>{v.buyerName}</td>
                  <td className="text-[12.5px]">{v.docType === "credit" ? "إشعار دائن" : v.kind === "standard" ? "ضريبية" : "مبسطة"}</td>
                  <td className="num font-semibold">{sar(v.total)}</td>
                  <td className="num">{sar(v.vat)}</td>
                  <td>{v.status === "صادرة" ? <Pill tone="ok">صادرة</Pill> : v.status === "ملغاة" ? <Pill tone="hot">ملغاة</Pill> : <Pill tone="muted">مسودة</Pill>}
                    {v.zatca && <span className={"ms-1 text-[11.5px] " + (v.zatca.status === "مرفوضة" ? "text-red-700" : "text-emerald-700")}>{v.zatca.status === "مرفوضة" ? "✗ رفضتها الهيئة" : "✓ " + v.zatca.status}</span>}</td>
                  <td className="text-[12.5px]">{nameOf(data, v.issuedBy || v.createdBy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty>{invoices.length ? "لا توجد فواتير بهذه الاختيارات." : "لا توجد فواتير بعد — أنشئ أول فاتورة، أو من صفقة مباعة اضغط «🧾 فاتورة السعي»."}</Empty>}
    </>
  );
}
