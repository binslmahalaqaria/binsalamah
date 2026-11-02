"use client";

/**
 * «📤 إرسال للعميل» on a property card: pick a client (or type a number) and send, straight to their WhatsApp through the
 * CRM's linked number, one of: the property message, the Google Drive link of the photos, or the project PDF file.
 */
import { useEffect, useMemo, useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { visibleClients } from "@/lib/crm/logic";
import { intl } from "@/lib/crm/util";
import { seesAllOf, waApi, type WaSource } from "@/lib/crm/wa";
import { propMsg } from "@/lib/crm/logic";
import type { Property } from "@/lib/crm/types";

export function SendZipToClient({ p, onClose }: { p: Property; onClose: () => void }) {
  const { data, toast } = useCrm();
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  const [typed, setTyped] = useState(false); // sending to the number typed in the search box (not a saved client)
  const [busy, setBusy] = useState<string | null>(null);
  const [source, setSource] = useState<WaSource | null | undefined>(undefined); // undefined = still checking, null = none connected
  const name = (p.ref ? "#" + p.ref + " " : "") + p.title;

  useEffect(() => {
    waApi<{ sources: WaSource[] }>("/api/sources")
      .then((r) => {
        const open = r.sources.filter((s) => s.status === "open");
        setSource(open.find((s) => seesAllOf(s, data.uid || "", data.isMgr)) || open[0] || null);
      })
      .catch(() => setSource(null));
  }, [data.uid, data.isMgr]);

  const clients = useMemo(() => {
    const t = q.trim();
    return visibleClients(data)
      .filter((c) => c.phone && (!t || c.name.includes(t) || String(c.phone).includes(t)))
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
      .slice(0, t ? 100 : 40);
  }, [data, q]);
  // A number typed in the box (any format) can be sent to even if it is not a saved client.
  const typedPhone = useMemo(() => { const d = q.replace(/\D/g, ""); return d.length >= 9 ? intl(q) : null; }, [q]);
  const chosen = typed && typedPhone ? { id: "typed", name: q.trim(), phone: q.trim() } : data.clients.find((c) => c.id === pick) || null;

  // What goes out: the property message, the Drive link (added to the same message), the project PDF (right after).
  const [withMsg, setWithMsg] = useState(true);
  const [withDrive, setWithDrive] = useState(!!p.driveLink);
  const [withPdf, setWithPdf] = useState(!!p.pdfUrl);
  const nl = String.fromCharCode(10);

  async function sendNow() {
    if (!chosen || !source) return;
    const phone = intl(chosen.phone);
    if (!phone) { toast("رقم العميل غير صالح"); return; }
    const jid = phone + "@s.whatsapp.net";
    setBusy("جارٍ الإرسال إلى " + chosen.name + "…");
    try {
      const parts: string[] = [];
      if (withMsg) parts.push(propMsg(p));
      if (withDrive && p.driveLink) parts.push("تفضل طال عمرك هذا رابط ملف الصور" + nl + p.driveLink);
      if (parts.length) await waApi("/api/send", { source: source.id, jid, text: parts.join(nl + nl) });
      if (withPdf && p.pdfUrl) {
        await waApi("/api/send-media", { source: source.id, jid, url: p.pdfUrl, fileName: (p.pdfName || "ملف المشروع").replace(new RegExp(String.fromCharCode(92) + ".pdf$", "i"), "") + ".pdf", caption: "تفضل طال عمرك هذا ملف المشروع" });
      }
      toast("أُرسل إلى " + chosen.name);
      onClose();
    } catch {
      toast("تعذّر الإرسال — تأكد أن واتساب الشركة متصل");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3" onClick={onClose}>
      <div className="crm-card grid max-h-[90vh] w-full max-w-lg grid-rows-[auto_1fr_auto] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 border-b border-[var(--crm-line)] px-4 py-3">
          <b className="truncate">📤 إرسال «{p.title}» للعميل</b>
          <button type="button" className="crm-btn ghost sm" onClick={onClose}>إغلاق</button>
        </div>
        <div className="grid content-start gap-2 overflow-y-auto p-3">
          <span className="text-[13px] text-[var(--crm-ink-2)]">حدّد ما تريد إرساله، ثم اختر العميل — يصل على واتساب العميل مباشرة.</span>
          {source === null && <span className="rounded-lg bg-[var(--crm-warn-soft)] p-2 text-[13px] text-[var(--crm-warn)]">واتساب الشركة غير متصل الآن. </span>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13.5px]">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={withMsg} onChange={(e) => setWithMsg(e.target.checked)} /> رسالة العقار</label>
            <label className={"flex items-center gap-1.5 " + (p.driveLink ? "" : "opacity-50")}><input type="checkbox" disabled={!p.driveLink} checked={withDrive && !!p.driveLink} onChange={(e) => setWithDrive(e.target.checked)} /> رابط الصور (درايف){!p.driveLink && " — غير مضاف"}</label>
            <label className={"flex items-center gap-1.5 " + (p.pdfUrl ? "" : "opacity-50")}><input type="checkbox" disabled={!p.pdfUrl} checked={withPdf && !!p.pdfUrl} onChange={(e) => setWithPdf(e.target.checked)} /> ملف المشروع PDF{!p.pdfUrl && " — غير مرفوع"}</label>
          </div>
          <input placeholder="اكتب اسم العميل أو رقم جواله…" value={q} onChange={(e) => { setQ(e.target.value); setTyped(false); }} />
          {typedPhone && (
            <button type="button" onClick={() => { setTyped(true); setPick(null); }}
              className={"flex items-center justify-between gap-2 rounded-lg border p-2 text-start " + (typed ? "border-[#00a884] bg-[#e7fce3]" : "border-dashed border-[var(--crm-line)] hover:bg-[var(--crm-surface-2)]")}>
              <b className="text-[14px]">إرسال إلى هذا الرقم</b>
              <span className="num text-[13px]" dir="ltr">{q.trim()}</span>
            </button>
          )}
          {clients.length ? clients.map((c) => (
            <button key={c.id} type="button" onClick={() => { setPick(c.id); setTyped(false); }}
              className={"flex items-center justify-between gap-2 rounded-lg border p-2 text-start " + (pick === c.id ? "border-[#00a884] bg-[#e7fce3]" : "border-[var(--crm-line)] hover:bg-[var(--crm-surface-2)]")}>
              <b className="truncate text-[14px]">{c.name}</b>
              <span className="num text-[12.5px] text-[var(--crm-ink-3)]" dir="ltr">{c.phone}</span>
            </button>
          )) : !typedPhone && <p className="m-0 py-6 text-center text-[var(--crm-ink-3)]">لا يوجد عميل بهذا الاسم. اكتب رقم الجوال للإرسال مباشرة.</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--crm-line)] px-4 py-3">
          {busy && <span className="me-auto text-[13px] text-[var(--crm-ink-3)]">{busy}</span>}
          <button type="button" className="crm-btn primary" disabled={!!busy || !chosen || !source || !(withMsg || (withDrive && p.driveLink) || (withPdf && p.pdfUrl))} onClick={sendNow}>إرسال{chosen ? " إلى " + chosen.name : ""}</button>
        </div>
      </div>
    </div>
  );
}
