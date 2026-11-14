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
import { collection, doc, getDoc, onSnapshot, query, runTransaction, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { claimPhone } from "@/lib/crm/actions";
import { useCrm } from "@/lib/crm/store";
import { isPreview } from "@/lib/crm/preview";
import { intl, nowStamp, today } from "@/lib/crm/util";
import { PTYPES } from "@/lib/crm/constants";
import { parseBudget } from "@/lib/budget";

interface Lead { id: string; customer_name?: string; phone?: string; message?: string | null; source?: string; related_offer_id?: string | null; assigned_to?: string | null; dispatched?: unknown; snap?: { campaign_name?: string }; tiktok?: { campaign_name?: string } }

/** "طلب عقاري من الموقع | النوع: فيلا | الغرض: شراء للسكن | …" → request fields. */
function parse(message: string | null | undefined) {
  const parts = String(message || "").split(" | ");
  const get = (k: string) => parts.find((p) => p.startsWith(k + ":"))?.slice(k.length + 1).trim() || "";
  const type = get("النوع");
  const purpose = get("الغرض");
  const districts = (get("الأحياء") || get("الحي")).replace("غير محدد", "").trim();
  const city = get("المدينة");
  const budgetTxt = get("الميزانية").replace("غير محددة", "").trim();
  const budget = parseBudget(budgetTxt);
  const pay = get("الدفع");
  const payment = ["كاش", "بنك", "بنك + كاش"].includes(pay) ? pay : null;
  // «300 – 400 م²» → both ends; «من 300 م²» → min; «حتى 400 م²» → max; a lone number (older forms) → min.
  const areaTxt = get("المساحة");
  const areaNums = (areaTxt.match(/\d+/g) || []).map(Number);
  const areaMin = /^\s*حتى/.test(areaTxt) ? null : areaNums[0] || null;
  const areaMax = /^\s*حتى/.test(areaTxt) ? areaNums[0] || null : areaNums.length > 1 ? areaNums[1] : null;
  return {
    isRequest: parts[0] === "طلب عقاري من الموقع",
    purpose: /إيجار/.test(purpose) ? "إيجار" : "شراء",
    propTypes: type && (PTYPES as readonly string[]).includes(type) ? [type] : type ? [type] : [],
    districts: districts || null,
    budget,
    areaMin,
    areaMax,
    payment,
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
    // Website forms and Snapchat lead ads (client 2026-11-12, app/api/snap-leads) go out the same way.
    const q = query(collection(db, "leads"), where("source", "in", ["website_interest", "snapchat", "tiktok"]));
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
    const byAge = (x: typeof active) => x.sort((a, b) => (a.created_at || 0) - (b.created_at || 0)).map((s) => s.id);
    const sales = byAge(active.filter((s) => s.role === "sales"));
    // No sales team yet: the request goes to the manager/owner so it never sits unassigned and out of sight.
    const team = order.length ? order : sales.length ? sales : byAge(active.filter((s) => s.role === "admin" || s.role === "manager"));
    const phone = intl(l.phone);
    const existing = phone ? d.clients.find((c) => intl(c.phone) === phone) : undefined;
    const keep = existing?.assignee && active.some((s) => s.id === existing.assignee) ? existing.assignee : null;
    // Ad leads (Snap, TikTok; client 2026-11-12) share the same path: name, phone and answers, no website form fields.
    const ad = l.source === "snapchat" ? "سناب" : l.source === "tiktok" ? "تيك توك" : null;
    const snap = !!ad;
    const p = snap ? { ...parse(""), isRequest: false } : parse(l.message);
    const SRC = ad || "الموقع الإلكتروني";
    const LOGT = ad ? "عميل من " + ad : "طلب من الموقع";
    // «سجّل اهتمامك» on a property page (client 2026-11-14): an interest in «اهتمامات الإعلان» too, not a request;
    // the full «سجّل طلبك العقاري» form still makes a request. The offer points to its inventory property.
    const siteInterest = !ad && !p.isRequest;
    const msg = String(l.message || "");
    const offerTitle = (msg.split(" | ").find((x) => x.startsWith("تسجيل اهتمام:")) || "").replace("تسجيل اهتمام:", "").trim();
    let offerProp: string | null = null;
    if (siteInterest && l.related_offer_id) {
      try { const o = await getDoc(doc(db, "offers", l.related_offer_id)); offerProp = (o.exists() && (o.data().property_id as string)) || null; } catch { /* the title is enough */ }
    }

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
      const note = snap ? (l.message || "عميل من إعلان " + ad) : p.isRequest ? "طلب من نموذج «سجّل طلبك العقاري» في الموقع" : "تسجيل اهتمام من الموقع" + (l.message ? ": " + l.message : "");
      const demand = { purpose: p.purpose, propTypes: p.propTypes, districts: p.districts, budget: p.budget, areaMin: p.areaMin, areaMax: p.areaMax, payment: p.payment };
      // The same customer again (same number, a request still open): no second request (see below).
      const openReq = existing ? d.requests.find((r) => r.clientId === existing.id && !["تم البيع", "ملغي"].includes(r.status || "جديد")) : undefined;
      // Social ad leads (client 2026-11-14): no request — an interest in «اهتمامات الإعلان», to call back today.
      const campaign = l.snap?.campaign_name || l.tiktok?.campaign_name || "";
      const adInterest = ad && !openReq ? {
        id: Math.random().toString(36).slice(2, 10), propertyId: null, propertyTitle: "إعلان " + ad + (campaign ? ": " + campaign : ""), unit: null,
        note: (l.message || "").replace(/^عميل من إعلان (سناب|تيك توك) \| ?/, "") || null, followUp: today(), status: "متابعة", by: null, at: now, origin: ad,
      } : siteInterest && !openReq ? {
        id: Math.random().toString(36).slice(2, 10), propertyId: offerProp, propertyTitle: offerTitle || d.props.find((x) => x.id === offerProp)?.title || "عقار من الموقع", unit: null,
        note: msg.split(" | ").filter((x) => !x.startsWith("تسجيل اهتمام:") && !/^https?:\/\//.test(x)).join(" — ") || null,
        followUp: today(), status: "متابعة", by: null, at: now, origin: "الموقع",
      } : null;
      let clientId = existing?.id;
      if (!clientId) {
        const cref = doc(collection(db, "clients"));
        clientId = cref.id;
        claimPhone(tx, l.phone, cref.id);
        tx.set(cref, {
          name: (l.customer_name || "").trim() || phone || (snap ? "عميل " + ad : "عميل الموقع"), phone: l.phone || null, temp: null, status: "نشط",
          nextCall: null, source: SRC, assignee: to, assignedAt: now, unseen: !!to,
          log: [{ at: now, byId: null, type: LOGT, text: note }],
          createdAt: now, updatedAt: now, ...(p.isRequest ? demand : {}), ...(adInterest ? { interests: [adInterest] } : {}),
        });
      } else {
        // The log is newest-first; an existing client without an (active) owner gets the request's employee too.
        tx.update(doc(db, "clients", clientId), {
          updatedAt: now, status: "نشط",
          log: [{ at: now, byId: null, type: LOGT, text: note + (p.isRequest && l.message ? " — " + l.message.replace("طلب عقاري من الموقع | ", "") : "") }, ...(existing!.log || [])].slice(0, 80),
          ...(!keep && to ? { assignee: to, assignedAt: now, unseen: true } : {}),
          ...(adInterest ? { interests: [adInterest, ...(existing!.interests || [])] } : {}),
        });
      }
      // The same customer sending the form again (a request still open): the open one is flagged
      // «بانتظار تحديث الموظف» again and the new message is kept in the client's log.
      if (openReq) {
        tx.update(doc(db, "requests", openReq.id), { awaitingUpdate: true, updatedAt: now, ...(!openReq.assignee && to ? { assignee: to } : {}) });
        tx.update(leadRef, { dispatched: { at: now, clientId, requestId: openReq.id, to: openReq.assignee || to, repeat: true }, assigned_to: openReq.assignee || to });
        return;
      }
      if (adInterest) {
        tx.update(leadRef, { dispatched: { at: now, clientId, interestId: adInterest.id, to }, assigned_to: to });
        return;
      }
      const rref = doc(collection(db, "requests"));
      tx.set(rref, {
        clientId, status: "جديد", priority: "عادية", source: SRC, assignee: to, awaitingUpdate: true,
        ...(p.isRequest ? demand : { purpose: "شراء", propTypes: [], districts: null, budget: null }),
        requirements: p.isRequest ? p.requirements : (snap ? (l.message || "").replace(/^عميل من إعلان (سناب|تيك توك) \| ?/, "") : l.message) || null,
        notes: snap ? "أُسند تلقائياً من إعلانات " + ad : "أُسند تلقائياً من طلبات الموقع", createdAt: now, updatedAt: now,
      });
      tx.update(leadRef, { dispatched: { at: now, clientId, requestId: rref.id, to }, assigned_to: to });
    });
  }

  return null;
}
