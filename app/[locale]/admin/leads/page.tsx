"use client";

/**
 * «نماذج الموقع» (client 2026-10-24): the forms visitors sent from the website, newest first, read-only.
 * Each one becomes a request automatically (WebLeadDispatcher), so this page only shows what was sent,
 * when, who has it, and where its request stands — work on it happens in «الطلبات».
 */
import { useEffect, useState } from "react";
import { listLeads } from "@/lib/leads";
import { useCrm } from "@/lib/crm/store";
import { REQ_TONE, lbl } from "@/lib/crm/constants";
import { clientById, nameOf } from "@/lib/crm/logic";
import { ageDays, fmtStamp } from "@/lib/crm/util";
import { Empty, PageHeader, Pill } from "@/components/crm/ui";
import { RequestTabs } from "@/components/crm/PageTabs";
import type { Lead } from "@/lib/types";

type WebLead = Lead & { dispatched?: { requestId?: string; clientId?: string } | null };

/** "طلب عقاري من الموقع | النوع: شقة | الحي: قرطبة | …" → "شقة · قرطبة · الميزانية: …" */
function summary(message: string | null) {
  const parts = String(message || "").split(" | ").filter((p) => p && p !== "طلب عقاري من الموقع");
  const val = (k: string) => parts.find((p) => p.startsWith(k + ":"))?.slice(k.length + 1).trim();
  const type = val("النوع"), area = val("الأحياء") || val("الحي"), budget = val("الميزانية"), purpose = val("الغرض");
  if (type || area || budget) return [type, purpose, area && area !== "غير محدد" ? area : "", budget && !/غير محدد/.test(budget) ? "الميزانية: " + budget : ""].filter(Boolean).join(" · ");
  return parts.join(" · ") || "—";
}

export default function WebFormsPage() {
  const { data, openClient } = useCrm();
  const [leads, setLeads] = useState<WebLead[] | null>(null);
  useEffect(() => { listLeads().then((l) => setLeads(l as WebLead[])).catch(() => setLeads([])); }, []);

  const GRID = "xl:grid-cols-[minmax(130px,1fr)_minmax(180px,1.6fr)_105px_90px_130px]";
  return (
    <>
      <RequestTabs />
      <PageHeader title="نماذج الموقع" sub="ما أرسله الزوار من «سجّل طلبك» في الموقع. كل نموذج يصير طلباً في «الطلبات» تلقائياً — اضغط عليه لفتح ملف العميل." />
      {leads === null ? <Empty>جارٍ التحميل…</Empty> : !leads.length ? <Empty>لم يصل أي نموذج من الموقع بعد.</Empty> : (
        <div className="crm-card overflow-hidden">
          <div className={"crm-head hidden gap-3 xl:grid " + GRID}><span>العميل</span><span>ما طلبه</span><span>أُرسل</span><span>المسؤول</span><span>الطلب في النظام</span></div>
          {leads.map((l) => {
            const reqId = l.dispatched?.requestId;
            const r = reqId ? data.requests.find((x) => x.id === reqId) : undefined;
            const c = clientById(data, r?.clientId || l.dispatched?.clientId || null);
            const st = r?.status || "جديد";
            const open = () => c && openClient(c.id, r?.id);
            return (
              <div key={l.id} className={"crm-row grid-cols-2 gap-x-3 gap-y-1.5 " + GRID + (c ? " cursor-pointer" : "")} onClick={open}>
                <div className="min-w-0">
                  <b className="font-heading text-[15px]">{l.customer_name || "—"}</b>
                  <div className="num text-xs text-[var(--crm-ink-3)]">{l.phone}</div>
                </div>
                <div className="col-span-2 min-w-0 text-[13px] text-[var(--crm-ink-2)] xl:col-span-1">{summary(l.message)}</div>
                <div className="text-[12.5px] text-[var(--crm-ink-2)]">{ageDays(new Date(l.created_at).toISOString())}<span className="block text-[11.5px] text-[var(--crm-ink-3)]">{fmtStamp(new Date(l.created_at).toISOString())}</span></div>
                <div className="text-[13px]">{r?.assignee || l.assigned_to ? nameOf(data, (r?.assignee || l.assigned_to)!) : <span className="text-[var(--crm-warn)]">غير مسند</span>}</div>
                <div className="col-span-2 flex flex-wrap items-center gap-1 xl:col-span-1">
                  {r ? <>
                    <Pill tone={REQ_TONE[st]}>{lbl(st)}</Pill>
                    {r.awaitingUpdate && <Pill tone="hot">بانتظار التحديث</Pill>}
                  </> : reqId ? <span className="text-xs text-[var(--crm-ink-3)]">الطلب محذوف</span>
                    : <span className="text-xs text-[var(--crm-warn)]">يُنشأ طلبه خلال لحظات</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
