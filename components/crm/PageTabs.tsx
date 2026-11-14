"use client";

/**
 * Screens that are views of the same thing share one sidebar item and switch by tabs
 * (client 2026-10-21: no two sections for the same thing under different names).
 */
import { useCrm } from "@/lib/crm/store";
import { NO_RESP } from "@/lib/crm/constants";
import { SubTabs } from "./ui";
import { dueInterests, dueReqInterests } from "./Interests";

/** العملاء: all clients / those who did not answer (the numbers list is its own section, «الأرقام»). */
export function ClientTabs() {
  const { data } = useCrm();
  return <SubTabs tabs={[
    { href: "/admin/clients", label: "كل العملاء" },
    { href: "/admin/noresponse", label: "لا يوجد رد", badge: data.clients.filter((c) => c.status === NO_RESP && (data.isMgr || c.assignee === data.uid)).length || undefined },
  ]} />;
}

/** العقارات: the team's inventory / what is listed on the public website. */
export function PropertyTabs() {
  const { previewAs } = useCrm();
  return <SubTabs tabs={[
    { href: "/admin/properties", label: "مخزون العقارات" },
    // The website screens write through their own helpers, so they are left out of the read-only preview.
    { href: "/admin/offers", label: "عقارات الموقع", show: !previewAs },
  ]} />;
}

/** الطلبات: requests / the raw website forms (already turned into requests, plus job applications). */
export function RequestTabs() {
  const { data, previewAs } = useCrm();
  // Clients to call back today: without a request under الاهتمامات, with one under العروض (client 2026-11-10).
  const due = new Set(dueInterests(data, true).map(({ c }) => c.id)).size;
  const dueOffers = new Set(dueReqInterests(data).map((p) => p.clientId)).size;
  const dueAd = new Set(dueInterests(data, true, "ad").map(({ c }) => c.id)).size;
  return <SubTabs tabs={[
    { href: "/admin/requests", label: "الطلبات" },
    // The customer journey after the request.
    { href: "/admin/proposals", label: "العروض", badge: dueOffers || undefined, alert: true },
    // Clients without a request who asked about a property (with a request it is an offer instead).
    { href: "/admin/interests", label: "الاهتمامات", badge: due || undefined, alert: true },
    // Leads from Snapchat / TikTok ad forms (client 2026-11-14), their own list.
    { href: "/admin/ad-interests", label: "اهتمامات الإعلان", badge: dueAd || undefined, alert: true },
    { href: "/admin/viewings", label: "الزيارات" },
    { href: "/admin/leads", label: "نماذج الموقع", show: !previewAs },
  ]} />;
}

/** لوحة المدير: the live board / the printable report. */
export function ManagerTabs() {
  return <SubTabs tabs={[
    { href: "/admin/manager", label: "لوحة المدير" },
    { href: "/admin/report", label: "التقرير (طباعة / PDF)" },
  ]} />;
}
