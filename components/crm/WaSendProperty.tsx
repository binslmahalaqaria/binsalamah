"use client";

/**
 * «🏠 إرسال عقار» in the WhatsApp chat: pick a property from the inventory
 * (matches for this client's request first), choose its photos, edit the
 * ready-made message, and send it all to the client in this chat. The send is
 * logged on the client's open request like the matching screen does.
 */
import { useMemo, useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { matchesForReq, propMsg, propPrice, reqsOf } from "@/lib/crm/logic";
import { markSent, reqSent } from "@/lib/crm/actions";
import type { Client, Property } from "@/lib/crm/types";

export function WaSendProperty({ client, onClose, send }: {
  client: Client | null;
  onClose: () => void;
  /** Sends one item to the open chat: a photo by link, or a text message. */
  send: (item: { url: string; fileName?: string; caption?: string } | { text: string }) => Promise<void>;
}) {
  const { data, toast, openModal } = useCrm();
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<Property | null>(null);
  const [imgs, setImgs] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [withPdf, setWithPdf] = useState(false);
  const [withDrive, setWithDrive] = useState(false);

  const req = client ? reqsOf(data, client).find((r) => !["تم البيع", "ملغي"].includes(r.status || "")) : undefined;
  const matched = useMemo(() => (req ? matchesForReq(data, req).map((x) => x.p) : []), [data, req]);
  const list = useMemo(() => {
    const s = q.trim();
    const avail = data.props.filter((p) => (p.status || "متاح") !== "مباع");
    const all = [...matched, ...avail.filter((p) => !matched.includes(p))];
    return s ? all.filter((p) => [p.title, p.district, p.type, p.city].filter(Boolean).join(" ").includes(s)) : all;
  }, [data.props, matched, q]);

  const choose = (p: Property) => {
    setPick(p);
    setImgs((p.images || []).slice(0, 4));
    setMsg(propMsg(p));
    setWithPdf(false);
    setWithDrive(false);
  };

  // Each thing goes to a client once (details + photos, photos link, file): what he already got is not sent again.
  const got = (pick && client?.sentProps?.[pick.id]) || {};
  const gotMsg = !!got.msg, gotDrive = !!got.drive, gotPdf = !!got.pdf;
  const sendMsg = !gotMsg && (imgs.length > 0 || !!msg.trim());
  const sendDrive = withDrive && !gotDrive && !!pick?.driveLink;
  const sendPdf = withPdf && !gotPdf && !!pick?.pdfUrl;

  async function go() {
    if (!pick) return;
    if (!sendMsg && !sendDrive && !sendPdf) return toast("تعذّر الإرسال: أُرسل لهذا العميل سابقاً");
    try {
      for (let i = 0; i < (sendMsg ? imgs.length : 0); i++) {
        setBusy("جارٍ إرسال الصور " + (i + 1) + " من " + imgs.length + "…");
        await send({ url: imgs[i] });
      }
      if (sendMsg && msg.trim()) {
        setBusy("جارٍ إرسال التفاصيل…");
        await send({ text: msg.trim() });
      }
      if (sendDrive && pick.driveLink) {
        setBusy("جارٍ إرسال رابط الصور…");
        await send({ text: "تفضل طال عمرك هذا رابط ملف الصور" + String.fromCharCode(10) + pick.driveLink });
      }
      if (sendPdf && pick.pdfUrl) {
        setBusy("جارٍ إرسال ملف المشروع…");
        await send({ url: pick.pdfUrl, fileName: (pick.pdfName || "ملف المشروع").replace(new RegExp(String.fromCharCode(92) + ".pdf$", "i"), "") + ".pdf", caption: "تفضل طال عمرك هذا ملف المشروع" });
      }
      if (req) await reqSent(data, req.id, pick.id).catch(() => {});
      if (client) await markSent(data, client.id, pick, [sendMsg && "msg", sendDrive && "drive", sendPdf && "pdf"].filter(Boolean) as ("msg" | "drive" | "pdf")[], !req).catch(() => {});
      toast("أُرسل العقار للعميل" + (req ? " وسُجّل في طلبه — حدّد موعد الزيارة" : ""));
      onClose();
      // The next step after sending the property is the visit: open the booking straight away.
      if (req) openModal({ kind: "visit", reqId: req.id, propertyId: pick.id });
    } catch {
      toast("تعذّر إرسال بعض العناصر — تأكد أن الرقم متصل");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3" onClick={onClose}>
      <div className="crm-card grid max-h-[90vh] w-full max-w-2xl grid-rows-[auto_1fr_auto] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 border-b border-[var(--crm-line)] px-4 py-3">
          <b>{pick ? "إرسال: " + pick.title : "🏠 اختر عقاراً من المخزون"}</b>
          <button type="button" className="crm-btn ghost sm" onClick={pick ? () => setPick(null) : onClose}>{pick ? "رجوع" : "إغلاق"}</button>
        </div>

        {!pick ? (
          <div className="grid content-start gap-2 overflow-y-auto p-3">
            <input placeholder="ابحث بالاسم أو الحي أو النوع…" value={q} onChange={(e) => setQ(e.target.value)} />
            {req && matched.length > 0 && !q && <span className="text-[12.5px] text-[var(--crm-ink-3)]">المطابقة لطلب العميل أولاً ({matched.length})</span>}
            {list.length ? list.map((p) => (
              <button key={p.id} type="button" onClick={() => choose(p)}
                className="flex items-center gap-3 rounded-lg border border-[var(--crm-line)] p-2 text-start hover:bg-[var(--crm-surface-2)]">
                {p.images?.[0] ? <img src={p.images[0]} alt="" className="h-14 w-20 shrink-0 rounded object-cover" /> : <span className="grid h-14 w-20 shrink-0 place-items-center rounded bg-[var(--crm-surface-2)] text-xl">🏠</span>}
                <span className="grid min-w-0 flex-1">
                  <b className="truncate text-[14px]">{p.title}{matched.includes(p) && <span className="ms-2 rounded-full bg-[#e7fce3] px-2 text-[11px] font-normal text-[#008069]">مطابق</span>}</b>
                  <span className="truncate text-[12.5px] text-[var(--crm-ink-3)]">{[p.type, p.district && "حي " + p.district, propPrice(p), (p.images?.length || 0) + " صور"].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            )) : <p className="m-0 py-6 text-center text-[var(--crm-ink-3)]">لا توجد عقارات بهذا البحث.</p>}
          </div>
        ) : (
          <div className="grid content-start gap-3 overflow-y-auto p-3">
            {(pick.images || []).length > 0 ? (
              <div className="grid gap-1.5">
                <span className="text-[13px] text-[var(--crm-ink-2)]">الصور ({imgs.length} مختارة — اضغط للاختيار أو الإلغاء)</span>
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                  {(pick.images || []).map((u) => {
                    const on = imgs.includes(u);
                    return (
                      <button key={u} type="button" onClick={() => setImgs(on ? imgs.filter((x) => x !== u) : [...imgs, u].slice(0, 10))}
                        className={"relative overflow-hidden rounded-md border-2 " + (on ? "border-[#00a884]" : "border-transparent opacity-60")}>
                        <img src={u} alt="" className="aspect-square w-full object-cover" />
                        {on && <span className="absolute end-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-[#00a884] text-[11px] text-white">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : <span className="text-[13px] text-[var(--crm-ink-3)]">لا توجد صور لهذا العقار — تُرسل التفاصيل فقط.</span>}
            {gotMsg && <span className="rounded-lg bg-[var(--crm-warn-soft)] p-2 text-[13px] text-[var(--crm-warn)]">التفاصيل والصور أُرسلت لهذا العميل سابقاً ولن تُعاد — يمكنك إرسال الرابط أو الملف فقط.</span>}
            <div className="crm-field">
              <label>نص الرسالة (يمكنك تعديله)</label>
              <textarea rows={8} value={msg} onChange={(e) => setMsg(e.target.value)} />
            </div>
            {(pick.pdfUrl || pick.driveLink) && (
              <div className="flex flex-wrap gap-4 text-[13.5px]">
                {pick.pdfUrl && <label className="flex items-center gap-1.5"><input type="checkbox" disabled={gotPdf} checked={withPdf && !gotPdf} onChange={(e) => setWithPdf(e.target.checked)} /> 📄 إرفاق ملف المشروع (PDF){gotPdf && " — أُرسل سابقاً"}</label>}
                {pick.driveLink && <label className="flex items-center gap-1.5"><input type="checkbox" disabled={gotDrive} checked={withDrive && !gotDrive} onChange={(e) => setWithDrive(e.target.checked)} /> 🔗 إرسال رابط الصور (درايف){gotDrive && " — أُرسل سابقاً"}</label>}
              </div>
            )}
            {pick.videoLink && <span className="text-[12.5px] text-[var(--crm-ink-3)]">رابط الفيديو موجود داخل النص.</span>}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-[var(--crm-line)] px-4 py-3">
          {busy && <span className="me-auto text-[13px] text-[var(--crm-ink-3)]">{busy}</span>}
          {pick && <button type="button" className="crm-btn primary" disabled={!!busy || (!sendMsg && !sendDrive && !sendPdf)} onClick={go}>إرسال للعميل</button>}
        </div>
      </div>
    </div>
  );
}
