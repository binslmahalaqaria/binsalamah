"use client";

/**
 * «📤 إرسال للعميل» on a property card (client 2026-11-01): all the property's photos as ONE file (ZIP named after the
 * property), sent straight to a client's WhatsApp through the CRM's linked number — nothing is saved on the employee's
 * phone. Pick the client, press send. If WhatsApp is not linked/connected, the ZIP can still be shared from the device.
 */
import { useEffect, useMemo, useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { visibleClients } from "@/lib/crm/logic";
import { intl } from "@/lib/crm/util";
import { seesAllOf, waApi, type WaSource } from "@/lib/crm/wa";
import { buildImagesZip, shareAllImages } from "./downloadImages";
import type { Property } from "@/lib/crm/types";

const toDataUrl = (blob: Blob) =>
  new Promise<string>((res, rej) => { const f = new FileReader(); f.onload = () => res(String(f.result)); f.onerror = () => rej(new Error("read")); f.readAsDataURL(blob); });

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

  async function sendNow() {
    if (!chosen || !source) return;
    const phone = intl(chosen.phone);
    if (!phone) { toast("رقم العميل غير صالح"); return; }
    setBusy("جارٍ تجهيز الملف…");
    try {
      const { blob, fileName, ok, failed } = await buildImagesZip(p.images || [], name);
      if (!blob) { toast("تعذّر تجهيز الصور"); return; }
      if (blob.size > 15 * 1024 * 1024) { toast("الملف كبير (" + Math.round(blob.size / 1048576) + " م.ب) ويفوق حد واتساب — اختر صوراً أقل أو استخدم «مشاركة من جوالي»"); return; }
      setBusy("جارٍ الإرسال إلى " + chosen.name + "…");
      await waApi("/api/send-media", {
        source: source.id, jid: phone + "@s.whatsapp.net", dataUrl: await toDataUrl(blob), fileName,
        caption: "صور " + p.title + (p.district ? " — حي " + p.district : ""),
      });
      toast("أُرسل الملف إلى " + chosen.name + (failed ? " (تعذّر " + failed + " من " + (ok + failed) + " صورة)" : ""));
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
          <b className="truncate">📤 إرسال صور «{p.title}» للعميل</b>
          <button type="button" className="crm-btn ghost sm" onClick={onClose}>إغلاق</button>
        </div>
        <div className="grid content-start gap-2 overflow-y-auto p-3">
          <span className="text-[13px] text-[var(--crm-ink-2)]">يُرسل ملف واحد فيه {(p.images || []).length} صورة، باسم العقار، على واتساب العميل مباشرة — بدون ما يُحفظ على جوالك.</span>
          {source === null && <span className="rounded-lg bg-[var(--crm-warn-soft)] p-2 text-[13px] text-[var(--crm-warn)]">واتساب الشركة غير متصل الآن. تقدر تستخدم «مشاركة من جوالي» تحت.</span>}
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
          <button type="button" className="crm-btn sm" disabled={!!busy} onClick={async () => {
            setBusy("جارٍ التجهيز…");
            try { const r = await shareAllImages(p.images || [], name); toast(!r.ok ? "تعذّر تجهيز الملف" : r.shared ? "جاهز للمشاركة" : "نُزّل الملف — أرفقه في الواتساب"); }
            catch (e) { toast(e instanceof Error ? e.message : "تعذّر تجهيز الملف"); } finally { setBusy(null); }
          }}>مشاركة من جوالي</button>
          <button type="button" className="crm-btn primary" disabled={!!busy || !chosen || !source} onClick={sendNow}>إرسال{chosen ? " إلى " + chosen.name : ""}</button>
        </div>
      </div>
    </div>
  );
}
