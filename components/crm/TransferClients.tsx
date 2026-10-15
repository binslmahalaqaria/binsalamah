"use client";

/**
 * "تحويل عملاء" (managers): move clients from one employee to another in one go —
 * e.g. someone leaves or is overloaded. Choose which clients (active, the
 * re-contact list, the archive, or all), optionally only part of them, and
 * whether their open requests and open tasks move too. The receiver sees them
 * marked new, and each client's log records the transfer.
 */
import { useState } from "react";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCrm } from "@/lib/crm/store";
import { OPEN_STAGES, TO_CONTACT } from "@/lib/crm/constants";
import { members, nameOf } from "@/lib/crm/logic";
import { assertWritable } from "@/lib/crm/preview";
import { nowStamp } from "@/lib/crm/util";

type Scope = "active" | "contact" | "archive" | "all";
const SCOPE_AR: Record<Scope, string> = { active: "العملاء النشطون", contact: "قائمة التواصل", archive: "الأرشيف (غير مهتم/مغلق)", all: "كل عملائه" };

export function TransferClients({ onClose }: { onClose: () => void }) {
  const { data, toast } = useCrm();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [scope, setScope] = useState<Scope>("active");
  const [split, setSplit] = useState<"all" | "half" | "count">("all");
  const [count, setCount] = useState("10");
  const [withReqs, setWithReqs] = useState(true);
  const [withTasks, setWithTasks] = useState(true);
  const [busy, setBusy] = useState(false);

  const inScope = (st: string | null | undefined) => {
    const s = st || "نشط";
    return scope === "all" || (scope === "active" && s === "نشط") || (scope === "contact" && s === TO_CONTACT) || (scope === "archive" && (s === "غير مهتم" || s === "مغلق"));
  };
  const pool = from ? data.clients.filter((c) => (from === "none" ? !c.assignee : c.assignee === from) && inScope(c.status)) : [];
  const n = split === "all" ? pool.length : split === "half" ? Math.ceil(pool.length / 2) : Math.min(pool.length, Math.max(0, parseInt(count) || 0));
  // Oldest assignments first, so the receiver gets the ones waiting longest.
  const moving = [...pool].sort((a, b) => String(a.assignedAt || a.createdAt).localeCompare(String(b.assignedAt || b.createdAt))).slice(0, n);
  const ids = new Set(moving.map((c) => c.id));
  const reqs = withReqs ? data.requests.filter((r) => r.clientId && ids.has(r.clientId) && (OPEN_STAGES as readonly string[]).includes(r.status || "جديد") && r.assignee !== to) : [];
  const tasks = withTasks ? data.tasks.filter((t) => !t.done && t.clientId && ids.has(t.clientId) && t.assignee !== to) : [];

  async function run() {
    assertWritable();
    if (!from || !to || from === to) return toast("اختر موظفاً للتحويل منه وموظفاً آخر للتحويل إليه");
    if (!moving.length) return toast("لا يوجد عملاء بهذه الاختيارات");
    setBusy(true);
    try {
      const at = nowStamp();
      const ops: [string, string, Record<string, unknown>][] = [
        ...moving.map((c) => ["clients", c.id, {
          assignee: to, assignedAt: at, assignedBy: data.uid, unseen: to !== data.uid, escalatedFrom: null, updatedAt: at,
          log: [{ at, byId: data.uid, type: "تحويل", text: "حُوّل من " + nameOf(data, c.assignee) + " إلى " + nameOf(data, to) }, ...(c.log || [])].slice(0, 80),
        }] as [string, string, Record<string, unknown>]),
        ...reqs.map((r) => ["requests", r.id, { assignee: to, updatedAt: at }] as [string, string, Record<string, unknown>]),
        ...tasks.map((t) => ["tasks", t.id, { assignee: to, seen: to === data.uid, updatedAt: at }] as [string, string, Record<string, unknown>]),
      ];
      for (let k = 0; k < ops.length; k += 400) {
        const b = writeBatch(db);
        ops.slice(k, k + 400).forEach(([col, id, patch]) => b.update(doc(db, col, id), patch));
        await b.commit();
      }
      toast("حُوّل " + moving.length + " عميل إلى " + nameOf(data, to) + (reqs.length ? " مع " + reqs.length + " طلب" : "") + (tasks.length ? " و" + tasks.length + " مهمة" : ""));
      onClose();
    } catch {
      toast("تعذّر التحويل، يرجى المحاولة مجدداً");
    } finally {
      setBusy(false);
    }
  }

  const people = members(data);
  return (
    <div className="crm-card mb-3 grid gap-3 p-4">
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-[15.5px]">تحويل عملاء بين الموظفين</h2>
        <button type="button" className="crm-btn ghost sm" onClick={onClose}>إغلاق</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="crm-field">
          <label>من</label>
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">— اختر —</option>
            {people.map((id) => <option key={id} value={id}>{nameOf(data, id)} ({data.clients.filter((c) => c.assignee === id).length})</option>)}
            <option value="none">غير مسندين ({data.clients.filter((c) => !c.assignee).length})</option>
          </select>
        </div>
        <div className="crm-field">
          <label>إلى</label>
          <select value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">— اختر —</option>
            {people.filter((id) => id !== from).map((id) => <option key={id} value={id}>{nameOf(data, id)}</option>)}
          </select>
        </div>
        <div className="crm-field">
          <label>أي العملاء</label>
          <select value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
            {(Object.keys(SCOPE_AR) as Scope[]).map((k) => <option key={k} value={k}>{SCOPE_AR[k]}</option>)}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
        <span className="muted">الكمية:</span>
        <button type="button" className={"crm-qchip" + (split === "all" ? " on" : "")} onClick={() => setSplit("all")}>الكل ({pool.length})</button>
        <button type="button" className={"crm-qchip" + (split === "half" ? " on" : "")} onClick={() => setSplit("half")}>النصف ({Math.ceil(pool.length / 2)})</button>
        <button type="button" className={"crm-qchip" + (split === "count" ? " on" : "")} onClick={() => setSplit("count")}>عدد محدد</button>
        {split === "count" && <input className="!w-20" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} />}
      </div>
      <div className="flex flex-wrap gap-4 text-[13.5px]">
        <label className="flex items-center gap-1.5"><input type="checkbox" className="h-4 w-4 accent-[var(--crm-gold)]" checked={withReqs} onChange={(e) => setWithReqs(e.target.checked)} /> مع طلباتهم المفتوحة</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" className="h-4 w-4 accent-[var(--crm-gold)]" checked={withTasks} onChange={(e) => setWithTasks(e.target.checked)} /> مع مهامهم غير المنجزة</label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="crm-btn primary" disabled={busy || !from || !to || !moving.length} onClick={run}>
          {busy ? "جارٍ التحويل…" : "تحويل " + moving.length + " عميل" + (to ? " إلى " + nameOf(data, to) : "")}
        </button>
        {from && to && moving.length > 0 && <span className="crm-hint">{reqs.length ? reqs.length + " طلب" : "بدون طلبات"} · {tasks.length ? tasks.length + " مهمة" : "بدون مهام"} — يُسجَّل التحويل في سجل كل عميل، ويظهر للمستلم كعميل جديد.</span>}
      </div>
    </div>
  );
}
