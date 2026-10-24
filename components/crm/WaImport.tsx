"use client";

/**
 * Bulk "import clients from WhatsApp" for managers: every chat whose number is
 * not yet a CRM client (nor a staff member), filtered and hand-picked, becomes a
 * client with source واتساب, the last message as a note, and an assignee
 * (none / round-robin / one employee). Chats without a visible phone number
 * (WhatsApp's hidden ids) are counted but cannot be imported.
 */
import { useEffect, useMemo, useState } from "react";
import { doc, collection, setDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { claimPhone } from "@/lib/crm/actions";
import { useCrm } from "@/lib/crm/store";
import { assertWritable } from "@/lib/crm/preview";
import { members, nameOf } from "@/lib/crm/logic";
import { normPhone, nowStamp, today } from "@/lib/crm/util";
import { localPhone, waApi, waTime, type WaChat, type WaSource } from "@/lib/crm/wa";

export function WaImport({ sources, onClose }: { sources: WaSource[]; onClose: () => void }) {
  const { data, toast } = useCrm();
  const [chats, setChats] = useState<WaChat[] | null>(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [assign, setAssign] = useState<"none" | "rr" | string>("rr");
  const [call, setCall] = useState<"none" | "today">("none");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    waApi<{ chats: WaChat[] }>("/api/chats").then((r) => setChats(r.chats)).catch(() => setChats([]));
  }, []);

  const { list, hidden, already } = useMemo(() => {
    const taken = new Set(data.clients.map((c) => normPhone(c.phone)).filter(Boolean));
    const staff = new Set(data.staff.map((s) => normPhone(s.phone)).filter(Boolean));
    const best = new Map<string, WaChat>();
    let hidden = 0, already = 0;
    for (const c of chats || []) {
      if (!c.phone) { hidden++; continue; }
      if (staff.has(c.phone)) continue;
      if (taken.has(c.phone)) { already++; continue; }
      const prev = best.get(c.phone);
      if (!prev || c.ts > prev.ts) best.set(c.phone, c);
    }
    return { list: [...best.values()].sort((a, b) => b.ts - a.ts), hidden, already };
  }, [chats, data.clients, data.staff]);

  const qq = q.trim();
  const shown = list.filter((c) => !qq || [c.name, c.phone, localPhone(c.phone), c.last].some((x) => x && x.includes(qq)));
  const srcLabel = (id: string) => sources.find((s) => s.id === id)?.label || "";
  const rrOrder = (data.rr.order.length ? data.rr.order : members(data)).filter((id) => data.staff.some((s) => s.id === id && s.active));
  const toggle = (p: string) => setPicked((s) => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; });

  async function run() {
    assertWritable();
    const rows = list.filter((c) => picked.has(c.phone!));
    if (!rows.length) return toast("اختر محادثة واحدة على الأقل");
    if (assign === "rr" && !rrOrder.length) return toast("لا يوجد موظفون للتوزيع بالدور");
    setBusy(true);
    try {
      let i = data.rr.last ? rrOrder.indexOf(data.rr.last) : -1;
      let last: string | null = null;
      const source = data.sources.includes("واتساب") ? "واتساب" : null;
      for (let k = 0; k < rows.length; k += 400) {
        const batch = writeBatch(db);
        for (const c of rows.slice(k, k + 400)) {
          let who: string | null = null;
          if (assign === "rr") { i = (i + 1) % rrOrder.length; who = last = rrOrder[i]; }
          else if (assign !== "none") who = assign;
          const d = new Date(c.ts);
          const ref = doc(collection(db, "clients"));
          claimPhone(batch, localPhone(c.phone), ref.id);
          batch.set(ref, {
            name: c.name || localPhone(c.phone), phone: localPhone(c.phone), source,
            assignee: who, assignedAt: who ? nowStamp() : null, assignedBy: who ? data.uid : null, unseen: !!who && who !== data.uid,
            temp: null, status: "نشط", nextCall: call === "today" ? today() : null, visitAt: null, visitProperty: null, visitConfirmed: false,
            notes: c.last ? "آخر رسالة على واتساب (" + d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear() + "): " + c.last.slice(0, 500) : null,
            log: [], createdAt: nowStamp(), updatedAt: nowStamp(),
          });
        }
        await batch.commit();
      }
      if (assign === "rr" && last && data.rr.on) await setDoc(doc(db, "crm", "lists"), { rr: { ...data.rr, last } }, { merge: true }).catch(() => {});
      toast("تم استيراد " + rows.length + " عميل من واتساب");
      setPicked(new Set());
    } catch {
      toast("تعذّر الاستيراد، يرجى المحاولة مجدداً");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="crm-card mb-3 grid gap-3 p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="flex-1 text-[15.5px]">استيراد العملاء من واتساب</h2>
        <button type="button" className="crm-btn ghost sm" onClick={onClose}>إغلاق</button>
      </div>
      {!chats ? <p className="crm-hint m-0">جارٍ تحميل المحادثات…</p> : (
        <>
          <p className="crm-hint m-0">
            <b className="num">{list.length}</b> محادثة لأرقام غير مسجّلة في النظام
            {already > 0 && <> · <span className="num">{already}</span> مسجّلون مسبقاً (لن يتكرروا)</>}
            {hidden > 0 && <> · <span className="num">{hidden}</span> بلا رقم ظاهر (رقم مخفي من واتساب)</>}.
            استبعد الأرقام الشخصية والعائلية قبل الاستيراد.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input className="crm-input min-w-[200px] flex-1" placeholder="ابحث بالاسم أو الرقم أو نص آخر رسالة (مثال: فيلا)" value={q} onChange={(e) => setQ(e.target.value)} />
            <button type="button" className="crm-btn sm" onClick={() => setPicked((s) => new Set([...s, ...shown.map((c) => c.phone!)]))}>تحديد المعروض ({shown.length})</button>
            <button type="button" className="crm-btn ghost sm" onClick={() => setPicked(new Set())}>إلغاء التحديد</button>
          </div>
          <div className="max-h-[420px] overflow-y-auto rounded-xl border border-[var(--crm-line)]">
            <table className="crm-table min-w-[640px]">
              <thead><tr><th className="w-8" /><th>الاسم</th><th>الجوال</th><th>آخر رسالة</th><th>التاريخ</th>{sources.length > 1 && <th>الرقم</th>}</tr></thead>
              <tbody>
                {shown.map((c) => (
                  <tr key={c.phone} className="cursor-pointer" onClick={() => toggle(c.phone!)}>
                    <td><input type="checkbox" className="h-4 w-4 accent-[var(--crm-gold)]" checked={picked.has(c.phone!)} onChange={() => toggle(c.phone!)} onClick={(e) => e.stopPropagation()} aria-label="تحديد" /></td>
                    <td className="font-semibold">{c.name || "—"}</td>
                    <td className="num">{localPhone(c.phone)}</td>
                    <td className="max-w-[320px] truncate text-[13px] text-[var(--crm-ink-2)]">{c.lastFromMe ? "أنت: " : ""}{c.last}</td>
                    <td className="num text-[12.5px]">{waTime(c.ts)}</td>
                    {sources.length > 1 && <td className="text-[12.5px]">{srcLabel(c.source)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {!shown.length && <p className="crm-hint m-3">لا توجد محادثات بهذا البحث.</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="crm-field">
              <label>الإسناد</label>
              <select value={assign} onChange={(e) => setAssign(e.target.value)}>
                <option value="rr">بالدور على الموظفين ({rrOrder.length})</option>
                <option value="none">بدون إسناد (أوزّعهم لاحقاً)</option>
                {members(data).map((id) => <option key={id} value={id}>إلى {nameOf(data, id)}</option>)}
              </select>
            </div>
            <div className="crm-field">
              <label>موعد الاتصال</label>
              <select value={call} onChange={(e) => setCall(e.target.value as "none" | "today")}>
                <option value="none">بدون موعد (يظهرون في «بدون موعد اتصال»)</option>
                <option value="today">اليوم (يظهرون في مكالمات اليوم)</option>
              </select>
            </div>
            <div className="flex items-end">
              <button type="button" className="crm-btn primary w-full" disabled={busy || !picked.size} onClick={run}>
                {busy ? "جارٍ الاستيراد…" : "استيراد " + picked.size + " عميل"}
              </button>
            </div>
          </div>
          <p className="crm-hint m-0">يُضاف كل عميل بمصدر «واتساب» وآخر رسالة منه في الملاحظات. الطلبات (نوع العقار والميزانية) يسجّلها الموظف بعد التواصل.</p>
        </>
      )}
    </div>
  );
}
