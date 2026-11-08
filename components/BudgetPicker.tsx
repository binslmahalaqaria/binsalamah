"use client";

/**
 * Budget on the request forms (client 2026-11-07): one tap on a ready amount, or «أخرى» to type one and see how it
 * was read before saving. Shared by the website form and the CRM form, which only differ in their styling.
 */
import { useState } from "react";
import { budgetOk, budgetWords, BUDGET_RENT, BUDGET_SALE, parseBudget } from "@/lib/budget";

export function BudgetPicker({ value, onChange, rent, ar = true, chip, inputClassName, placeholder }: {
  value: string; onChange: (v: string) => void; rent?: boolean; ar?: boolean;
  chip: (on: boolean) => string; inputClassName?: string; placeholder?: string;
}) {
  const list = rent ? BUDGET_RENT : BUDGET_SALE;
  const n = parseBudget(value, rent);
  const [other, setOther] = useState(!!value && !list.includes(n as number));
  const typed = other && value.trim() !== "";
  const ok = budgetOk(value, rent);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {list.map((v) => (
          <button key={v} type="button" className={chip(!other && n === v)} onClick={() => { setOther(false); onChange(String(v)); }}>{budgetWords(v, ar)}</button>
        ))}
        <button type="button" className={chip(other)} onClick={() => { setOther(true); onChange(""); }}>{ar ? "أخرى" : "Other"}</button>
      </div>
      {other && <input className={inputClassName} value={value} placeholder={placeholder} autoFocus onChange={(e) => onChange(e.target.value)} />}
      {typed && (
        <span aria-live="polite" className={"text-sm " + (ok ? "font-medium" : "text-[#b91c1c]")}>
          {ok ? n!.toLocaleString("en-US") + (ar ? " ريال (" : " SAR (") + budgetWords(n!, ar) + ")"
            : n ? (ar ? "المبلغ صغير، تأكد منه" : "That amount looks too small") : (ar ? "ما فهمت المبلغ، جرب: 3 مليون أو 750 ألف" : "Try a figure such as 3 million")}
        </span>
      )}
    </div>
  );
}
