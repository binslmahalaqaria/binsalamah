"use client";

/**
 * Marks for what was sent to a client from the CRM (client 2026-11-03): «SentMarks» for one property (message / photos
 * link / file, or «✓ الكل» when everything the property has went out) and «SentBadge» for the client as a whole
 * (shown on the client and request lists).
 */
import { useCrm } from "@/lib/crm/store";
import { SENT_KINDS, propById, sendableKinds, sentBefore, sentSummary } from "@/lib/crm/logic";
import type { CrmData } from "@/lib/crm/logic";
import type { Client, Property } from "@/lib/crm/types";
import { localDay, relDay } from "@/lib/crm/util";

/**
 * Before sending (client 2026-11-10): if any of these properties already went to the client, say so and ask.
 * Returns true to go ahead. `items`: properties in the system by id, or not added by name.
 */
export function okToResend(d: CrmData, clientId: string | null | undefined, items: { pid?: string | null; title?: string | null }[]): boolean {
  const seen = items
    .map((x) => ({ at: sentBefore(d, clientId, x.pid, x.title), name: (x.pid ? propById(d, x.pid)?.title : x.title) || "العقار" }))
    .filter((x) => x.at);
  if (!seen.length) return true;
  const lines = seen.map((x) => "• «" + x.name + "» — " + relDay(localDay(x.at!)) + " (" + localDay(x.at!) + ")");
  return window.confirm("تنبيه: قد انرسل له هذا العقار من قبل:\n" + lines.join("\n") + "\n\nترسله مرة ثانية؟");
}

export function SentMarks({ c, p }: { c: Client | undefined | null; p: Property }) {
  const v = c?.sentProps?.[p.id];
  const got = SENT_KINDS.filter(([k]) => !!v?.[k]);
  if (!got.length) return null;
  const all = got.length >= 2 && sendableKinds(p).every((k) => !!v?.[k]);
  return (
    <span className={"rounded-full px-2 py-0.5 text-[11.5px] font-semibold " + (all ? "bg-[#d8f3dc] text-[#1b6b32]" : "bg-[#e8eef9] text-[#2b4a8a]")} title="أُرسل لهذا العميل">
      {all ? "✓✓ أُرسل له الكل" : "✓ أُرسل: " + got.map(([, l]) => l).join(" + ")}
    </span>
  );
}

export function SentBadge({ c }: { c: Client | undefined | null }) {
  const { data } = useCrm();
  const s = sentSummary(data, c);
  if (!s) return null;
  return (
    <span className={"rounded-full px-2 py-0.5 text-[11.5px] font-semibold " + (s.all ? "bg-[#d8f3dc] text-[#1b6b32]" : "bg-[#e8eef9] text-[#2b4a8a]")} title="ما أُرسل لهذا العميل من «إرسال للعميل»">
      {s.all ? "✓✓ أُرسل له الكل" : "📤 أُرسل: " + s.kinds.join(" + ")}
    </span>
  );
}
