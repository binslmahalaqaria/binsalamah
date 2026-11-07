"use client";

/** «الاهتمامات»: clients who asked about a specific property, and when to get back to them (components/crm/Interests.tsx). */
import { useMemo, useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { propById } from "@/lib/crm/logic";
import { today } from "@/lib/crm/util";
import { Empty, PageHeader, RadioChips, Select } from "@/components/crm/ui";
import { InterestRow, interestItems, isOpenInterest } from "@/components/crm/Interests";

const TABS: [string, string][] = [["due", "حان موعدها"], ["next", "القادمة"], ["good", "ممتاز"], ["closed", "المنتهية"]];

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
  const list = inTab(tab)
    .filter(({ c, x }) => (!pid || x.propertyId === pid)
      && (!needle || [c.name, c.phone, title(x.propertyId, x.propertyTitle), x.note].some((v) => String(v || "").includes(needle))))
    .sort((a, b) => tab === "closed" ? String(b.x.at).localeCompare(String(a.x.at)) : String(a.x.followUp).localeCompare(String(b.x.followUp)));
  const props = Array.from(new Map(all.map(({ x }) => [x.propertyId || "", title(x.propertyId, x.propertyTitle)])).entries()).filter(([id]) => id);

  return (
    <>
      <PageHeader title="الاهتمامات" sub="عملاء استفسروا عن عقار معيّن — نرجع لهم في موعدهم"
        action={<button type="button" className="crm-btn primary" onClick={() => openModal({ kind: "interest" })}>+ تسجيل اهتمام</button>} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <RadioChips options={TABS.map(([k, l]) => [k, l + " (" + inTab(k).length + ")"] as [string, string])} value={tab} onChange={setTab} />
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <input value={q} placeholder="بحث بالاسم أو الجوال أو العقار" onChange={(e) => setQ(e.target.value)} />
        <Select value={pid} onChange={setPid} blank="كل العقارات" options={props} ariaLabel="العقار" />
      </div>
      <div className="crm-card overflow-hidden">
        {list.length ? list.map(({ c, x }) => <InterestRow key={c.id + x.id} c={c} x={x} />) : <Empty>لا يوجد شيء هنا الآن.</Empty>}
      </div>
    </>
  );
}
