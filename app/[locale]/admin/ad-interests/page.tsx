"use client";

/**
 * «اهتمامات الإعلان» (client 2026-11-14): people who filled a Snapchat or TikTok ad lead form. Each comes in as a
 * client with an interest to call back today (components/crm/WebLeadDispatcher.tsx, Interest.origin), kept apart
 * from الاهتمامات. Same rows and follow-up as there: record the call, set the next date or a visit, or turn it into
 * a request.
 */
import { useMemo, useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { today } from "@/lib/crm/util";
import { Empty, PageHeader, RadioChips, Select } from "@/components/crm/ui";
import { InterestList, interestItems, isOpenInterest } from "@/components/crm/Interests";
import { RequestTabs } from "@/components/crm/PageTabs";
import { MoveSiteInterests } from "@/components/crm/MoveSiteInterests";

// Only «مهتم» or «غير مهتم» here (client 2026-11-14), so no «ممتاز» tab.
const TABS: [string, string][] = [["due", "حان موعدها"], ["next", "القادمة"], ["closed", "غير مهتم / المنتهية"]];

export default function AdInterestsPage() {
  const { data, loaded } = useCrm();
  const [tab, setTab] = useState("due");
  const [q, setQ] = useState("");
  const [src, setSrc] = useState("");
  const all = useMemo(() => interestItems(data, false, "ad"), [data]);
  if (!loaded) return <Empty>جارٍ تحميل البيانات…</Empty>;

  const t = today();
  const inTab = (k: string) => all.filter(({ x }) => {
    const open = isOpenInterest(x), due = !!x.followUp && x.followUp <= t;
    return k === "due" ? open && due : k === "next" ? open && !due : k === "good" ? x.status === "ممتاز" : !open;
  });
  const needle = q.trim();
  const pick = (k: string) => inTab(k).filter(({ c, x }) => (!src || x.origin === src)
    && (!needle || [c.name, c.phone, x.propertyTitle, x.note].some((v) => String(v || "").includes(needle))));
  const count = (k: string) => new Set(pick(k).map(({ c }) => c.id)).size;
  const list = pick(tab).sort((a, b) => tab === "closed" ? String(b.x.at).localeCompare(String(a.x.at)) : String(a.x.followUp).localeCompare(String(b.x.followUp)));
  const sources = Array.from(new Set(all.map(({ x }) => x.origin).filter(Boolean))) as string[];

  return (
    <>
      <RequestTabs />
      <PageHeader title="اهتمامات الإعلان" sub="عملاء سجّلوا اهتمامهم من إعلان: سناب، تيك توك، أو «سجّل اهتمامك» في الموقع — اتصل عليهم، وسجّل المتابعة أو حوّلهم طلب" />
      <MoveSiteInterests />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <RadioChips options={TABS.map(([k, l]) => [k, l + " (" + count(k) + ")"] as [string, string])} value={tab} onChange={setTab} />
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <input value={q} placeholder="بحث بالاسم أو الجوال أو الحملة" onChange={(e) => setQ(e.target.value)} />
        <Select value={src} onChange={setSrc} blank="كل الإعلانات" options={(sources.length ? sources : ["سناب", "تيك توك", "الموقع"]).map((s) => [s, s] as [string, string])} ariaLabel="المصدر" />
      </div>
      <div className="crm-card overflow-hidden">
        {list.length ? <InterestList items={list} /> : <Empty>{all.length ? "لا يوجد شيء هنا الآن." : "ما وصل أحد بعد. أول ما أحد يسجّل اهتمامه من إعلان أو من الموقع يطلع هنا."}</Empty>}
      </div>
    </>
  );
}
