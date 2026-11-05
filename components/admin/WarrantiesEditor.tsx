"use client";

/**
 * Warranties as editable rows (item + years). The text pasted into the box is split into rows automatically
 * (see lib/warranties.ts); every row can then be corrected or deleted. The rows are stored back as the offer's
 * `warranties_text` (one «item: N سنوات» line per row) so the site, the translation and older offers keep working.
 */
import { useState } from "react";
import { parseWarranties } from "@/lib/warranties";

interface Row { item: string; years: string }
const box = "rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm text-navy focus:border-navy focus:outline-none";

const toRows = (text: string): Row[] => parseWarranties(text.split("\n").map((l) => l.trim()).filter(Boolean)).map((w) => ({ item: w.label, years: w.years ?? "" }));
const toText = (rows: Row[]) =>
  rows.filter((r) => r.item.trim()).map((r) => r.item.trim() + (r.years.trim() ? ": " + r.years.trim() + " سنوات" : "")).join("\n");

export function WarrantiesEditor({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const [rows, setRows] = useState<Row[]>(() => toRows(value));
  const [paste, setPaste] = useState("");

  const commit = (next: Row[]) => { setRows(next); onChange(toText(next)); };
  const edit = (i: number, patch: Partial<Row>) => commit(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const fill = () => {
    const got = toRows(paste);
    if (!got.length) return;
    commit([...rows, ...got]);
    setPaste("");
  };

  return (
    <div className="grid gap-3">
      <span className="text-sm font-medium text-navy/70">الضمانات</span>

      <div className="grid gap-2 rounded-xl border border-dashed border-navy/20 p-3">
        <textarea rows={3} className={box} value={paste} onChange={(e) => setPaste(e.target.value)}
          placeholder={"الصق النص هنا ويتوزع تلقائياً. مثال:\nأفياش 20 سنة ومواسير 30 سنة\nالخزانات: 5 سنوات"} />
        <button type="button" onClick={fill} disabled={!paste.trim()} className="justify-self-start rounded-lg bg-navy px-4 py-2 text-sm font-medium text-cream disabled:opacity-40">
          تعبئة الضمانات من النص
        </button>
      </div>

      {rows.length > 0 && (
        <ul className="grid gap-2">
          {rows.map((r, i) => (
            <li key={i} className="grid grid-cols-[1fr_96px_auto] items-center gap-2">
              <input className={box} placeholder="الضمان (مثال: المواسير)" value={r.item} onChange={(e) => edit(i, { item: e.target.value })} />
              <input className={box} inputMode="numeric" placeholder="السنوات" value={r.years} onChange={(e) => edit(i, { years: e.target.value.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[^0-9]/g, "") })} />
              <button type="button" aria-label="حذف الضمان" onClick={() => commit(rows.filter((_, j) => j !== i))}
                className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">حذف</button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => commit([...rows, { item: "", years: "" }])} className="justify-self-start text-sm font-medium text-navy underline">+ إضافة ضمان</button>
    </div>
  );
}
