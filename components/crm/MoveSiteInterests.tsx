"use client";

/**
 * One-time move (client 2026-11-14: «حنا سجلنا الاهتمامات في الطلبات… انقلها للقسم الجديد»): website «سجّل اهتمامك»
 * enquiries that the dispatcher had turned into requests become interests in «اهتمامات الإعلان» (origin «الموقع»).
 * Only requests nobody has worked on are moved: still «جديد», no offers, no visits. Ones already in progress stay
 * in الطلبات and are counted. Managers only; asks before moving.
 */
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCrm } from "@/lib/crm/store";
import { remove, write } from "@/lib/crm/actions";
import { nowStamp, today } from "@/lib/crm/util";
import type { Interest } from "@/lib/crm/types";

type L = { id: string; source?: string; message?: string | null; related_offer_id?: string | null; dispatched?: { requestId?: string; moved?: boolean } | null; snap?: { campaign_name?: string }; tiktok?: { campaign_name?: string } };
const ORIGIN: Record<string, string> = { website_interest: "الموقع", snapchat: "سناب", tiktok: "تيك توك" };

export function MoveSiteInterests() {
  const { data, toast } = useCrm();
  const [leads, setLeads] = useState<L[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data.isMgr) return;
    getDocs(query(collection(db, "leads"), where("source", "in", ["website_interest", "snapchat", "tiktok"])))
      .then((s) => setLeads(s.docs.map((x) => ({ id: x.id, ...(x.data() as Omit<L, "id">) }))))
      .catch(() => setLeads([]));
  }, [data.isMgr]);

  const { ready, busyOnes } = useMemo(() => {
    const ready: { l: L; reqId: string; clientId: string }[] = [];
    let busyOnes = 0;
    for (const l of leads || []) {
      const reqId = l.dispatched?.requestId;
      if (!reqId || l.dispatched?.moved || String(l.message || "").startsWith("طلب عقاري من الموقع")) continue;
      const r = data.requests.find((x) => x.id === reqId);
      if (!r) continue;
      const untouched = (r.status || "جديد") === "جديد" && !data.proposals.some((p) => p.requestId === r.id) && !data.viewings.some((v) => v.requestId === r.id);
      if (untouched) ready.push({ l, reqId, clientId: r.clientId }); else busyOnes++;
    }
    return { ready, busyOnes };
  }, [leads, data.requests, data.proposals, data.viewings]);

  if (!data.isMgr || !leads || (!ready.length && !busyOnes)) return null;

  async function move() {
    if (!window.confirm("نقل " + ready.length + " اهتمام من الطلبات إلى «اهتمامات الإعلان»؟\nتنحذف طلباتهم (ما اشتغل عليها أحد) وتصير اهتمامات بموعد اتصال اليوم.")) return;
    setBusy(true);
    let moved = 0;
    try {
      // Several enquiries from one client: one write with all of them.
      const byClient = new Map<string, typeof ready>();
      for (const x of ready) byClient.set(x.clientId, [...(byClient.get(x.clientId) || []), x]);
      for (const [cid, xs] of byClient) {
        const c = data.clients.find((y) => y.id === cid);
        if (!c) continue;
        const add: Interest[] = [];
        for (const { l } of xs) {
          const ad = l.source === "snapchat" || l.source === "tiktok";
          const parts = String(l.message || "").split(" | ").filter((p) => !/^عميل من إعلان/.test(p));
          const camp = l.snap?.campaign_name || l.tiktok?.campaign_name || "";
          const title = (parts.find((p) => p.startsWith("تسجيل اهتمام:")) || "").replace("تسجيل اهتمام:", "").trim();
          let pid: string | null = null;
          if (l.related_offer_id) { try { const o = await getDoc(doc(db, "offers", l.related_offer_id)); pid = (o.exists() && (o.data().property_id as string)) || null; } catch { /* title only */ } }
          add.push({
            id: Math.random().toString(36).slice(2, 10), propertyId: pid,
            propertyTitle: ad ? "إعلان " + ORIGIN[l.source!] + (camp ? ": " + camp : "") : title || data.props.find((p) => p.id === pid)?.title || "عقار من الموقع",
            unit: null, note: parts.filter((p) => !p.startsWith("تسجيل اهتمام:") && !/^https?:\/\//.test(p)).join(" — ") || null,
            followUp: today(), status: "متابعة", by: null, at: nowStamp(), origin: ORIGIN[l.source || "website_interest"] || "الموقع",
          });
        }
        await write("clients", c.id, { interests: [...add, ...(c.interests || [])], updatedAt: nowStamp() }, "update");
        for (const { l, reqId } of xs) {
          await remove("requests", reqId);
          await write("leads", l.id, { dispatched: { ...(l.dispatched || {}), moved: true, movedAt: nowStamp() } }, "update");
          moved++;
        }
      }
      toast("انتقل " + moved + " اهتمام إلى «اهتمامات الإعلان»");
      setLeads((ls) => (ls || []).map((l) => (ready.some((x) => x.l.id === l.id) ? { ...l, dispatched: { ...(l.dispatched || {}), moved: true } } : l)));
    } catch {
      toast("انتقل " + moved + " وتعذّر الباقي — جرّب مرة ثانية");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="crm-card mb-3 flex flex-wrap items-center gap-2 p-3 text-[13.5px]">
      <span className="flex-1">
        {ready.length ? <>فيه <b className="num">{ready.length}</b> اهتمام (من سناب أو تيك توك أو الموقع) مسجّل كطلب في «الطلبات».</> : null}
        {busyOnes ? <span className="muted"> {busyOnes} منها اشتغل عليها موظف، تبقى في الطلبات.</span> : null}
      </span>
      {ready.length > 0 && <button type="button" className="crm-btn primary sm" disabled={busy} onClick={move}>{busy ? "جارٍ النقل…" : "انقلها هنا"}</button>}
    </div>
  );
}
