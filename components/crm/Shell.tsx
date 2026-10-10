"use client";

/**
 * CRM chrome: dark sidebar (desktop) / bottom nav + "more" sheet (phones),
 * section grouping and order from the original artifact CRM, plus the
 * single host for the client drawer, modals, and toasts so any screen can
 * open them. Also runs the overdue-client escalation for managers.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useCrm } from "@/lib/crm/store";
import { dueCalls, members, myTasksOpen, nameOf, visibleRequests } from "@/lib/crm/logic";
import { runEscalation } from "@/lib/crm/actions";
import { Logo } from "@/components/Logo";
import { Icon } from "./ui";
import { ClientDrawer } from "./ClientDrawer";
import { ModalHost } from "./modals";
import { Assistant } from "./Assistant";

interface NavItem {
  href: string;
  k: string;
  label: string;
  badge?: number;
}

const ROLE_AR: Record<string, string> = { admin: "المالك", manager: "مدير مبيعات", sales: "موظف مبيعات" };

export function CrmShell({ children }: { children: ReactNode }) {
  const { data, chat, me, settings, setViewAs, toastMsg, loaded } = useCrm();
  const pathname = usePathname();
  const locale = useLocale();
  const [moreOpen, setMoreOpen] = useState(false);

  const due = dueCalls(data).length;
  const newTasks = myTasksOpen(data).filter((t) => t.seen === false).length;
  const newReq = visibleRequests(data).filter((r) => (r.status || "جديد") === "جديد").length;
  const myStaff = data.staff.find((s) => s.id === data.uid);
  const unread = chat.filter((m) => m.by !== data.uid && (!myStaff?.chatSeen || m.at > myStaff.chatSeen)).length;

  const groups: [string, NavItem[]][] = [
    ["", [{ href: "/admin", k: "today", label: "اليوم", badge: due + newTasks }]],
    ["المبيعات", [
      { href: "/admin/requests", k: "requests", label: "الطلبات", badge: newReq },
      { href: "/admin/clients", k: "clients", label: "العملاء" },
      { href: "/admin/sales", k: "sales", label: "المبيعات" },
    ]],
    ["المخزون", [{ href: "/admin/properties", k: "props", label: "العقارات" }]],
    ["الموقع", [
      { href: "/admin/leads", k: "leads", label: "استفسارات الموقع" },
      { href: "/admin/offers", k: "web", label: "عروض الموقع" },
    ]],
    ["الفريق", [
      ...(data.isMgr ? [{ href: "/admin/manager", k: "sales", label: "لوحة المدير" }] : []),
      { href: "/admin/chat", k: "chat", label: "الدردشة", badge: pathname === "/admin/chat" ? 0 : unread },
      { href: "/admin/team", k: "team", label: "الفريق" },
    ]],
  ];
  const all = groups.flatMap(([, xs]) => xs);
  const isOn = (h: string) => (h === "/admin" ? pathname === "/admin" : pathname.startsWith(h));
  const mainK = ["today", "requests", "clients", "props"];
  const moreItems = all.filter((x) => !mainK.includes(x.k));
  const moreBadge = moreItems.reduce((a, x) => a + (x.badge || 0), 0);

  // Escalate overdue clients back to the sales manager (managers' browsers only, once data is in).
  const escDone = useRef(new Set<string>());
  useEffect(() => {
    if (!loaded || !data.isMgr || settings.escalateOff) return;
    const mgr = settings.salesManager || data.staff.find((s) => s.role === "admin" && s.active)?.id;
    if (!mgr) return;
    const t = setTimeout(() => runEscalation(data, mgr, settings.escalateDays || 2, escDone.current).catch(() => {}), 5000);
    return () => clearTimeout(t);
  }, [loaded, data, settings]);

  useEffect(() => setMoreOpen(false), [pathname]);

  const meBox = (dark: boolean) =>
    me && (
      <div className="grid gap-2">
        <div className="flex items-center gap-2.5">
          <div className={"grid h-9 w-9 shrink-0 place-items-center rounded-full font-semibold " + (dark ? "bg-white/10" : "bg-[var(--crm-surface-2)]")}>
            {(me.name || "؟").slice(0, 1)}
          </div>
          <div className="min-w-0">
            <b className="block truncate text-sm">{me.name}</b>
            <span className={"block text-xs " + (dark ? "text-white/50" : "text-[var(--crm-ink-3)]")}>{ROLE_AR[me.role]}</span>
          </div>
        </div>
        {data.isMgr && (
          <>
            <label className={"text-[11.5px] " + (dark ? "text-white/50" : "text-[var(--crm-ink-3)]")} htmlFor={"viewAs" + (dark ? "" : "M")}>عرض شغل</label>
            <select id={"viewAs" + (dark ? "" : "M")} value={data.viewAs} onChange={(e) => setViewAs(e.target.value)}
              className={dark ? "!border-white/15 !bg-white/5 !text-white [&>option]:text-black" : ""}>
              <option value="">كل الفريق</option>
              {members(data).map((id) => <option key={id} value={id}>{nameOf(data, id)}</option>)}
              <option value="none">غير مسندين ({data.clients.filter((c) => !c.assignee).length})</option>
            </select>
          </>
        )}
        <button type="button" onClick={() => signOut(auth)}
          className={"flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm " + (dark ? "text-white/60 hover:text-red-300" : "text-[var(--crm-ink-3)] hover:text-[var(--crm-danger)]")}>
          <Icon k="logout" size={18} /> تسجيل الخروج
        </button>
      </div>
    );

  return (
    <div className="crm min-h-screen" dir="rtl" lang="ar">
      <div className="md:grid md:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-screen flex-col gap-4 overflow-y-auto border-s border-[var(--crm-gold)]/20 bg-[#262626] px-3.5 py-5 text-[#efeae3] md:flex">
          <div className="border-b border-[var(--crm-gold)]/25 px-2 pb-4">
            <Logo variant="light" locale={locale} />
          </div>
          <nav className="grid flex-1 content-start gap-0.5" aria-label="الأقسام">
            {groups.map(([g, xs]) => (
              <div key={g || "top"} className="grid gap-0.5">
                {g && <div className="px-3 pt-3.5 pb-1 text-[11px] tracking-wide text-white/40">{g}</div>}
                {xs.map((x) => (
                  <Link key={x.href} href={x.href} aria-current={isOn(x.href) ? "page" : undefined}
                    className={"flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14.5px] font-medium transition-colors " +
                      (isOn(x.href) ? "bg-[var(--crm-gold)]/15 text-white shadow-[inset_-2px_0_0_var(--crm-gold)] [&_svg]:text-[var(--crm-gold)]" : "text-white/75 hover:bg-white/5 hover:text-white")}>
                    <Icon k={x.k} />
                    <span>{x.label}</span>
                    {!!x.badge && (
                      <span className={"ms-auto rounded-full border px-2 text-[11px] font-semibold leading-[18px] num " +
                        (isOn(x.href) ? "border-[var(--crm-gold)] bg-[var(--crm-gold)] text-[#262626]" : "border-[var(--crm-gold)]/50 text-[var(--crm-gold)]")}>{x.badge}</span>
                    )}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="border-t border-[var(--crm-gold)]/20 px-1.5 pt-3">{meBox(true)}</div>
        </aside>

        <div className="mx-auto w-full min-w-0 max-w-[1280px] px-3.5 pt-3 pb-28 md:px-7 md:pt-6 md:pb-16">{children}</div>
      </div>

      {/* phones: bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-[var(--crm-line)] bg-white px-1 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] md:hidden" aria-label="التنقل">
        {all.filter((x) => mainK.includes(x.k)).map((x) => (
          <Link key={x.href} href={x.href} className={"relative grid justify-items-center gap-0.5 py-1 text-[11px] " + (isOn(x.href) ? "font-bold text-[var(--crm-ink)] [&_svg]:text-[var(--crm-gold)]" : "text-[var(--crm-ink-3)]")}>
            <Icon k={x.k} />
            <span>{x.label}</span>
            {!!x.badge && <i className="num absolute top-0 end-3 rounded-full bg-[var(--crm-danger)] px-1.5 text-[10.5px] not-italic font-bold leading-4 text-white">{x.badge}</i>}
          </Link>
        ))}
        <button type="button" onClick={() => setMoreOpen((v) => !v)} className={"relative grid justify-items-center gap-0.5 py-1 text-[11px] " + (moreItems.some((x) => isOn(x.href)) ? "font-bold" : "text-[var(--crm-ink-3)]")}>
          <Icon k="more" />
          <span>المزيد</span>
          {!!moreBadge && <i className="num absolute top-0 end-3 rounded-full bg-[var(--crm-danger)] px-1.5 text-[10.5px] not-italic font-bold leading-4 text-white">{moreBadge}</i>}
        </button>
      </nav>
      {moreOpen && (
        <>
          <div className="fixed inset-0 z-[18] bg-black/45 md:hidden" onClick={() => setMoreOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 z-[19] grid gap-3.5 rounded-t-3xl bg-white p-4 pb-[calc(84px+env(safe-area-inset-bottom))] shadow-2xl md:hidden">
            {meBox(false)}
            <div className="grid grid-cols-3 gap-2">
              {moreItems.map((x) => (
                <Link key={x.href} href={x.href} className={"relative grid justify-items-center gap-1.5 rounded-2xl border px-1.5 py-3.5 text-[13px] font-medium " +
                  (isOn(x.href) ? "border-[var(--crm-ink)] bg-[var(--crm-ink)] text-white" : "border-[var(--crm-line)]")}>
                  <Icon k={x.k} />
                  <span>{x.label}</span>
                  {!!x.badge && <i className="num absolute top-1.5 end-2 rounded-full bg-[var(--crm-danger)] px-1.5 text-[10.5px] not-italic font-bold leading-4 text-white">{x.badge}</i>}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      <ClientDrawer />
      <Assistant />
      <ModalHost />
      {toastMsg && <div className="crm-toast" role="status">{toastMsg}</div>}
    </div>
  );
}

/** Small loading gate so screens don't flash empty states before the first snapshot. */
export function useCrmReady() {
  const { loaded } = useCrm();
  return useMemo(() => loaded, [loaded]);
}
