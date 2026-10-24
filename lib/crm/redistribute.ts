import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { listStaff } from "@/lib/staff-client";
import { nowStamp } from "@/lib/crm/util";

const OPEN_STAGES = ["جديد", "جاري البحث", "أرسلنا خيارات", "تفاوض", "عربون"];

/**
 * When an employee is frozen: hands all their clients to the rest of the team in turn (equal shares),
 * and each client's open requests go with the client (closed/sold requests and tasks stay as they are). Each client's log records the move.
 * Targets: active sales employees (managers/owner only when there is no sales employee left).
 */
export async function redistributeFrom(fromId: string, byUid: string | null): Promise<{ clients: number; requests: number; to: string[] } | null> {
  const staff = await listStaff();
  const others = staff.filter((s) => s.active && s.id !== fromId);
  const sales = others.filter((s) => s.role === "sales");
  const team = (sales.length ? sales : others.filter((s) => s.role === "admin" || s.role === "manager")).map((s) => s.id);
  if (!team.length) return null;
  const name = (id: string) => staff.find((s) => s.id === id)?.name || "—";

  const [cs, rs] = await Promise.all([
    getDocs(query(collection(db, "clients"), where("assignee", "==", fromId))),
    getDocs(query(collection(db, "requests"), where("assignee", "==", fromId))),
  ]);
  const at = nowStamp();
  const dest = new Map<string, string>();
  const ops: [string, string, Record<string, unknown>][] = [];
  let i = 0;
  for (const d of cs.docs) {
    const to = team[i++ % team.length];
    dest.set(d.id, to);
    const log = (d.data().log as unknown[]) || [];
    ops.push(["clients", d.id, {
      assignee: to, assignedAt: at, assignedBy: byUid, unseen: true, escalatedFrom: null, updatedAt: at, freezeFrom: fromId,
      log: [{ at, byId: byUid, type: "تحويل", text: "حُوّل من " + name(fromId) + " (حساب موقوف) إلى " + name(to), call: false }, ...log].slice(0, 80),
    }]);
  }
  let nr = 0;
  for (const d of rs.docs) {
    if (!OPEN_STAGES.includes((d.data().status as string) || "جديد")) continue;
    const to = dest.get(d.data().clientId as string) || team[i++ % team.length];
    ops.push(["requests", d.id, { assignee: to, updatedAt: at, freezeFrom: fromId }]); nr++;
  }
  for (let k = 0; k < ops.length; k += 400) {
    const b = writeBatch(db);
    ops.slice(k, k + 400).forEach(([col, id, patch]) => b.update(doc(db, col, id), patch));
    await b.commit();
  }
  return { clients: cs.size, requests: nr, to: team.map(name) };
}

/**
 * Un-freezing: the clients and open requests that were handed out when the account was frozen come back to the
 * employee (only those not moved again by hand since — a manual transfer clears the marker).
 */
export async function restoreTo(id: string, byUid: string | null): Promise<{ clients: number; requests: number }> {
  const [cs, rs] = await Promise.all([
    getDocs(query(collection(db, "clients"), where("freezeFrom", "==", id))),
    getDocs(query(collection(db, "requests"), where("freezeFrom", "==", id))),
  ]);
  const at = nowStamp();
  const ops: [string, string, Record<string, unknown>][] = [];
  let nr = 0;
  for (const d of cs.docs) {
    const log = (d.data().log as unknown[]) || [];
    ops.push(["clients", d.id, {
      assignee: id, assignedAt: at, assignedBy: byUid, unseen: true, escalatedFrom: null, updatedAt: at, freezeFrom: null,
      log: [{ at, byId: byUid, type: "تحويل", text: "أُعيد إلى الموظف بعد إعادة تفعيل حسابه", call: false }, ...log].slice(0, 80),
    }]);
  }
  for (const d of rs.docs) {
    const open = OPEN_STAGES.includes((d.data().status as string) || "جديد");
    ops.push(["requests", d.id, open ? { assignee: id, updatedAt: at, freezeFrom: null } : { freezeFrom: null }]);
    if (open) nr++;
  }
  for (let k = 0; k < ops.length; k += 400) {
    const b = writeBatch(db);
    ops.slice(k, k + 400).forEach(([col, i, patch]) => b.update(doc(db, col, i), patch));
    await b.commit();
  }
  return { clients: cs.size, requests: nr };
}
