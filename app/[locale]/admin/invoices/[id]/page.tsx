"use client";

/**
 * One tax invoice. `/admin/invoices/new` (optionally `?req=<requestId>` to bill a
 * deal's commission) opens an editor; drafts can be edited, deleted or issued.
 * Issuing assigns the sequential number, the issue time and the ZATCA QR, after
 * which the invoice is read-only: print / save as PDF, send on WhatsApp, or
 * (managers) cancel with a reason. When the CRM is linked to ZATCA (Phase 2,
 * settings.zatcaOn) an issued invoice is signed and reported / cleared by the
 * server right away, its QR becomes ZATCA's, and cancelling issues a credit
 * note (إشعار دائن) instead of just marking it cancelled.
 */
import { Suspense, use, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { Link, useRouter } from "@/i18n/navigation";
import { useCrm } from "@/lib/crm/store";
import { clientById, comm, nameOf, propById, visibleClients } from "@/lib/crm/logic";
import { remove, write } from "@/lib/crm/actions";
import { issueInvoice, round2, SELLER_NAME, sellerAddress, totalsOf } from "@/lib/crm/invoice";
import { tafqit } from "@/lib/crm/tafqit";
import type { Invoice, InvoiceLine } from "@/lib/crm/types";
import { nowStamp, num, today } from "@/lib/crm/util";
import { ConfirmButton, Empty, Pill } from "@/components/crm/ui";
import { sendDocWhatsApp } from "@/components/crm/shareDoc";
import { zatcaSubmit } from "@/lib/crm/zatca";

const INK = "#333333", GOLD = "#b79579";
const sar = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const greg = (iso: string) => { const d = new Date(iso); return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear(); };
const time = (iso: string) => new Date(iso).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit" });

/** Sends an issued invoice to ZATCA and words the outcome for a toast. */
async function submitMsg(id: string) {
  try {
    const r = await zatcaSubmit(id);
    if (r.already) return "الفاتورة مُرسلة للهيئة مسبقاً";
    return r.ok ? "الهيئة: " + r.status + " ✓" : "رفضت الهيئة الفاتورة — راجع الأخطاء في الفاتورة";
  } catch (e) {
    return "تعذّر الإرسال للهيئة: " + (e as Error).message;
  }
}

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Suspense fallback={<Empty>جارٍ التحميل…</Empty>}><InvoiceView id={id} /></Suspense>;
}

type Draft = Omit<Invoice, "id" | "no" | "seq" | "status" | "issueAt" | "qr" | "subtotal" | "vat" | "total" | "createdBy" | "createdAt" | "updatedAt">;

function InvoiceView({ id }: { id: string }) {
  const { data, loaded, invoices, settings, toast } = useCrm();
  const sp = useSearchParams();
  const router = useRouter();
  const inv = id === "new" ? null : invoices.find((x) => x.id === id) || null;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [inclusive, setInclusive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [qrImg, setQrImg] = useState("");
  // Give a just-saved invoice a moment to arrive from the database before calling it missing.
  const [waited, setWaited] = useState(false);
  useEffect(() => { const t = setTimeout(() => setWaited(true), 6000); return () => clearTimeout(t); }, [id]);
  const sheet = useRef<HTMLElement>(null);

  // Starting values: the saved draft, or a new one (prefilled from a deal when ?req= is given).
  useEffect(() => {
    if (draft || !loaded) return;
    if (inv) {
      if (inv.status === "مسودة") setDraft({ ...inv });
      return;
    }
    if (id !== "new") return;
    const r = data.requests.find((x) => x.id === sp.get("req"));
    const c = clientById(data, r?.clientId || sp.get("client"));
    const p = r ? propById(data, r.propertyId) : undefined;
    setDraft({
      kind: "simplified", supplyDate: today(), buyerName: c?.name || "", buyerPhone: c?.phone || null, buyerVat: null, buyerCr: null, buyerAddress: null,
      clientId: c?.id || null, requestId: r?.id || null, vatRate: 15, notes: null,
      lines: [{ desc: r ? "عمولة (سعي) تسويق عقار" + (p ? " — " + p.title + (r.unit ? " — " + r.unit : "") : "") : "", qty: 1, price: r ? round2(comm(r)) : 0 }],
    });
  }, [loaded, inv, id, sp, data, draft]);

  useEffect(() => {
    const qr = inv?.zatca?.qr || inv?.qr;
    if (qr) QRCode.toDataURL(qr, { margin: 1, width: 220, errorCorrectionLevel: "M" }).then(setQrImg).catch(() => setQrImg(""));
  }, [inv?.qr, inv?.zatca?.qr]);

  if (!loaded) return <Empty>جارٍ تحميل البيانات…</Empty>;
  if (id !== "new" && !inv) return <Empty>{waited ? "الفاتورة غير موجودة — حدّث الصفحة، أو ارجع إلى قائمة الفواتير." : "جارٍ تحميل الفاتورة…"}</Empty>;

  /* ---------- editor (new / draft) ---------- */
  if (!inv || inv.status === "مسودة") {
    if (!draft) return <Empty>جارٍ التحميل…</Empty>;
    const d = draft;
    const set = (p: Partial<Draft>) => setDraft({ ...d, ...p });
    const setLine = (i: number, p: Partial<InvoiceLine>) => set({ lines: d.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) });
    const t = totalsOf(d.lines, d.vatRate);
    const body = () => ({
      ...d, buyerName: d.buyerName.trim(), lines: d.lines.filter((l) => l.desc.trim() || l.price).map((l) => ({ desc: l.desc.trim(), qty: Number(l.qty) || 1, price: round2(Number(l.price) || 0) })),
      ...t, updatedAt: nowStamp(),
    });
    const check = () => {
      const b = body();
      if (!b.buyerName) return "اكتب اسم العميل";
      if (!b.lines.length || !b.lines.some((l) => l.price > 0)) return "أضف بنداً واحداً على الأقل بمبلغ";
      if (settings.zatcaOn && b.kind === "standard") {
        if (!b.buyerVat && !b.buyerCr) return "الفاتورة الضريبية لمنشأة تحتاج الرقم الضريبي أو السجل التجاري للمشتري";
        if (b.buyerVat && !/^3\d{13}3$/.test(b.buyerVat)) return "الرقم الضريبي للمشتري 15 رقماً يبدأ وينتهي بـ 3";
        if (!b.buyerStreet || !b.buyerBuilding || !b.buyerDistrict || !b.buyerCity || !b.buyerPostal) return "أكمل العنوان الوطني للمشتري (الشارع، المبنى، الحي، المدينة، الرمز البريدي)";
      }
      return "";
    };
    async function save(): Promise<string | null> {
      const err = check();
      if (err) { toast(err); return null; }
      setBusy(true);
      try {
        if (inv) { await write("invoices", inv.id, body(), "update"); return inv.id; }
        const nid = await write("invoices", null, { ...body(), no: null, seq: null, status: "مسودة", issueAt: null, qr: null, createdBy: data.uid, createdAt: nowStamp() });
        router.replace("/admin/invoices/" + nid);
        return nid;
      } catch {
        toast("تعذّر الحفظ");
        return null;
      } finally {
        setBusy(false);
      }
    }
    async function issue() {
      if (!settings.vatNo) return toast("أدخل الرقم الضريبي للمنشأة أولاً من الإعدادات ← أدوات ← بيانات المنشأة");
      const nid = await save();
      if (!nid) return;
      setBusy(true);
      try {
        const no = await issueInvoice({ ...(body() as Invoice), id: nid }, settings, data.uid);
        setDraft(null);
        toast("صدرت الفاتورة " + no + (settings.zatcaOn ? " — جارٍ إرسالها للهيئة…" : ""));
        if (!inv) router.replace("/admin/invoices/" + nid);
        if (settings.zatcaOn) toast(await submitMsg(nid));
      } catch {
        toast("تعذّر إصدار الفاتورة");
      } finally {
        setBusy(false);
      }
    }
    const price = (l: InvoiceLine) => (inclusive ? round2(l.price * (1 + d.vatRate / 100)) : l.price);
    return (
      <div className="grid max-w-4xl gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="m-0 flex-1 text-[20px]">{inv ? "مسودة فاتورة" : "فاتورة جديدة"}</h1>
          <Link href="/admin/invoices" className="crm-btn ghost sm">كل الفواتير</Link>
        </div>
        {!settings.vatNo && data.isAdmin && <p className="m-0 rounded-lg bg-[var(--crm-warn-soft,#fff7e6)] px-3 py-2 text-[13px]">لإصدار فواتير ضريبية أدخل الرقم الضريبي والعنوان الوطني من <Link className="link" href="/admin/setup">الإعدادات ← أدوات ← بيانات المنشأة</Link>.</p>}
        <div className="crm-card grid gap-3 p-4 sm:grid-cols-2">
          <div className="crm-field"><label>نوع الفاتورة</label>
            <select value={d.kind} onChange={(e) => set({ kind: e.target.value as Draft["kind"] })}>
              <option value="simplified">فاتورة ضريبية مبسطة (لفرد)</option>
              <option value="standard">فاتورة ضريبية (لمنشأة)</option>
            </select>
          </div>
          <div className="crm-field"><label>تاريخ التوريد</label><input type="date" value={d.supplyDate || ""} onChange={(e) => set({ supplyDate: e.target.value || null })} /></div>
          <div className="crm-field"><label>العميل من النظام (اختياري)</label>
            <select value={d.clientId || ""} onChange={(e) => { const c = clientById(data, e.target.value); set({ clientId: c?.id || null, buyerName: c?.name || d.buyerName, buyerPhone: c?.phone || d.buyerPhone }); }}>
              <option value="">—</option>
              {visibleClients(data).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="crm-field"><label>اسم المشتري *</label><input value={d.buyerName} onChange={(e) => set({ buyerName: e.target.value })} /></div>
          <div className="crm-field"><label>جوال المشتري</label><input dir="ltr" value={d.buyerPhone || ""} onChange={(e) => set({ buyerPhone: e.target.value || null })} /></div>
          <>
            <div className="crm-field"><label>الرقم الضريبي للمشتري (إن وُجد)</label><input dir="ltr" inputMode="numeric" value={d.buyerVat || ""} onChange={(e) => set({ buyerVat: e.target.value.replace(/\D/g, "") || null })} /></div>
            <div className="crm-field"><label>السجل التجاري للمشتري (اختياري)</label><input dir="ltr" value={d.buyerCr || ""} onChange={(e) => set({ buyerCr: e.target.value || null })} /></div>
            {d.kind === "standard" ? (
              <div className="grid gap-2 sm:col-span-2 sm:grid-cols-5">
                <span className="crm-hint sm:col-span-5">العنوان الوطني للمشتري{settings.zatcaOn ? " (مطلوب للهيئة)" : ""}</span>
                <input placeholder="الشارع" value={d.buyerStreet || ""} onChange={(e) => set({ buyerStreet: e.target.value || null })} />
                <input placeholder="رقم المبنى" dir="ltr" inputMode="numeric" value={d.buyerBuilding || ""} onChange={(e) => set({ buyerBuilding: e.target.value.replace(/\D/g, "").slice(0, 4) || null })} />
                <input placeholder="الحي" value={d.buyerDistrict || ""} onChange={(e) => set({ buyerDistrict: e.target.value || null })} />
                <input placeholder="المدينة" value={d.buyerCity || ""} onChange={(e) => set({ buyerCity: e.target.value || null })} />
                <input placeholder="الرمز البريدي" dir="ltr" inputMode="numeric" value={d.buyerPostal || ""} onChange={(e) => set({ buyerPostal: e.target.value.replace(/\D/g, "").slice(0, 5) || null })} />
              </div>
            ) : (
              <div className="crm-field sm:col-span-2"><label>عنوان المشتري (اختياري)</label><input value={d.buyerAddress || ""} onChange={(e) => set({ buyerAddress: e.target.value || null })} /></div>
            )}
          </>
        </div>

        <div className="crm-card grid gap-2 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <b className="flex-1">البنود</b>
            <label className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[var(--crm-gold)]" checked={inclusive} onChange={(e) => setInclusive(e.target.checked)} /> أُدخل المبالغ شاملة الضريبة</label>
            <label className="flex items-center gap-1 text-[13px]">نسبة الضريبة
              <select className="!w-auto" value={d.vatRate} onChange={(e) => set({ vatRate: Number(e.target.value) })}><option value={15}>15%</option><option value={0}>0% (معفى)</option></select>
            </label>
          </div>
          <div className="hidden grid-cols-[1fr_70px_150px_32px] gap-2 text-[12px] text-[var(--crm-ink-3)] sm:grid"><span>الوصف</span><span>الكمية</span><span>{inclusive ? "سعر الوحدة شامل الضريبة" : "سعر الوحدة قبل الضريبة"}</span><span /></div>
          {d.lines.map((l, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_70px_150px_32px]">
              <input placeholder="مثال: عمولة تسويق فيلا حي الملقا" value={l.desc} onChange={(e) => setLine(i, { desc: e.target.value })} />
              <input className="num" inputMode="decimal" value={String(l.qty)} onChange={(e) => setLine(i, { qty: num(e.target.value) || 0 })} />
              <input className="num" inputMode="decimal" value={String(price(l) || "")} placeholder="0.00"
                onChange={(e) => { const v = num(e.target.value) || 0; setLine(i, { price: inclusive ? round2(v / (1 + d.vatRate / 100)) : v }); }} />
              <button type="button" className="crm-btn ghost sm" aria-label="حذف البند" onClick={() => set({ lines: d.lines.length > 1 ? d.lines.filter((_, j) => j !== i) : d.lines })}>×</button>
            </div>
          ))}
          <button type="button" className="crm-btn sm justify-self-start" onClick={() => set({ lines: [...d.lines, { desc: "", qty: 1, price: 0 }] })}>+ بند</button>
          <div className="grid justify-items-end gap-0.5 text-[14px]">
            <span>الإجمالي قبل الضريبة: <b className="num">{sar(t.subtotal)}</b> ريال</span>
            <span>ضريبة القيمة المضافة ({d.vatRate}%): <b className="num">{sar(t.vat)}</b> ريال</span>
            <span className="text-[16px]">الإجمالي المستحق: <b className="num">{sar(t.total)}</b> ريال</span>
          </div>
          <div className="crm-field"><label>ملاحظات (تُطبع على الفاتورة)</label><textarea rows={2} value={d.notes || ""} onChange={(e) => set({ notes: e.target.value || null })} /></div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="crm-btn primary" disabled={busy} onClick={issue}>🧾 إصدار الفاتورة</button>
          <button type="button" className="crm-btn" disabled={busy} onClick={async () => { if (await save()) toast("حُفظت المسودة"); }}>حفظ كمسودة</button>
          {inv && <ConfirmButton onConfirm={async () => { await remove("invoices", inv.id); toast("حُذفت المسودة"); router.replace("/admin/invoices"); }}>حذف المسودة</ConfirmButton>}
          <span className="crm-hint">بعد الإصدار يأخذ رقماً تسلسلياً ورمز QR ولا يمكن تعديله — يمكن إلغاؤه فقط.{settings.zatcaOn ? " تُرسل للهيئة تلقائياً." : ""}</span>
        </div>
      </div>
    );
  }

  /* ---------- issued / cancelled ---------- */
  const v = inv;
  const cancelled = v.status === "ملغاة";
  const credit = v.docType === "credit";
  const addr = sellerAddress(settings);
  const buyerAddr = [v.buyerBuilding && "مبنى " + v.buyerBuilding, v.buyerStreet, v.buyerDistrict && "حي " + v.buyerDistrict, v.buyerCity, v.buyerPostal].filter(Boolean).join("، ") || v.buyerAddress;
  const z = v.zatca;
  async function resubmit() {
    setBusy(true);
    try { toast(await submitMsg(v.id)); } finally { setBusy(false); }
  }
  async function send() {
    if (!v.buyerPhone || !sheet.current) return toast("لا يوجد رقم جوال للمشتري");
    setBusy(true);
    try {
      toast(await sendDocWhatsApp(data, sheet.current, v.buyerPhone, "فاتورة رقم " + v.no + " — الإجمالي " + sar(v.total) + " ريال\nشاكرين لكم تعاملكم، بن سلمه العقارية", "فاتورة-" + v.no));
    } catch {
      toast("تعذّر الإرسال");
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    const why = window.prompt("سبب إلغاء الفاتورة " + v.no + ":" + (settings.zatcaOn && z ? "\n(سيصدر إشعار دائن ويُرسل للهيئة)" : ""));
    if (!why || !why.trim()) return;
    if (settings.zatcaOn && z && z.status !== "مرفوضة") return creditNote(why.trim());
    try {
      await write("invoices", v.id, { status: "ملغاة", cancelReason: why.trim(), cancelledAt: nowStamp(), cancelledBy: data.uid, updatedAt: nowStamp() }, "update");
      toast("أُلغيت الفاتورة");
    } catch {
      toast("تعذّر الإلغاء");
    }
  }
  /** ZATCA does not allow deleting a reported invoice: it is reversed with a credit note that references it. */
  async function creditNote(why: string) {
    setBusy(true);
    try {
      const at = nowStamp();
      const body = {
        kind: v.kind, supplyDate: today(), buyerName: v.buyerName, buyerPhone: v.buyerPhone, buyerVat: v.buyerVat, buyerCr: v.buyerCr, buyerAddress: v.buyerAddress,
        buyerStreet: v.buyerStreet || null, buyerBuilding: v.buyerBuilding || null, buyerDistrict: v.buyerDistrict || null, buyerCity: v.buyerCity || null, buyerPostal: v.buyerPostal || null,
        clientId: v.clientId, requestId: v.requestId, lines: v.lines, vatRate: v.vatRate, subtotal: v.subtotal, vat: v.vat, total: v.total, notes: null,
        docType: "credit" as const, billingRef: v.no, reason: why,
      };
      const nid = await write("invoices", null, { ...body, no: null, seq: null, status: "مسودة", issueAt: null, qr: null, createdBy: data.uid, createdAt: at, updatedAt: at });
      const no = await issueInvoice({ ...body, id: nid } as unknown as Invoice, settings, data.uid);
      await write("invoices", v.id, { status: "ملغاة", cancelReason: why, cancelledAt: nowStamp(), cancelledBy: data.uid, creditNoteId: nid, updatedAt: nowStamp() }, "update");
      toast("صدر الإشعار الدائن " + no + " — جارٍ إرساله للهيئة…");
      router.push("/admin/invoices/" + nid);
      toast(await submitMsg(nid));
    } catch {
      toast("تعذّر إصدار الإشعار الدائن");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="crm-noprint mb-4 flex flex-wrap items-center gap-2">
        <Link href="/admin/invoices" className="crm-btn ghost sm">كل الفواتير</Link>
        <b className="num flex-1">{v.no}</b>
        {cancelled ? <Pill tone="hot">ملغاة — {v.cancelReason}</Pill> : <Pill tone="ok">{credit ? "إشعار دائن" : "صادرة"}</Pill>}
        {z && <Pill tone={z.status === "مرفوضة" ? "hot" : "ok"}>الهيئة: {z.status}</Pill>}
        {v.creditNoteId && <Link className="crm-btn ghost sm" href={"/admin/invoices/" + v.creditNoteId}>الإشعار الدائن</Link>}
        {settings.zatcaOn && (!z || z.status === "مرفوضة") && <button type="button" className="crm-btn sm" disabled={busy} onClick={resubmit}>{z ? "إعادة الإرسال للهيئة" : "إرسال للهيئة"}</button>}
        <button type="button" className="crm-btn primary" onClick={() => window.print()}>🖨 طباعة / حفظ PDF</button>
        {!cancelled && <button type="button" className="crm-btn wa" disabled={busy || !v.buyerPhone} onClick={send}>📤 إرسال للعميل واتساب</button>}
        {!cancelled && !credit && data.isMgr && <button type="button" className="crm-btn ghost" disabled={busy} onClick={cancel}>إلغاء الفاتورة</button>}
      </div>
      {z && z.status === "مرفوضة" && (
        <div className="crm-noprint mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[13px] text-red-800">
          <b>رفضت الهيئة الفاتورة:</b>
          <ul className="m-0 ps-5">{(z.errors || []).map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
      {z && !!z.warnings?.length && z.status !== "مرفوضة" && <p className="crm-noprint crm-hint mb-4">ملاحظات الهيئة: {z.warnings.join("، ")}</p>}

      <article ref={sheet} className="crm-report relative mx-auto max-w-[820px] overflow-hidden rounded-2xl bg-white p-8 text-[#333] shadow-sm print:max-w-none print:rounded-none print:p-2 print:shadow-none" style={{ border: "2px solid " + GOLD }}>
        {cancelled && <div className="pointer-events-none absolute inset-0 grid place-items-center"><span className="rotate-[-20deg] rounded-xl border-4 border-red-600/50 px-6 py-2 font-heading text-[56px] text-red-600/40">ملغاة</span></div>}
        <header className="flex items-start gap-4 border-b-2 pb-4" style={{ borderColor: GOLD }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-mark-dark.png" alt="" className="h-16 w-16 object-contain" />
          <div className="flex-1 text-[12.5px] leading-5 text-[#555]">
            <div className="font-heading text-[22px] leading-tight" style={{ color: INK }}>{SELLER_NAME}</div>
            {settings.vatNo && <div>الرقم الضريبي: <b className="num">{settings.vatNo}</b></div>}
            {settings.crNo && <div>السجل التجاري: <b className="num">{settings.crNo}</b></div>}
            {addr && <div>{addr}</div>}
          </div>
          <div className="grid justify-items-center gap-1">
            <div className="grid justify-items-center rounded-xl px-4 py-2 text-white" style={{ background: INK }}>
              <span className="font-heading text-[18px] leading-tight">{credit ? "إشعار دائن" : v.kind === "standard" ? "فاتورة ضريبية" : "فاتورة ضريبية مبسطة"}</span>
              <span className="text-[10px] tracking-[0.15em] opacity-80">{credit ? "CREDIT NOTE" : v.kind === "standard" ? "TAX INVOICE" : "SIMPLIFIED TAX INVOICE"}</span>
            </div>
          </div>
        </header>

        <div className="mt-4 grid grid-cols-2 gap-4 text-[13px] sm:grid-cols-[1fr_1fr_auto]">
          <div className="grid gap-1">
            <div><span className="text-[#888]">{credit ? "رقم الإشعار: " : "رقم الفاتورة: "}</span><b className="num" dir="ltr">{v.no}</b></div>
            {credit && <div><span className="text-[#888]">الفاتورة الأصلية: </span><b className="num" dir="ltr">{v.billingRef}</b></div>}
            {credit && v.reason && <div><span className="text-[#888]">السبب: </span><b>{v.reason}</b></div>}
            <div><span className="text-[#888]">تاريخ الإصدار: </span><b className="num">{v.issueAt ? greg(v.issueAt) + " " + time(v.issueAt) : ""}</b></div>
            {v.supplyDate && <div><span className="text-[#888]">تاريخ التوريد: </span><b className="num">{greg(v.supplyDate)}</b></div>}
          </div>
          <div className="grid content-start gap-1 rounded-lg px-3 py-2" style={{ background: "#f8f5f2" }}>
            <b style={{ color: INK }}>المشتري</b>
            <span>{v.buyerName}</span>
            {v.buyerVat && <span>الرقم الضريبي: <b className="num">{v.buyerVat}</b></span>}
            {v.buyerCr && <span>السجل التجاري: <b className="num">{v.buyerCr}</b></span>}
            {buyerAddr && <span>{buyerAddr}</span>}
            {v.buyerPhone && <span className="num" dir="ltr" style={{ textAlign: "right" }}>{v.buyerPhone}</span>}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qrImg && <img src={qrImg} alt="رمز الفاتورة الإلكترونية" className="col-span-2 h-[120px] w-[120px] justify-self-center sm:col-span-1" />}
        </div>

        <table className="mt-5 w-full border-collapse text-[13px]">
          <thead>
            <tr style={{ background: INK, color: "#fff" }}>
              {["#", "الوصف", "الكمية", "سعر الوحدة", "المبلغ الخاضع للضريبة", "الضريبة " + v.vatRate + "%", "الإجمالي شامل الضريبة"].map((h) => <th key={h} className="px-2 py-2 text-start font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {v.lines.map((l, i) => {
              const base = round2(l.qty * l.price), tax = round2((base * v.vatRate) / 100);
              return (
                <tr key={i} className="border-b border-[#eee]">
                  <td className="px-2 py-2">{i + 1}</td><td className="px-2">{l.desc}</td><td className="num px-2">{l.qty}</td>
                  <td className="num px-2">{sar(l.price)}</td><td className="num px-2">{sar(base)}</td><td className="num px-2">{sar(tax)}</td><td className="num px-2 font-semibold">{sar(base + tax)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_300px]">
          <div className="text-[13px]">
            <div className="text-[#888]">المبلغ كتابةً:</div>
            <b>{tafqit(v.total)}</b>
            {v.notes && <div className="mt-3 rounded-lg border px-3 py-2 whitespace-pre-wrap" style={{ borderColor: GOLD }}><b style={{ color: INK }}>ملاحظات: </b>{v.notes}</div>}
            {settings.iban && <div className="mt-3 text-[12.5px] text-[#555]">للتحويل: {settings.bankName} — <span className="num" dir="ltr">{settings.iban.replace(/(.{4})/g, "$1 ").trim()}</span>{settings.accountName ? " — " + settings.accountName : ""}</div>}
          </div>
          <table className="text-[13.5px]">
            <tbody>
              <tr><td className="py-1 text-[#666]">الإجمالي قبل الضريبة</td><td className="num py-1 text-end">{sar(v.subtotal)}</td></tr>
              <tr><td className="py-1 text-[#666]">ضريبة القيمة المضافة {v.vatRate}%</td><td className="num py-1 text-end">{sar(v.vat)}</td></tr>
              <tr className="border-t-2" style={{ borderColor: GOLD }}><td className="py-1.5 font-bold">الإجمالي المستحق (ريال)</td><td className="num py-1.5 text-end font-heading text-[18px]">{sar(v.total)}</td></tr>
            </tbody>
          </table>
        </div>

        <footer className="mt-6 flex items-end justify-between gap-4 text-[11.5px] text-[#999]">
          <span>صدرت بواسطة: {nameOf(data, v.issuedBy || v.createdBy)}{z && z.status !== "مرفوضة" ? " — " + (z.status === "معتمدة" ? "معتمدة من هيئة الزكاة والضريبة والجمارك" : "مُبلّغ عنها لهيئة الزكاة والضريبة والجمارك") : ""}</span>
          {settings.signature && (
            <span className="grid justify-items-center gap-0.5 text-[12px] text-[#666]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={settings.signature} alt="التوقيع" className="h-14 object-contain" />
              {settings.signerName}
            </span>
          )}
        </footer>
      </article>
    </>
  );
}
