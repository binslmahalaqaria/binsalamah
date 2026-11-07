"use client";

/** Attach a client or request to a chat message: type a name, mobile number, or request number and pick from the list. */
import { useMemo, useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { OPEN_REQ, reqsOf, visibleClients, wantLine } from "@/lib/crm/logic";
import type { Client, Request } from "@/lib/crm/types";

export interface Attached { clientId: string; reqId: string | null }

const enDigits = (s: string) => s.replace(/[٠-٩]/g, (x) => String("٠١٢٣٤٥٦٧٨٩".indexOf(x)));
const onlyDigits = (s: string | null | undefined) => enDigits(s || "").replace(/[^0-9]/g, "");
export const reqLabel = (r: Request | null | undefined) => (r ? "طلب" + (r.ref ? " ط-" + r.ref : "") : "");

export function ChatAttach({ value, onChange }: { value: Attached | null; onChange: (v: Attached | null) => void }) {
  const { data } = useCrm();
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const raw = enDigits(q.trim());
    if (!raw) return [];
    // «ط-12», «ط12» or «12» look for that request number; digits also search mobiles; anything else searches names.
    const refText = raw.replace(/^ط\s*-?\s*/, "");
    const ref = /^[0-9]+$/.test(refText) ? +refText : null;
    const phone = onlyDigits(raw).replace(/^0/, "");
    const pool: Client[] = data.isMgr ? data.clients : visibleClients(data);
    const out: { c: Client; r: Request | null; rank: number }[] = [];
    for (const c of pool) {
      const reqs = data.requests.filter((r) => r.clientId === c.id);
      const hit = reqs.find((r) => ref != null && r.ref === ref);
      if (hit) { out.push({ c, r: hit, rank: 0 }); continue; }
      const byPhone = phone.length >= 3 && onlyDigits(c.phone).includes(phone);
      if (!byPhone && !(c.name || "").includes(raw)) continue;
      const open = reqsOf(data, c);
      if (open.length) open.forEach((r) => out.push({ c, r, rank: 1 }));
      else out.push({ c, r: reqs.find(OPEN_REQ) || null, rank: 2 });
    }
    return out.sort((a, b) => a.rank - b.rank).slice(0, 8);
  }, [q, data]);

  const pick = (c: Client, r: Request | null) => { onChange({ clientId: c.id, reqId: r?.id || null }); setQ(""); };
  const cur = value ? data.clients.find((c) => c.id === value.clientId) : null;
  const curR = value?.reqId ? data.requests.find((r) => r.id === value.reqId) : null;

  if (value) {
    return (
      <div className="flex w-full items-center gap-2 rounded-lg bg-[var(--crm-surface-2)] px-2.5 py-1.5 text-[13px]">
        <span className="min-w-0 flex-1 truncate">📎 {curR ? reqLabel(curR) + " · " : "العميل: "}{cur?.name}</span>
        <button type="button" className="crm-btn ghost sm" onClick={() => onChange(null)}>إزالة</button>
      </div>
    );
  }
  return (
    <div className="relative w-full">
      <input value={q} placeholder="📎 أرفق طلب أو عميل: اكتب الاسم أو الجوال أو رقم الطلب" aria-label="أرفق طلب أو عميل"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && results[0]) { e.preventDefault(); pick(results[0].c, results[0].r); } }} />
      {q.trim() !== "" && (
        <div className="absolute inset-x-0 bottom-full z-10 mb-1 max-h-64 overflow-y-auto rounded-xl border border-[var(--crm-line)] bg-white shadow-lg">
          {results.length ? results.map(({ c, r }) => (
            <button key={c.id + (r?.id || "")} type="button" className="grid w-full gap-0.5 border-b border-[var(--crm-line)] px-3 py-2 text-start last:border-0 hover:bg-[var(--crm-surface-2)]" onClick={() => pick(c, r)}>
              <span className="text-[14px]"><b>{c.name}</b>{r ? " · " + reqLabel(r) : ""}</span>
              <span className="truncate text-[12.5px] text-[var(--crm-ink-3)]"><span className="num">{c.phone || ""}</span>{r ? " · " + wantLine(data, c) : " · بدون طلب"}</span>
            </button>
          )) : <div className="px-3 py-2.5 text-[13px] text-[var(--crm-ink-3)]">ما لقيت شيء بهذا البحث.</div>}
        </div>
      )}
    </div>
  );
}
