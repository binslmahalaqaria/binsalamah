"use client";

/**
 * Client 2026-11-10: the system takes English digits only. Any Arabic-Indic digit typed or pasted into a text field,
 * anywhere on the site or the CRM, becomes an English digit as it is typed. Runs in the capture phase, before React
 * reads the field, and sets the value through the native setter so React still sees the change.
 */
import { useEffect } from "react";
import { enDigits } from "@/lib/crm/util";

export function EnglishDigits() {
  useEffect(() => {
    const onInput = (e: Event) => {
      const el = e.target;
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
      if (el instanceof HTMLInputElement && ["number", "date", "datetime-local", "time", "file", "checkbox", "radio", "range", "color"].includes(el.type)) return;
      const v = el.value, next = enDigits(v);
      if (next === v) return;
      const start = el.selectionStart, end = el.selectionEnd;
      const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, next);
      try { if (start != null && end != null) el.setSelectionRange(start, end); } catch { /* some input types have no caret */ }
    };
    document.addEventListener("input", onInput, true);
    return () => document.removeEventListener("input", onInput, true);
  }, []);
  return null;
}
