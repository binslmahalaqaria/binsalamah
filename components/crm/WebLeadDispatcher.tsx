"use client";

/**
 * Website requests go to the sales team automatically, in turn: the first to
 * employee 1, the next to employee 2, and so on (the same order as Settings →
 * التوزيع التلقائي, or every active sales employee when no order is set).
 *
 * The public site cannot write CRM data, so this runs inside the CRM: any open
 * staff session picks up new website enquiries ("leads", source
 * website_interest) and, in one Firestore transaction per lead, creates or
 * reuses the client, opens a request for the next employee, advances the
 * rotation pointer (counters/webLeads) and marks the lead as dispatched — so
 * two open sessions never hand the same lead out twice. Leads submitted while
 * nobody has the CRM open are dispatched as soon as someone opens it.
 */
import { useEffect, useRef } from "react";
import { collection, doc, onSnapshot, query, runTransaction, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { claimPhone } from "@/lib/crm/actions";
import { useCrm } from "@/lib/crm/store";
import { isPreview } from "@/lib/crm/preview";
import { intl, nowStamp, today } from "@/lib/crm/util";
import { PTYPES } from "@/lib/crm/constants";

interface Lead { id: string; customer_name?: string; phone?: string; message?: string | null; source?: string; assigned_to?: string | null; dispatched?: unknown }

/** "طلب عقاري من الموقع | النوع: فيلا | الغرض: شراء للسكن | …" → request fields. */
function parse(message: string | null | undefined) {
  const parts = String(message || "").split(" | ");
  const get = (k: string) => parts.find((p) => p.startsWith(k + ":"))?.slice(k.length + 1).trim() || "";
  const type = get("النوع");
  const purpose = get("الغرض");
  const districts = (get("الأحياء") || get("الحي")).replace("غير محدد", "").trim();
  const city = get("المدينة");
  const budgetTxt = get("الميزانية").replace(/[٠-٩]/g, (x) => String("٠١٢٣٤٥٦٧٨٩".indexOf(x)));
  const n = Number(budgetTxt.replace(/[^\d.]/g, ""));
  const budget = !n ? null : /مليون/.test(budgetTxt) && n < 1000 ? n * 1e6 : n;
  return {
    isRequest: parts[0] === "طلب عقاري من الموقع",
    purpose: /إيجار/.test(purpose) ? "إيجار" : "شراء",
    propTypes: type && (PTYPES as readonly string[]).includes(type) ? [type] : type ? [type] : [],
    districts: districts || null,
    budget,
    requirements: [city && "المدينة: " + city, purpose && "الغرض: " + purpose, budgetTxt && !budget ? "الميزانية: " + budgetTxt : ""].filter(Boolean).join(" — ") || null,
  };
}

export function WebLeadDispatcher() {
  const { data, me } = useCrm();
  const busy = useRef(false);
  const latest = useRef(data);
  useEffect(() => { latest.current = data; }, [data]);

  useEffect(() => {
    if (!data.uid || !me?.active || isPreview()) return;
    const q = query(collection(db, "leads"), where("source", "==", "website_interest"));
    return onSnapshot(q, async (s) => {
      const todo = s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Lead, "id">) })).filter((l) => !l.dispatched && !l.assigned_to); // already handled by hand → leave it
      if (!todo.length || busy.current) return;
      busy.current = true;
      try {
        for (const l of todo) await dispatch(l).catch((e) => console.warn("web lead", l.id, e));
      } finally {
        busy.current = false;
      }
    }, () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.uid, me?.active]);

  async function dispatch(l: Lead) {
    const d = latest.current;
    const active = d.staff.filter((s) => s.active);
    // Rotation: the order set in Settings (التوزيع التلقائي), else every active sales employee.
    const order = (d.rr.order || []).filter((id) => active.some((s) => s.id === id));
    const team = order.length ? order : active.filter((s) => s.role === "sales").sort((a, b) => (a.created_at || 0) - (b.created_at || 0)).map((s) => s.id);
    const phone = intl(l.phone);
    const existing = phone ? d.clients.find((c) => intl(c.phone) === phone) : undefined;
    const keep = existing?.assignee && active.some((s) => s.id === existing.assignee) ? existing.assignee : null;
    const p = parse(l.message);

    await runTransaction(db, async (tx) => {
      const leadRef = doc(db, "leads", l.id);
      const ptr = doc(db, "counters", "webLeads");
      const [ls, ps] = await Promise.all([tx.get(leadRef), tx.get(ptr)]);
      if (!ls.exists() || ls.data().dispatched) return; // another session took it
      let to = keep;
      if (!to && team.length) {
        const last = ps.exists() ? (ps.data().last as string | null) : null;
        to = team[(last ? team.indexOf(last) + 1 : 0) % team.length];
        tx.set(ptr, { last: to, at: nowStamp() }, { merge: true });
      }
      const now = nowStamp();
      const note = p.isRequest ? "طلب من نموذج «سجّل طلبك العقاري» في الموقع" : "تسجيل اهتمام من الموقع" + (l.message ? ": " + l.message : "");
      const demand = { purpose: p.purpose, propTypes: p.propTypes, districts: p.districts, budget: p.budget };
      let clientId = existing?.id;
      if (!clientId) {
        const cref = doc(collection(db, "clients"));
        clientId = cref.id;
        claimPhone(tx, l.phone, cref.id);
        tx.set(cref, {
          name: (l.customer_name || "").trim() || phone || "عميل الموقع", phone: l.phone || null, temp: null, status: "نشط",
          nextCall: today(), source: "الموقع الإلكتروني", assignee: to, assignedAt: now, unseen: !!to,
          log: [{ at: now, byId: null, type: "طلب من الموقع", text: note }],
          createdAt: now, updatedAt: now, ...(p.isRequest ? demand : {}),
        });
      } else {
        // The log is newest-first; an existing client without an (active) owner gets the request's employee too.
        tx.update(doc(db, "clients", clientId), {
          updatedAt: now, nextCall: today(), status: "نشط",
          log: [{ at: now, byId: null, type: "طلب من الموقع", text: note }, ...(existing!.log || [])].slice(0, 80),
          ...(!keep && to ? { assignee: to, assignedAt: now, unseen: true } : {}),
        });
      }
      const rref = doc(collection(db, "requests"));
      tx.set(rref, {
        clientId, status: "جديد", priority: "عادية", source: "الموقع الإلكتروني", assignee: to, awaitingUpdate: true,
        ...(p.isRequest ? demand : { purpose: "شراء", propTypes: [], districts: null, budget: null }),
        requirements: p.isRequest ? p.requirements : l.message || null,
        notes: "أُسند تلقائياً من طلبات الموقع", createdAt: now, updatedAt: now,
      });
      tx.update(leadRef, { dispatched: { at: now, clientId, requestId: rref.id, to }, assigned_to: to });
    });
  }

  return null;
}
