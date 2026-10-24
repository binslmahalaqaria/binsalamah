"use client";

/** «العروض» (trial 2026-10-22): every property sent to a customer, with its status and the customer's feedback. */
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useCrm } from "@/lib/crm/store";
import { PROP_OPEN, PROP_ST } from "@/lib/crm/constants";
import { members, nameOf } from "@/lib/crm/logic";
import { Empty, PageHeader, Select } from "@/components/crm/ui";
import { ProposalRow } from "@/components/crm/Journey";
import { RequestTabs } from "@/components/crm/PageTabs";

export default function ProposalsPage() {
  const { data, loaded } = useCrm();
  const [st, setSt] = useState("open");
  const [who, setWho] = useState("");
  if (!loaded) return <Empty>جارٍ تحميل البيانات…</Empty>;
  let list = data.proposals.filter((p) => (data.isMgr ? !data.viewAs || p.assignee === data.viewAs : p.assignee === data.uid));
  if (who) list = list.filter((p) => p.assignee === who);
  if (st === "open") list = list.filter((p) => PROP_OPEN.includes(p.status));
  else if (st) list = list.filter((p) => p.status === st);
  return (
    <>
      <RequestTabs />
      <PageHeader title="العروض" sub="العقارات المرسلة للعملاء وحالتها ورأيهم — غير المناسب يعيد الطلب إلى مرحلة «جاري البحث»" />
      <div className="crm-card mb-3 flex flex-wrap items-center gap-2 p-2.5">
        <Select value={st} onChange={setSt} options={[["open", "القائمة"], ...PROP_ST.map((x) => [x, x] as [string, string])]} blank="كل الحالات" />
        {data.isMgr && <Select value={who} onChange={setWho} options={members(data).map((id) => [id, nameOf(data, id)] as [string, string])} blank="كل الموظفين" />}
        <span className="muted ms-auto text-[13px]">{list.length} عرض</span>
      </div>
      {!list.length ? <Empty><span className="grid justify-items-center gap-2.5">لا توجد عروض بهذا الفلتر. تُسجَّل العروض تلقائياً عند إرسال عقار لعميل من صفحة الطلبات.<Link href="/admin/requests" className="crm-btn primary">اذهب إلى الطلبات</Link></span></Empty>
        : <div className="crm-card overflow-hidden">{list.map((p) => <ProposalRow key={p.id} p={p} />)}</div>}
    </>
  );
}
