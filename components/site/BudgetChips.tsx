"use client";

/** Budget as tap-sized buttons (أقل من مليون، مليون، مليونين، 3، 4، 5+); tap the chosen one again to clear. */
import { useLocale } from "next-intl";
import { PRICE_RANGES } from "@/lib/districts";

export function BudgetChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ar = useLocale() === "ar";
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {PRICE_RANGES.map((p) => (
        <button key={p.id} type="button" aria-pressed={value === p.id} onClick={() => onChange(value === p.id ? "" : p.id)}
          className={"min-h-11 rounded-xl border px-2 py-2 text-center text-sm font-medium transition-colors " +
            (value === p.id ? "border-navy bg-navy text-cream" : "border-navy/15 bg-white text-navy hover:border-navy/40")}>
          {ar ? p.ar : p.en}
        </button>
      ))}
    </div>
  );
}
