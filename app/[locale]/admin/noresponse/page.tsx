"use client";

/**
 * «لا يوجد رد» (trial 2026-10-22): clients who did not answer three calls and a WhatsApp message within
 * 48 hours. Nothing is deleted — «إعادة تفعيل» puts them back in the active list with their history.
 */
import { useCrm } from "@/lib/crm/store";
import { NO_RESP } from "@/lib/crm/constants";
import { nameOf, visibleClients } from "@/lib/crm/logic";
import { reactivateClient } from "@/lib/crm/actions";
import { ageDays } from "@/lib/crm/util";
import { ContactIcons, Empty, PageHeader } from "@/components/crm/ui";
import { ClientTabs } from "@/components/crm/PageTabs";

export default function NoResponsePage() {
  const { data, loaded, openClient, toast } = useCrm();
  if (!loaded) return <Empty>جارٍ تحميل البيانات…</Empty>;
  const list = visibleClients(data).filter((c) => c.status === NO_RESP && (data.isMgr || c.assignee === data.uid))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return (
    <>
      <ClientTabs />
      <PageHeader title="لا يوجد رد" sub="عملاء لم يردوا على 3 مكالمات ورسالة واتساب خلال 48 ساعة — بياناتهم محفوظة، ويمكن إعادتهم في أي وقت" />
      {!list.length ? <Empty>لا يوجد عملاء في هذه القائمة.</Empty> : (
        <div className="crm-card overflow-hidden">
          {list.map((c) => (
            <div key={c.id} className="crm-row grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0 cursor-pointer" onClick={() => openClient(c.id)}>
                <b className="font-heading">{c.name}</b>
                <div className="text-xs text-[var(--crm-ink-3)]">
                  <span className="num">{c.phone}</span> · رسالة الواتساب {ageDays(c.waSentAt)}{data.isMgr && c.assignee ? " · " + nameOf(data, c.assignee) : ""}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <ContactIcons phone={c.phone} />
                <button type="button" className="crm-btn sm primary" onClick={async () => { await reactivateClient(data, c.id); toast("أُعيد " + c.name + " إلى العملاء النشطين — اتصل به اليوم"); }}>إعادة تفعيل</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
