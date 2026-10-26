"use client";

/**
 * "الإعدادات" — everything the owner and sales managers configure in the CRM:
 * option lists, round-robin assignment, employee permissions (owner), overdue
 * escalation (owner), and tools (accounts, website settings, demo data, import).
 */
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useCrm } from "@/lib/crm/store";
import { Empty, PageHeader } from "@/components/crm/ui";
import { AutoAssign, Escalation, ListEditor, NumberFeedCard, PermsEditor } from "@/components/crm/SettingsParts";
import { DemoData } from "@/components/crm/DemoData";
import { ImportOld } from "@/components/crm/ImportOld";
import { ResetData } from "@/components/crm/ResetData";
import { CompanyDocs } from "@/components/crm/CompanyDocs";
import { ZatcaLink } from "@/components/crm/ZatcaLink";

export default function SetupPage() {
  const { data, loaded } = useCrm();
  const [tab, setTab] = useState("lists");
  if (!loaded) return <Empty>جارٍ تحميل البيانات…</Empty>;
  if (!data.isMgr) return <Empty>هذه الصفحة مخصصة للمالك ومدير المبيعات.</Empty>;

  const tabs: [string, string][] = [
    ["lists", "القوائم"],
    ["assign", "التوزيع التلقائي"],
    ...(data.isAdmin ? ([["perms", "الصلاحيات"], ["escalate", "إعادة العملاء"], ["tools", "أدوات"]] as [string, string][]) : []),
  ];

  return (
    <>
      <PageHeader title="الإعدادات" sub="القوائم والتوزيع والصلاحيات وإعدادات النظام" />
      <div className="crm-seg mb-4">
        {tabs.map(([k, l]) => <button key={k} type="button" className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === "lists" && (
        <div className="grid items-start gap-3 lg:grid-cols-2">
          <ListEditor field="propTypes" />
          <ListEditor field="sources" />
        </div>
      )}
      {tab === "assign" && <div className="grid max-w-2xl gap-3"><AutoAssign /><NumberFeedCard /></div>}
      {tab === "perms" && data.isAdmin && <PermsEditor />}
      {tab === "escalate" && data.isAdmin && <div className="max-w-2xl"><Escalation /></div>}
      {tab === "tools" && data.isAdmin && (
        <div className="grid max-w-2xl gap-3">
          <div className="crm-card flex flex-wrap items-center gap-2 p-4">
            <span className="flex-1 text-sm">حسابات الموظفين (الإضافة والأدوار) وإعدادات الموقع (رقم الواتساب والتواصل):</span>
            <Link href="/admin/staff" className="crm-btn">حسابات الموظفين</Link>
            <Link href="/admin/settings" className="crm-btn">إعدادات الموقع</Link>
          </div>
          <CompanyDocs />
          <ZatcaLink />
          <DemoData />
          <ImportOld />
          <ResetData />
        </div>
      )}
    </>
  );
}
