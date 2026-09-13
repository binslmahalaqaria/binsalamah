"use client";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useEffect } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Link } from "@/i18n/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useTranslations } from "next-intl";

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, staff, loading, configError } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (loading || configError) return;
    if (!user && !isLoginPage) {
      router.replace("/admin/login");
    }
    if (user && staff && !staff.active && !isLoginPage) {
      signOut(auth);
    }
  }, [loading, configError, user, staff, isLoginPage, router]);

  if (configError) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center text-sm text-gray-500">
        Firebase isn&apos;t connected yet. Copy{" "}
        <code>.env.local.example</code> to <code>.env.local</code>, fill in
        your Firebase project&apos;s web app config, and restart the dev
        server. See <code>README.md</code>.
      </div>
    );
  }

  if (isLoginPage) return <>{children}</>;
  if (loading || !user) return null; // avoid flashing protected content

  return <>{children}</>;
}

function AdminChrome({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Admin");
  const { user } = useAuth();
  const pathname = usePathname();
  if (pathname === "/admin/login") return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-e px-4 py-6">
        <nav className="flex flex-col gap-3 text-sm">
          <Link href="/admin">{t("dashboard")}</Link>
          <Link href="/admin/offers">{t("offers")}</Link>
          <Link href="/admin/leads">{t("leads")}</Link>
          <Link href="/admin/staff">{t("staff")}</Link>
          <Link href="/admin/settings">{t("settings")}</Link>
          <LanguageSwitcher />
          {user && (
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="mt-6 text-start text-red-600"
            >
              {t("logout")}
            </button>
          )}
        </nav>
      </aside>
      <main className="flex-1 px-8 py-6">{children}</main>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AdminGuard>
        <AdminChrome>{children}</AdminChrome>
      </AdminGuard>
    </AuthProvider>
  );
}
