"use client";

/**
 * One-off importer for data exported from the original artifact CRM
 * (JSON: { clients, properties, requests, tasks, goals, chat } arrays of
 * records with their original `id`). Records keep their ids, so running it
 * twice overwrites rather than duplicates. Old CRM user ids (claude.ai
 * accounts) don't exist here, so every person reference is mapped to the
 * owner running the import. Owner-only (Team → Settings).
 */
import { useState } from "react";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCrm } from "@/lib/crm/store";

const COLS = ["clients", "properties", "requests", "tasks", "goals", "chat"] as const;
const PERSON_KEYS = ["assignee", "byId", "by", "createdBy", "assignedBy", "escalatedFrom", "doneBy", "uid"];
type Bundle = Partial<Record<(typeof COLS)[number], Record<string, unknown>[]>>;

export function ImportOld() {
  const { data, toast } = useCrm();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [busy, setBusy] = useState(false);
  const known = new Set(data.staff.map((s) => s.id));

  // Replace unknown person ids (old CRM accounts) with the importing owner, at any depth.
  const mapIds = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(mapIds);
    if (v && typeof v === "object") {
      const o: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) o[k] = PERSON_KEYS.includes(k) && typeof x === "string" && x && !known.has(x) ? data.uid : mapIds(x);
      return o;
    }
    return v;
  };

  async function run() {
    if (!bundle) return;
    setBusy(true);
    try {
      let n = 0;
      let batch = writeBatch(db);
      let inBatch = 0;
      for (const col of COLS) {
        for (const rec of bundle[col] || []) {
          const { id, ...rest } = mapIds(rec) as Record<string, unknown> & { id: string };
          let docId = String(id);
          const body = rest as Record<string, unknown>;
          if (col === "goals") docId = body.month + "_" + body.uid;
          if (col === "requests" && body.status === "تم") body.status = "تم البيع";
          if (col === "properties") {
            // Old uploads lived in the artifact's own storage; they can't be carried over as URLs.
            body.images = [];
            delete body.videos;
          }
          batch.set(doc(db, col, docId), body);
          n++;
          if (++inBatch === 400) {
            await batch.commit();
            batch = writeBatch(db);
            inBatch = 0;
          }
        }
      }
      if (inBatch) await batch.commit();
      toast("تم استيراد " + n + " سجل");
      setBundle(null);
    } catch {
      toast("تعذّر الاستيراد — تأكد إن قواعد Firestore الجديدة منشورة");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="crm-card grid gap-2.5 p-4">
      <h2 className="text-base">استيراد بيانات الـ CRM القديم</h2>
      <p className="crm-hint m-0">اختر ملف التصدير (JSON). السجلات تحتفظ بمعرّفاتها، فإعادة الاستيراد تحدّث نفس السجلات بدون تكرار.</p>
      <input type="file" accept="application/json,.json" onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        try {
          setBundle(JSON.parse(await f.text()));
        } catch {
          toast("الملف مو JSON صحيح");
        }
      }} />
      {bundle && (
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-1.5">
            {COLS.map((c) => <span key={c} className="crm-chip">{c}: <span className="num">{(bundle[c] || []).length}</span></span>)}
          </div>
          <button type="button" className="crm-btn primary justify-self-start" disabled={busy} onClick={run}>{busy ? "جاري الاستيراد…" : "استورد"}</button>
        </div>
      )}
    </div>
  );
}
