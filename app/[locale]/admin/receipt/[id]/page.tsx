"use client";

/**
 * "سند قبض" — printable deposit receipt for a request in عربون / تم البيع:
 * company header with logo, receipt number and dates (Gregorian + Hijri),
 * payer, amount in figures and words (تفقيط), what it is for (property / unit,
 * sale value, remaining), payment method and reference, signature lines and
 * the company's round stamp. The editable details (payer ID, method, reference)
 * are saved on the request; the receipt number is fixed the first time it is
 * issued. "طباعة / حفظ PDF" prints only the receipt.
 */
import { use, useRef, useState } from "react";
import { downloadDocPdf, sendDocWhatsApp } from "@/components/crm/shareDoc";
import { Link } from "@/i18n/navigation";
import { useCrm } from "@/lib/crm/store";
import { clientById, nameOf, propById } from "@/lib/crm/logic";
import { write } from "@/lib/crm/actions";
import { localDay, nowStamp, num } from "@/lib/crm/util";
import { tafqit } from "@/lib/crm/tafqit";
import { Empty } from "@/components/crm/ui";

const METHODS = ["تحويل بنكي", "نقداً", "شيك", "نقاط بيع (مدى)"];
const INK = "#333333", GOLD = "#b79579", STAMP = "#1e3a8a";
const sar = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " ريال";
const hijri = (d: Date) => d.toLocaleDateString("ar-SA-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric" });
const greg = (d: Date) => d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear();

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loaded, toast, settings } = useCrm();
  const sheet = useRef<HTMLElement>(null);
  const [sending, setSending] = useState(false);
  const r = data.requests.find((x) => x.id === id);
  const [form, setForm] = useState<{ payerIdNo: string; payMethod: string; payRef: string; note: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loaded) return <Empty>جارٍ تحميل البيانات…</Empty>;
  if (!r) return <Empty>الطلب غير موجود.</Empty>;
  const c = clientById(data, r.clientId);
  const p = propById(data, r.propertyId);
  const dep = num(r.deposit) || 0;
  const f = form || { payerIdNo: r.payerIdNo || "", payMethod: r.payMethod || METHODS[0], payRef: r.payRef || "", note: r.receiptNote || "" };
  const set = (k: keyof typeof f, v: string) => setForm({ ...f, [k]: v });
  // Fixed once issued; until then a preview number from the deposit date and the request id.
  const day = new Date(r.depositAt || nowStamp());
  const number = r.receiptNo || "BS-" + day.getFullYear() + String(day.getMonth() + 1).padStart(2, "0") + String(day.getDate()).padStart(2, "0") + "-" + r.id.slice(-4).toUpperCase();
  const issued = new Date(r.receiptAt || nowStamp());
  const price = num(r.price) || 0;

  async function saveAndPrint(print = true, quiet = false): Promise<boolean> {
    if (!dep) { toast("سجّل مبلغ العربون أولاً"); return false; }
    setBusy(true);
    try {
      await write("requests", r!.id, {
        payerIdNo: f.payerIdNo.trim() || null, payMethod: f.payMethod || null, payRef: f.payRef.trim() || null, receiptNote: f.note.trim() || null,
        ...(r!.receiptNo ? {} : { receiptNo: number, receiptAt: nowStamp(), receiptBy: data.uid }),
      }, "update");
      if (print) setTimeout(() => window.print(), 300);
      else if (!quiet) toast("تم حفظ بيانات السند");
      return true;
    } catch {
      toast("تعذّر حفظ بيانات السند");
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Sends the receipt to the client as a PDF through the CRM's WhatsApp (falls back to download + wa.me). */
  async function sendWhatsApp() {
    if (!c?.phone) return toast("لا يوجد رقم جوال للعميل");
    if (!(await saveAndPrint(false, true)) || !sheet.current) return;
    setSending(true);
    try {
      const caption = "سند قبض رقم " + number + " — عربون بمبلغ " + sar(dep) + (p ? " — " + p.title : "") + "\nشاكرين لكم ثقتكم، بن سلمه العقارية";
      toast(await sendDocWhatsApp(data, sheet.current, c.phone, caption, "سند-قبض-" + number));
    } catch {
      toast("تعذّر إرسال السند — حاول مرة أخرى");
    } finally {
      setSending(false);
    }
  }

  /** Saves the receipt as a real PDF file (A4, sharp text — not a picture). */
  async function savePdf() {
    if (!(await saveAndPrint(false, true)) || !sheet.current) return;
    setSending(true);
    try {
      await downloadDocPdf(sheet.current, "سند-قبض-" + number);
    } catch {
      toast("تعذّر تجهيز ملف PDF — حاول مرة أخرى");
    } finally {
      setSending(false);
    }
  }

  const line = (label: string, value: React.ReactNode, wide?: boolean) => (
    <div className={"flex items-baseline gap-2 " + (wide ? "col-span-2" : "")}>
      <span className="shrink-0 text-[13px] text-[#777]">{label}</span>
      <span className="flex-1 border-b border-dotted border-[#bbb] pb-0.5 text-[15px] font-semibold" style={{ color: INK }}>{value || " "}</span>
    </div>
  );

  return (
    <>
      {/* details — not printed */}
      <div className="crm-noprint crm-card mb-4 grid gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="m-0 flex-1 text-[17px]">سند قبض العربون</h1>
          {c && <Link href="/admin/requests" className="crm-btn ghost sm">رجوع</Link>}
        </div>
        {!dep && <p className="m-0 text-[var(--crm-danger)]">لم يُسجَّل مبلغ العربون لهذا الطلب بعد — سجّله من «أكمل البيانات» أولاً.</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="crm-field"><label>رقم هوية الدافع (اختياري)</label><input dir="ltr" inputMode="numeric" value={f.payerIdNo} onChange={(e) => set("payerIdNo", e.target.value)} /></div>
          <div className="crm-field"><label>طريقة الدفع</label>
            <select value={f.payMethod} onChange={(e) => set("payMethod", e.target.value)}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
          </div>
          <div className="crm-field"><label>رقم الحوالة / الشيك (اختياري)</label><input dir="ltr" value={f.payRef} onChange={(e) => set("payRef", e.target.value)} /></div>
          <div className="crm-field sm:col-span-3"><label>ملاحظات تُطبع على السند (اختياري)</label>
            <textarea rows={2} value={f.note} placeholder="مثال: مدة الحجز 7 أيام، ويُخصم العربون من قيمة العقار عند الإفراغ" onChange={(e) => set("note", e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="crm-btn primary" disabled={busy || !dep} onClick={() => saveAndPrint(true)}>🖨 {r.receiptNo ? "طباعة" : "إصدار السند وطباعته"}</button>
          <button type="button" className="crm-btn" disabled={busy || sending || !dep} onClick={savePdf}>⬇ تنزيل PDF</button>
          <button type="button" className="crm-btn wa" disabled={busy || sending || !dep || !c?.phone} onClick={sendWhatsApp}>{sending ? "جارٍ تجهيز الملف…" : "📤 إرسال PDF للعميل واتساب"}</button>
          <button type="button" className="crm-btn" disabled={busy || !dep} onClick={() => saveAndPrint(false)}>حفظ</button>
          {data.isAdmin && (!settings.crNo || !settings.iban || !settings.signature) && <Link href="/admin/setup" className="crm-hint underline">أكمل بيانات السندات (السجل التجاري، الآيبان، التوقيع) من الإعدادات ← أدوات</Link>}
          <span className="crm-hint">{r.receiptNo ? "صدر بتاريخ " + localDay(r.receiptAt) + " بواسطة " + nameOf(data, r.receiptBy) + " — الرقم ثابت." : "يُثبَّت رقم السند عند أول إصدار."}</span>
        </div>
      </div>

      {/* the receipt */}
      <article ref={sheet} className="crm-report relative mx-auto max-w-[800px] overflow-hidden rounded-2xl bg-white p-8 text-[#333] shadow-sm print:max-w-none print:rounded-none print:p-2 print:shadow-none"
        style={{ border: "2px solid " + GOLD }}>
        <header className="flex items-center gap-4 border-b-2 pb-4" style={{ borderColor: GOLD }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-mark-dark.png" alt="" className="h-16 w-16 object-contain" />
          <div className="flex-1">
            <div className="font-heading text-[24px] leading-tight" style={{ color: INK }}>بن سلمه العقارية</div>
            <div className="text-[13px] tracking-wide text-[#888]" dir="ltr" style={{ textAlign: "right" }}>Bin Slmah Real Estate</div>
            {settings.crNo && <div className="mt-0.5 text-[12.5px] text-[#666]">سجل تجاري رقم: <b className="num">{settings.crNo}</b></div>}
          </div>
          <div className="grid justify-items-center rounded-xl px-5 py-2 text-white" style={{ background: INK }}>
            <span className="font-heading text-[22px] leading-tight">سند قبض</span>
            <span className="text-[11px] tracking-[0.2em] opacity-80">RECEIPT VOUCHER</span>
          </div>
        </header>

        <div className="mt-4 grid grid-cols-3 gap-3 text-[13px]">
          <div><span className="text-[#888]">رقم السند: </span><b className="num" dir="ltr">{number}</b></div>
          <div className="text-center"><span className="text-[#888]">التاريخ: </span><b className="num">{greg(issued)}</b></div>
          <div className="text-end"><span className="text-[#888]">الموافق: </span><b>{hijri(issued)}</b></div>
        </div>

        <div className="my-5 flex items-center justify-center gap-3">
          <span className="text-[14px] text-[#777]">المبلغ</span>
          <span className="num rounded-xl border-2 px-6 py-2 font-heading text-[28px]" style={{ borderColor: GOLD, color: INK }}>{sar(dep)}</span>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {line("استلمنا من:", c?.name, true)}
          {line("رقم الهوية:", f.payerIdNo && <span className="num" dir="ltr">{f.payerIdNo}</span>)}
          {line("رقم الجوال:", c?.phone && <span className="num" dir="ltr">{c.phone}</span>)}
          {line("مبلغاً وقدره:", tafqit(dep), true)}
          {line("وذلك عن:", "عربون حجز " + (p ? p.title + (r.unit ? " — " + r.unit : "") + (p.district ? " — حي " + p.district : "") : "عقار"), true)}
          {line("طريقة الدفع:", f.payMethod)}
          {line("رقم المرجع:", f.payRef && <span className="num" dir="ltr">{f.payRef}</span>)}
          {price > 0 && line("قيمة العقار:", <span className="num">{sar(price)}</span>)}
          {price > 0 && line("المتبقي بعد العربون:", <span className="num">{sar(Math.max(0, price - dep))}</span>)}
          {line("تاريخ العربون:", r.depositAt && <span className="num">{greg(day)}</span>)}
          {line("استلمه:", nameOf(data, r.receiptBy || r.depositBy || data.uid))}
        </div>

        {f.note.trim() && (
          <div className="mt-5 rounded-lg border px-3 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap" style={{ borderColor: GOLD }}>
            <b style={{ color: INK }}>ملاحظات: </b>{f.note.trim()}
          </div>
        )}
        {settings.iban && (
          <div className="mt-4 grid gap-1 rounded-lg px-3 py-2 text-[13px]" style={{ background: "#f8f5f2" }}>
            <b style={{ color: INK }}>الحساب البنكي للشركة</b>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {settings.bankName && <span>البنك: <b>{settings.bankName}</b></span>}
              {settings.accountName && <span>اسم الحساب: <b>{settings.accountName}</b></span>}
              {settings.accountNo && <span>رقم الحساب: <b className="num" dir="ltr">{settings.accountNo}</b></span>}
              <span>الآيبان: <b className="num" dir="ltr">{settings.iban.replace(/(.{4})/g, "$1 ").trim()}</b></span>
            </div>
          </div>
        )}
        <p className="mt-3 rounded-lg px-3 py-2 text-[12px] leading-relaxed text-[#666]" style={{ background: "#f8f5f2" }}>
          يُعدّ هذا السند إثباتاً لاستلام مبلغ العربون المذكور أعلاه، ويخضع العربون لشروط الحجز المتفق عليها بين الطرفين.
        </p>

        <footer className="mt-8 grid grid-cols-2 items-end gap-6 text-center text-[13px]">
          <div className="grid justify-items-center gap-1">
            <span className="text-[#888]">المفوّض بالتوقيع</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {settings.signature ? <img src={settings.signature} alt="التوقيع" className="h-20 max-w-[220px] object-contain" /> : <span className="h-20" />}
            <span className="min-w-[200px] border-t border-[#bbb] pt-1 font-semibold">{settings.signerName || nameOf(data, data.uid)}</span>
          </div>
          <div className="grid justify-items-center"><Stamp date={greg(issued)} crNo={settings.crNo} /></div>
        </footer>
      </article>
    </>
  );
}

/** The company's round stamp, drawn in stamp-blue ink and slightly tilted. */
function Stamp({ date, crNo }: { date: string; crNo?: string | null }) {
  return (
    <svg viewBox="0 0 200 200" width="150" height="150" style={{ transform: "rotate(-9deg)", opacity: 0.88 }} aria-label="ختم بن سلمه العقارية">
      <defs>
        <path id="stamp-top" d="M 30 100 A 70 70 0 0 1 170 100" />
        <path id="stamp-bottom" d="M 36 108 A 64 64 0 0 0 164 108" />
      </defs>
      <circle cx="100" cy="100" r="94" fill="none" stroke={STAMP} strokeWidth="4" />
      <circle cx="100" cy="100" r="86" fill="none" stroke={STAMP} strokeWidth="1.5" />
      <circle cx="100" cy="100" r="50" fill="none" stroke={STAMP} strokeWidth="1.5" />
      <text fill={STAMP} fontSize="19" fontWeight="700" textAnchor="middle">
        <textPath href="#stamp-top" startOffset="50%">بن سلمه العقارية</textPath>
      </text>
      <text fill={STAMP} fontSize="12" fontWeight="600" textAnchor="middle" letterSpacing="1.5">
        <textPath href="#stamp-bottom" startOffset="50%">BIN SLMAH REAL ESTATE</textPath>
      </text>
      <text x="100" y={crNo ? 84 : 92} fill={STAMP} fontSize="15" fontWeight="700" textAnchor="middle">مُستلَم</text>
      {crNo && <text x="100" y="102" fill={STAMP} fontSize="10.5" fontWeight="700" textAnchor="middle">س.ت {crNo}</text>}
      <text x="100" y={crNo ? 120 : 112} fill={STAMP} fontSize="11" textAnchor="middle" fontFamily="monospace">{date}</text>
      <text x="38" y="104" fill={STAMP} fontSize="12" textAnchor="middle">★</text>
      <text x="162" y="104" fill={STAMP} fontSize="12" textAnchor="middle">★</text>
    </svg>
  );
}
