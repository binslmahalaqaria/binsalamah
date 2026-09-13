"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";

function Icon({ path, className }: { path: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "h-5 w-5"}
    >
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  dashboard: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z",
  offers: "M3 10.5 12 4l9 6.5M5 9.5V20h5v-6h4v6h5V9.5",
  leads: "M16 11a4 4 0 1 0-4-4M8 11a3 3 0 1 0 0-6M2 20c0-3 2.5-5.5 6-5.5S14 17 14 20M12 20c0-2.5 2-4.5 5-4.5S22 17.5 22 20",
  staff: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9c0-3.5 3-6 7-6s7 2.5 7 6",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a7.97 7.97 0 0 0-.2-1.8l2-1.6-2-3.4-2.4 1a8 8 0 0 0-3-1.7L14 2h-4l-.4 2.5a8 8 0 0 0-3 1.7l-2.4-1-2 3.4 2 1.6A8 8 0 0 0 4 12c0 .6.07 1.2.2 1.8l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 3 1.7L10 22h4l.4-2.5a8 8 0 0 0 3-1.7l2.4 1 2-3.4-2-1.6c.13-.6.2-1.2.2-1.8Z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
};

const NAV_ITEMS = [
  { href: "/admin", key: "dashboard", icon: ICONS.dashboard },
  { href: "/admin/offers", key: "offers", icon: ICONS.offers },
  { href: "/admin/leads", key: "leads", icon: ICONS.leads },
  { href: "/admin/staff", key: "staff", icon: ICONS.staff },
  { href: "/admin/settings", key: "settings", icon: ICONS.settings },
] as const;

export function AdminSidebar() {
  const t = useTranslations("Admin");
  const tRole = useTranslations("StaffRole");
  const locale = useLocale();
  const pathname = usePathname();
  const { user, staff } = useAuth();

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-navy px-4 py-6 text-cream">
      <div className="mb-8 px-2">
        <Logo variant="light" locale={locale} />
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-gold text-navy"
                  : "text-cream/70 hover:bg-white/5 hover:text-cream"
              }`}
            >
              <Icon path={item.icon} />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3 border-t border-cream/10 pt-4">
        {staff && (
          <div className="px-2">
            <div className="truncate text-sm font-medium text-cream">{staff.name}</div>
            <div className="text-xs text-cream/50">{tRole(staff.role)}</div>
          </div>
        )}
        <LanguageSwitcher variant="light" />
        {user && (
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-cream/70 transition-colors hover:bg-white/5 hover:text-red-300"
          >
            <Icon path={ICONS.logout} />
            {t("logout")}
          </button>
        )}
      </div>
    </aside>
  );
}
