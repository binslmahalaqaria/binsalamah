"use client";

/** «الاهتمامات»: clients who asked about a specific property, and when to get back to them (components/crm/Interests.tsx). */
import { useMemo, useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { propById } from "@/lib/crm/logic";
import { today } from "@/lib/crm/util";
import { ContactIcons, Empty, PageHeader, Pill, RadioChips, Select } from "@/components/crm/ui";
import { InterestList, interestItems, isOpenInterest, reqInterestOffers } from "@/components/crm/Interests";
import { TempPill } from "@/components/crm/bits";
import type { Proposal } from "@/lib/crm/types";
import { RequestTabs } from "@/components/crm/PageTabs";

const TABS: [string, string][] = [["due", "حان موعدها"], ["next", "القادمة"], ["good", "ممتاز"], ["req", "لهم طلب"], ["closed", "المنتهية"]];

export default function InterestsPage() {
  const { data, loaded, openModal, openClient } = useCrm();
  const [tab, setTab] = useState("due");
  const [q, setQ] = useState("");
  const [pid, setPid] = useState("");
  const all = useMemo(() => interestItems(data), [data]);
  if (!loaded) return <Empty>جارٍ تحميل البيانات…</Empty>;

  const t = today();
  const inTab = (k: string) => all.filter(({ x }) => {
    const open = isOpenInterest(x), due = !!x.followUp && x.followUp <= t;
    return k === "due" ? open && due : k === "next" ? open && !due : k === "good" ? x.status === "ممتاز" : !open;
  });
  const title = (id: string | null, fallback: string) => propById(data, id)?.title || fallback;
  const needle = q.trim();
  // Clients with an open request: their interests are offers «مهتم» (العروض); listed here one row per client,
  // opening the client file, while the request itself stays in الطلبات (client 2026-11-09).
  const reqOffers = reqInterestOffers(data)
    .filter((p) => !pid || p.propertyId === pid)
    .filter((p) => {
      const c = data.clients.find((x) => x.id === p.clientId);
      return !needle || [c?.name, c?.phone, title(p.propertyId || null, p.propertyTitle || ""), p.note].some((v) => String(v || "").includes(needle));
    })
  const reqGroups = new Map<string, Proposal[]>();
  for (const p of reqOffers) reqGroups.set(p.clientId, [...(reqGroups.get(p.clientId) || []), p]);
  const count = (k: string) => (k === "req" ? reqGroups.size : inTab(k).length);
  const list = inTab(tab)
    .filter(({ c, x }) => (!pid || x.propertyId === pid)
      && (!needle || [c.name, c.phone, title(x.propertyId, x.propertyTitle), x.note].some((v) => String(v || "").includes(needle))))
    .sort((a, b) => tab === "closed" ? String(b.x.at).localeCompare(String(a.x.at)) : String(a.x.followUp).localeCompare(String(b.x.followUp)));
  const props = Array.from(new Map(all.map(({ x }) => [x.propertyId || "", title(x.propertyId, x.propertyTitle)])).entries()).filter(([id]) => id);

  return (
    <>
      <RequestTabs />
      <PageHeader title="الاهتمامات" sub="عملاء ما لهم طلب استفسروا عن عقار معيّن — نرجع لهم في موعدهم. إذا انسجل له طلب تنتقل عقاراته للعروض"
        action={<button type="button" className="crm-btn primary" onClick={() => openModal({ kind: "interest" })}>+ تسجيل اهتمام</button>} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <RadioChips options={TABS.map(([k, l]) => [k, l + " (" + count(k) + ")"] as [string, string])} value={tab} onChange={setTab} />
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <input value={q} placeholder="بحث بالاسم أو الجوال أو العقار" onChange={(e) => setQ(e.target.value)} />
        <Select value={pid} onChange={setPid} blank="كل العقارات" options={props} ariaLabel="العقار" />
      </div>
      <div className="crm-card overflow-hidden">
        {tab === "req"
          ? reqGroups.size ? [...reqGroups.entries()].map(([cid, ps]) => {
            const c = data.clients.find((x) => x.id === cid);
            if (!c) return null;
            const r = data.requests.find((x) => x.id === ps[0].requestId);
            return (
              <div key={cid} className="crm-row grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0 cursor-pointer" onClick={() => openClient(c.id)}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <b className="font-heading">{c.name}</b><TempPill t={c.temp} />
                    <Pill tone="muted">له طلب{r?.ref ? " ط-" + r.ref : ""}</Pill>
                  </div>
                  {ps.map((p) => (
                    <div key={p.id} className="truncate text-[13px] text-[var(--crm-ink-2)]">
                      مهتم في: {title(p.propertyId || null, p.propertyTitle || "عقار")}{p.unit ? " · " + p.unit : ""}{!p.propertyId ? " (غير مضاف)" : ""}{p.feedback ? " — " + p.feedback : ""}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <ContactIcons phone={c.phone} />
                  <button type="button" className="crm-btn sm primary" onClick={() => openClient(c.id)}>ملف العميل</button>
                </div>
              </div>
            );
          }) : <Empty>لا يوجد شيء هنا الآن.</Empty>
          : list.length ? <InterestList items={list} /> : <Empty>لا يوجد شيء هنا الآن.</Empty>}
      </div>
    </>
  );
}
