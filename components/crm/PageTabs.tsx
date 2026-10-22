"use client";

/**
 * Screens that are views of the same thing share one sidebar item and switch by tabs
 * (client 2026-10-21: no two sections for the same thing under different names).
 */
import { useCrm } from "@/lib/crm/store";
import { NO_RESP } from "@/lib/crm/constants";
import { SubTabs } from "./ui";

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
    { href: "/admin/offers", label: "المعروضة في الموقع", show: !previewAs },
  ]} />;
}

/** الطلبات: requests / the raw website forms (already turned into requests, plus job applications). */
export function RequestTabs() {
  const { previewAs } = useCrm();
  return <SubTabs tabs={[
    { href: "/admin/requests", label: "الطلبات" },
    // Trial 2026-10-22: the customer journey after the request.
    { href: "/admin/search", label: "قائمة البحث" },
    { href: "/admin/proposals", label: "العروض" },
    { href: "/admin/viewings", label: "المعاينات" },
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
