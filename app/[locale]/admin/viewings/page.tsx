"use client";

/** «الزيارات» (trial 2026-10-22): every viewing with its status, feedback and follow-up. */
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useCrm } from "@/lib/crm/store";
import { VIEW_ST } from "@/lib/crm/constants";
import { members, nameOf } from "@/lib/crm/logic";
import { Empty, PageHeader, Select } from "@/components/crm/ui";
import { ViewingRow } from "@/components/crm/Journey";
import { RequestTabs } from "@/components/crm/PageTabs";

export default function ViewingsPage() {
  const { data, loaded } = useCrm();
  const [st, setSt] = useState("open");
  const [who, setWho] = useState("");
  if (!loaded) return <Empty>جارٍ تحميل البيانات…</Empty>;
  let list = data.viewings.filter((v) => (data.isMgr ? !data.viewAs || v.assignee === data.viewAs : v.assignee === data.uid));
  if (who) list = list.filter((v) => v.assignee === who);
  if (st === "open") list = list.filter((v) => ["مجدولة", "مؤجلة"].includes(v.status));
  else {
    if (st) list = list.filter((v) => v.status === st);
    list = [...list].reverse();
  }
  return (
    <>
      <RequestTabs />
      <PageHeader title="الزيارات" sub="المواعيد القادمة، وما يحتاج تسجيل نتيجته، وسجل الزيارات السابقة" />
      <div className="crm-card mb-3 flex flex-wrap items-center gap-2 p-2.5">
        <Select value={st} onChange={setSt} options={[["open", "القادمة والمؤجلة"], ...VIEW_ST.map((x) => [x, x] as [string, string])]} blank="كل الحالات" />
        {data.isMgr && <Select value={who} onChange={setWho} options={members(data).map((id) => [id, nameOf(data, id)] as [string, string])} blank="كل الموظفين" />}
        <span className="muted ms-auto text-[13px]">{list.length} زيارة</span>
      </div>
      {!list.length ? <Empty><span className="grid justify-items-center gap-2.5">لا توجد زيارات بهذا الفلتر. تُسجَّل عند تحديد موعد زيارة من عرض مرسل.<Link href="/admin/proposals" className="crm-btn primary">اذهب إلى العروض</Link></span></Empty>
        : <div className="crm-card overflow-hidden">{list.map((v) => <ViewingRow key={v.id} v={v} />)}</div>}
    </>
  );
}
