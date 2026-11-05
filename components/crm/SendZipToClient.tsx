"use client";

/**
 * «📤 إرسال للعميل» on a property card: pick up to 5 clients (saved ones, or numbers typed in the box) and send, straight
 * to their WhatsApp through the CRM's linked number, any of: the property message, the Google Drive link of the photos,
 * the project PDF. Each saved client is then marked with what they received (see SentBadge). From a request's matching
 * list the recipient is fixed (`client`) and the send is also recorded on that request.
 */
import { useEffect, useMemo, useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { visibleClients, propMsg, reqsOf, OPEN_REQ } from "@/lib/crm/logic";
import { intl } from "@/lib/crm/util";
import { seesAllOf, waApi, type WaSource } from "@/lib/crm/wa";
import { markSent, reqSent } from "@/lib/crm/actions";
import type { Client, Property } from "@/lib/crm/types";

const MAX = 5;
interface Who { key: string; id: string; name: string; phone: string }
type Kind = "msg" | "drive" | "pdf";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const KIND_AR: Record<Kind, string> = { msg: "الرسالة", drive: "رابط الصور", pdf: "الملف" };

/** `client` fixes the recipient (from a request's matching list); `reqId` also records the offer on that request. */
export function SendZipToClient({ p, onClose, client, reqId, onSent }: { p: Property; onClose: () => void; client?: Client; reqId?: string; onSent?: () => void }) {
  const { data, toast } = useCrm();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Who[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; ok: boolean; why?: string }[] | null>(null);
  const [source, setSource] = useState<WaSource | null | undefined>(undefined); // undefined = still checking, null = none connected

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

  const has = (key: string) => sel.some((w) => w.key === key);
  const toggle = (w: Who) => {
    if (has(w.key)) return setSel(sel.filter((x) => x.key !== w.key));
    if (sel.length >= MAX) return toast("الحد الأقصى " + MAX + " عملاء في المرة الواحدة");
    setSel([...sel, w]);
  };
  const recipients: Who[] = client ? [{ key: client.id, id: client.id, name: client.name, phone: String(client.phone || "") }] : sel;

  // What goes out: the property message, the Drive link (added to the same message), the project PDF (right after).
  const [withMsg, setWithMsg] = useState(true);
  const [withDrive, setWithDrive] = useState(!!p.driveLink);
  const [withPdf, setWithPdf] = useState(!!p.pdfUrl);
  const [pdfCaption, setPdfCaption] = useState(p.pdfCaption || "");
  const nl = String.fromCharCode(10);
  const anything = withMsg || (withDrive && !!p.driveLink) || (withPdf && !!p.pdfUrl);

  // «onSent» (e.g. opening the visit booking) runs when the result panel is closed, so it is not cut off.
  const close = () => { onClose(); if (done?.some((x) => x.ok)) onSent?.(); };

  /** What this person already received for this property (saved clients only; a typed number has no record). */
  const sentOf = (id: string): Partial<Record<Kind, string>> => (data.clients.find((c) => c.id === id)?.sentProps || {})[p.id] || {};
  const gotLine = (id: string) => (["msg", "drive", "pdf"] as Kind[]).filter((k) => sentOf(id)[k]).map((k) => KIND_AR[k]).join(" + ");

  async function sendNow() {
    if (!recipients.length || !source) return;
    const allKinds = ([withMsg && "msg", withDrive && p.driveLink && "drive", withPdf && p.pdfUrl && "pdf"].filter(Boolean)) as Kind[];
    const results: { name: string; ok: boolean; why?: string }[] = [];
    for (let i = 0; i < recipients.length; i++) {
      const w = recipients[i];
      setBusy("جارٍ الإرسال " + (i + 1) + " من " + recipients.length + " — " + w.name + "…");
      const phone = intl(w.phone);
      let ok = false;
      // Each thing goes to a client once (message, photos link, file): what he already received is skipped; nothing left = refused.
      const got = sentOf(w.id);
      const kinds = allKinds.filter((k) => !got[k]);
      const skipped = allKinds.filter((k) => got[k]);
      if (!kinds.length) { results.push({ name: w.name, ok: false, why: "أُرسل له سابقاً: " + skipped.map((k) => KIND_AR[k]).join(" + ") }); continue; }
      const sMsg = kinds.includes("msg"), sDrive = kinds.includes("drive"), sPdf = kinds.includes("pdf");
      if (phone) {
        const jid = phone + "@s.whatsapp.net";
        try {
          const parts: string[] = [];
          if (sMsg) parts.push(propMsg(p));
          if (sDrive && p.driveLink) parts.push("حياك الله، تفضل طال عمرك هذا رابط ملف الصور:" + nl + p.driveLink);
          if (parts.length) await waApi("/api/send", { source: source.id, jid, text: parts.join(nl + nl) });
          if (sPdf && p.pdfUrl) {
            await waApi("/api/send-media", { source: source.id, jid, url: p.pdfUrl, fileName: (p.pdfName || "ملف المشروع").replace(new RegExp(String.fromCharCode(92) + ".pdf$", "i"), "") + ".pdf", ...(pdfCaption.trim() ? { caption: pdfCaption.trim() } : {}) });
          }
          ok = true;
          // Mark what went out on the client (saved clients only; a typed number has no file).
          if (w.id !== "typed") {
            // Sent from any section: the client's open request moves to «أرسلنا خيارات» and the offer is recorded.
            let logged = false;
            try {
              const cl = data.clients.find((c) => c.id === w.id);
              const rid = reqId || (cl ? reqsOf(data, cl).find((x) => OPEN_REQ(x))?.id : undefined);
              if (rid) { await reqSent(data, rid, p.id); logged = true; }
            } catch { /* the message went out; only the record failed */ }
            try {
              await markSent(data, w.id, p, kinds, !logged);
            } catch { /* the message went out; only the record failed */ }
          }
        } catch { /* reported below */ }
      }
      results.push({ name: w.name, ok, why: ok && skipped.length ? "لم يُعد إرسال: " + skipped.map((k) => KIND_AR[k]).join(" + ") + " (أُرسل سابقاً)" : undefined });
      if (i < recipients.length - 1) await sleep(2000); // a short gap between people, like a person would
    }
    setBusy(null);
    setDone(results);
    const n = results.filter((x) => x.ok).length;
    toast(n === results.length ? "أُرسل إلى " + n + (n === 1 ? " عميل" : " عملاء") : "أُرسل إلى " + n + " من " + results.length + " — راجع القائمة");
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/40 p-3" onClick={busy ? undefined : close}>
      <div className="crm-card grid max-h-[90vh] w-full max-w-lg grid-rows-[auto_1fr_auto] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 border-b border-[var(--crm-line)] px-4 py-3">
          <b className="truncate">📤 إرسال «{p.ref ? "#" + p.ref + " " : ""}{p.title}» للعملاء</b>
          <button type="button" className="crm-btn ghost sm" disabled={!!busy} onClick={close}>إغلاق</button>
        </div>

        {done ? (
          <div className="grid content-start gap-2 overflow-y-auto p-3">
            <b className="text-[15px]">{done.every((x) => x.ok) ? "✓ تم الإرسال" : "انتهى الإرسال"}</b>
            {done.map((x, i) => (
              <div key={i} className={"flex items-center justify-between gap-2 rounded-lg border p-2 " + (x.ok ? "border-[#00a884] bg-[#e7fce3]" : "border-[var(--crm-danger)] bg-[var(--crm-surface-2)]")}>
                <b className="truncate text-[14px]">{x.name}</b>
                <span className="text-end text-[13px]">{x.ok ? "✓ أُرسل" : "✗ تعذّر الإرسال"}{x.why && <span className="block text-[12px] text-[var(--crm-ink-3)]">{x.why}</span>}</span>
              </div>
            ))}
            <span className="text-[12.5px] text-[var(--crm-ink-3)]">من أُرسل له صارت عنده علامة «أُرسل» في العملاء والطلبات.</span>
          </div>
        ) : (
          <div className="grid content-start gap-2 overflow-y-auto p-3">
            <span className="text-[13px] text-[var(--crm-ink-2)]">حدّد ما تريد إرساله، ثم اختر حتى {MAX} عملاء — يصل على واتساب كل واحد مباشرة.</span>
            {source === null && <span className="rounded-lg bg-[var(--crm-warn-soft)] p-2 text-[13px] text-[var(--crm-warn)]">واتساب الشركة غير متصل الآن.</span>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13.5px]">
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={withMsg} onChange={(e) => setWithMsg(e.target.checked)} /> رسالة العقار</label>
              <label className={"flex items-center gap-1.5 " + (p.driveLink ? "" : "opacity-50")}><input type="checkbox" disabled={!p.driveLink} checked={withDrive && !!p.driveLink} onChange={(e) => setWithDrive(e.target.checked)} /> رابط الصور (درايف){!p.driveLink && " — غير مضاف"}</label>
              <label className={"flex items-center gap-1.5 " + (p.pdfUrl ? "" : "opacity-50")}><input type="checkbox" disabled={!p.pdfUrl} checked={withPdf && !!p.pdfUrl} onChange={(e) => setWithPdf(e.target.checked)} /> ملف المشروع PDF{!p.pdfUrl && " — غير مرفوع"}</label>
            </div>
            {withPdf && !!p.pdfUrl && <input placeholder="نص مع الملف (اختياري)" value={pdfCaption} onChange={(e) => setPdfCaption(e.target.value)} />}
            {client ? <b className="text-[14px]">إلى: {client.name} <span className="num font-normal text-[var(--crm-ink-3)]" dir="ltr">{client.phone}</span>{gotLine(client.id) && <span className="block text-[12px] font-normal text-[var(--crm-ink-3)]">أُرسل له سابقاً: {gotLine(client.id)} — لن يُعاد إرساله</span>}</b> : (
              <>
                {sel.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {sel.map((w) => (
                      <button key={w.key} type="button" onClick={() => toggle(w)} className="rounded-full bg-[#e7fce3] px-2.5 py-1 text-[13px] font-semibold text-[#008069]">{w.name} ✕</button>
                    ))}
                    <span className="self-center text-[12.5px] text-[var(--crm-ink-3)]">{sel.length} من {MAX}</span>
                  </div>
                )}
                <input placeholder="اكتب اسم العميل أو رقم جواله…" value={q} onChange={(e) => setQ(e.target.value)} />
                {typedPhone && (
                  <button type="button" onClick={() => toggle({ key: "n:" + typedPhone, id: "typed", name: q.trim(), phone: q.trim() })}
                    className={"flex items-center justify-between gap-2 rounded-lg border p-2 text-start " + (has("n:" + typedPhone) ? "border-[#00a884] bg-[#e7fce3]" : "border-dashed border-[var(--crm-line)] hover:bg-[var(--crm-surface-2)]")}>
                    <b className="text-[14px]">إرسال إلى هذا الرقم</b>
                    <span className="num text-[13px]" dir="ltr">{q.trim()}</span>
                  </button>
                )}
                {clients.length ? clients.map((c) => (
                  <button key={c.id} type="button" onClick={() => toggle({ key: c.id, id: c.id, name: c.name, phone: String(c.phone || "") })}
                    className={"flex items-center justify-between gap-2 rounded-lg border p-2 text-start " + (has(c.id) ? "border-[#00a884] bg-[#e7fce3]" : "border-[var(--crm-line)] hover:bg-[var(--crm-surface-2)]")}>
                    <b className="truncate text-[14px]">{has(c.id) ? "✓ " : ""}{c.name}{gotLine(c.id) && <span className="ms-2 text-[11.5px] font-normal text-[var(--crm-ink-3)]">أُرسل له: {gotLine(c.id)}</span>}</b>
                    <span className="num text-[12.5px] text-[var(--crm-ink-3)]" dir="ltr">{c.phone}</span>
                  </button>
                )) : !typedPhone && <p className="m-0 py-6 text-center text-[var(--crm-ink-3)]">لا يوجد عميل بهذا الاسم. اكتب رقم الجوال للإرسال مباشرة.</p>}
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--crm-line)] px-4 py-3">
          {busy && <span className="me-auto text-[13px] text-[var(--crm-ink-3)]">{busy}</span>}
          {done
            ? <button type="button" className="crm-btn primary" onClick={close}>تم</button>
            : <button type="button" className="crm-btn primary" disabled={!!busy || !recipients.length || !source || !anything} onClick={sendNow}>إرسال{recipients.length > 1 ? " إلى " + recipients.length + " عملاء" : recipients.length === 1 ? " إلى " + recipients[0].name : ""}</button>}
        </div>
      </div>
    </div>
  );
}
