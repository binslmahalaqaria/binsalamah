"use client";

/**
 * Screens that are views of the same thing share one sidebar item and switch by tabs
 * (client 2026-10-21: no two sections for the same thing under different names).
 */
import { useCrm } from "@/lib/crm/store";
import { TO_CONTACT } from "@/lib/crm/constants";
import { SubTabs } from "./ui";

/** العملاء: all clients / the re-contact list. */
export function ClientTabs() {
  const { data } = useCrm();
  const mine = data.clients.filter((c) => c.status === TO_CONTACT && c.assignee === data.uid).length;
  return <SubTabs tabs={[
    { href: "/admin/clients", label: "كل العملاء" },
    { href: "/admin/contact", label: "للتواصل", badge: mine, show: data.isMgr || mine > 0 },
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
