"use client";

/** «الاهتمامات»: clients who asked about a specific property, and when to get back to them (components/crm/Interests.tsx). */
import { useMemo, useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { propById } from "@/lib/crm/logic";
import { today } from "@/lib/crm/util";
import { Empty, PageHeader, RadioChips, Select } from "@/components/crm/ui";
import { InterestList, ReqInterestList, interestItems, isOpenInterest, reqInterestOffers } from "@/components/crm/Interests";
import { RequestTabs } from "@/components/crm/PageTabs";

const TABS: [string, string][] = [["due", "حان موعدها"], ["next", "القادمة"], ["good", "ممتاز"], ["req", "لهم طلب"], ["closed", "المنتهية"]];

export default function InterestsPage() {
  const { data, loaded, openModal } = useCrm();
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
  const reqDue = reqOffers.filter((p) => !!p.followUp && p.followUp <= t);
  const reqNext = reqOffers.filter((p) => !p.followUp || p.followUp > t); // also listed under «القادمة» (client 2026-11-09)
  const clientsOf = (xs: { clientId: string }[]) => new Set(xs.map((x) => x.clientId)).size;
  // Counted in clients (one number to call each), the due tab includes interests on a request whose date has come.
  const count = (k: string) => (k === "req" ? clientsOf(reqOffers) : clientsOf(inTab(k).map(({ c }) => ({ clientId: c.id }))) + (k === "due" ? clientsOf(reqDue) : k === "next" ? clientsOf(reqNext) : 0));
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
          ? reqOffers.length ? <ReqInterestList items={reqOffers} /> : <Empty>لا يوجد شيء هنا الآن.</Empty>
          : list.length || (tab === "due" && reqDue.length) || (tab === "next" && reqNext.length) ? <><InterestList items={list} />{tab === "due" && <ReqInterestList items={reqDue} />}{tab === "next" && <ReqInterestList items={reqNext} />}</> : <Empty>لا يوجد شيء هنا الآن.</Empty>}
      </div>
    </>
  );
}
