"use client";

/**
 * One-off (owner, Settings → أدوات): النرجس is now two districts, «النرجس - شمال سلمان» and
 * «النرجس - جنوب سلمان». Everything saved with plain «النرجس» (clients, requests,
 * properties, website offers) becomes «النرجس - شمال سلمان»; the owner then moves the
 * south ones by hand. Safe to run twice.
 */
import { useState } from "react";
import { collection, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCrm } from "@/lib/crm/store";
import { assertWritable } from "@/lib/crm/preview";

const OLD = "النرجس";
const NEW = "النرجس - شمال سلمان";
const isOld = (s: string) => s.replace(/^حي\s+/, "").trim() === OLD;
const fix = (v: unknown): string | null => {
  if (typeof v !== "string" || !v) return null;
  const parts = v.split(/[،,]/).map((x) => x.trim()).filter(Boolean);
  if (!parts.some(isOld)) return null;
  return Array.from(new Set(parts.map((x) => (isOld(x) ? NEW : x)))).join("، ");
};

const PLAN: { col: string; field: string; extra?: Record<string, unknown> }[] = [
  { col: "clients", field: "districts" },
  { col: "requests", field: "districts" },
  { col: "properties", field: "district" },
  { col: "offers", field: "district_ar", extra: { district_en: "" } },
];

export function RenameNarjis() {
  const { toast } = useCrm();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function run() {
    if (!confirm("تحويل كل ما هو محفوظ بحي «النرجس» إلى «" + NEW + "»؟")) return;
    setBusy(true);
    try {
      assertWritable();
      let n = 0;
      const lines: string[] = [];
      for (const p of PLAN) {
        const snap = await getDocs(collection(db, p.col));
        const todo = snap.docs.flatMap((d) => { const v = fix(d.data()[p.field]); return v ? [{ ref: d.ref, v }] : []; });
        for (let i = 0; i < todo.length; i += 400) {
          const b = writeBatch(db);
          todo.slice(i, i + 400).forEach((x) => b.update(x.ref, { [p.field]: x.v, ...(p.extra || {}) }));
          await b.commit();
        }
        if (todo.length) lines.push(todo.length + " في " + p.col);
        n += todo.length;
      }
      setMsg(n ? "تم: " + lines.join("، ") : "ما فيه شيء يحتاج تحويل");
      toast(n ? "تم تحويل النرجس إلى شمال سلمان" : "ما فيه شيء يحتاج تحويل");
    } catch {
      toast("تعذّر التحويل — حاول مرة ثانية");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="crm-card flex flex-wrap items-center gap-2 p-4">
      <span className="flex-1 text-sm">النرجس صار نوعين (شمال سلمان / جنوب سلمان). المحفوظ بالنرجس قبل يتحوّل لـ«شمال سلمان».{msg && <b className="ms-2">{msg}</b>}</span>
      <button type="button" className="crm-btn" disabled={busy} onClick={run}>{busy ? "جارٍ التحويل…" : "تحويل المحفوظ"}</button>
    </div>
  );
}
