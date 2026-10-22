"use client";

/**
 * «قائمة البحث» (trial 2026-10-22): open requests still waiting for a suitable property — new, searching,
 * or every offer turned out unsuitable. Filter by district, type and budget; send matching properties
 * from here (each send is recorded as an offer).
 */
import { useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { PROP_OPEN } from "@/lib/crm/constants";
import { clientById, match, nameOf, OPEN_REQ, typesOf, visibleRequests } from "@/lib/crm/logic";
import { ageDays, num, splitList } from "@/lib/crm/util";
import { ContactIcons, Empty, PageHeader, Select } from "@/components/crm/ui";
import { NeedLine, TempPill } from "@/components/crm/bits";
import { RequestTabs } from "@/components/crm/PageTabs";

export default function SearchListPage() {
  const { data, loaded, openClient, openModal } = useCrm();
  const [dist, setDist] = useState("");
  const [type, setType] = useState("");
  const [budget, setBudget] = useState("");
  if (!loaded) return <Empty>جارٍ تحميل البيانات…</Empty>;
  const openOffers = (id: string) => data.proposals.filter((p) => p.requestId === id && PROP_OPEN.includes(p.status)).length;
  let list = visibleRequests(data).filter((r) => OPEN_REQ(r) && (data.isMgr || r.assignee === data.uid) &&
    (["جديد", "جاري البحث"].includes(r.status || "جديد") || (r.status === "أرسلنا خيارات" && !openOffers(r.id))));
  if (dist.trim()) list = list.filter((r) => splitList(r.districts).some((d) => d.includes(dist.trim())));
  if (type) list = list.filter((r) => typesOf(r).includes(type));
  const bmax = num(budget);
  if (bmax) list = list.filter((r) => !r.budget || r.budget <= bmax);
  list = list.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  return (
    <>
      <RequestTabs />
      <PageHeader title="قائمة البحث" sub="طلبات لم نجد لها عقاراً مناسباً بعد — أرسل لهم المناسب، وكل إرسال يُسجَّل عرضاً" />
      <div className="crm-card mb-3 flex flex-wrap items-center gap-2 p-2.5">
        <input className="w-[160px]" placeholder="الحي" value={dist} onChange={(e) => setDist(e.target.value)} />
        <Select value={type} onChange={setType} options={data.propTypes} blank="كل الأنواع" />
        <input className="w-[170px]" inputMode="decimal" placeholder="الميزانية حتى" value={budget} onChange={(e) => setBudget(e.target.value)} />
        <span className="muted ms-auto text-[13px]">{list.length} طلب</span>
      </div>
      {!list.length ? <Empty>لا توجد طلبات بانتظار البحث.</Empty> : (
        <div className="crm-card overflow-hidden">
          {list.map((r) => {
            const c = clientById(data, r.clientId);
            const ms = data.props.filter((p) => match(r, p)).length;
            const rejected = data.proposals.filter((p) => p.requestId === r.id && p.status === "غير مناسب").length;
            return (
              <div key={r.id} className="crm-row grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0 cursor-pointer" onClick={() => c && openClient(c.id, r.id)}>
                  <div className="flex flex-wrap items-center gap-1.5"><b className="font-heading">{c?.name || "—"}</b>{c?.temp && <TempPill t={c.temp} />}</div>
                  <NeedLine r={r} />
                  <div className="text-xs text-[var(--crm-ink-3)]">
                    أُضيف الطلب {ageDays(r.createdAt)}{rejected ? " · " + rejected + " عرض غير مناسب" : ""}{data.isMgr && r.assignee ? " · " + nameOf(data, r.assignee) : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <ContactIcons phone={c?.phone} />
                  {ms ? <button type="button" className="crm-btn sm primary" onClick={() => openModal({ kind: "reqMatches", reqId: r.id })}>{ms} {ms === 1 ? "عقار مناسب" : "عقارات مناسبة"} — أرسل</button>
                    : <span className="muted text-xs">لا يوجد عقار مطابق في المخزون</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
