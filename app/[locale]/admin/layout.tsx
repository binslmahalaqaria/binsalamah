"use client";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

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
  const pathname = usePathname();
  if (pathname === "/admin/login") return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-navy/[0.03]">
      <AdminSidebar />
      <main className="flex-1 px-10 py-8">{children}</main>
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
