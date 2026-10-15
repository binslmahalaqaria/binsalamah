"use client";

/**
 * Banner for whoever manages a WhatsApp number (its owner, or a manager) when
 * that number is unlinked or has been unable to connect for a few minutes.
 * Checks the WhatsApp server once a minute; silent when the server is down.
 */
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useCrm } from "@/lib/crm/store";
import { can } from "@/lib/crm/logic";
import { waApi, type WaSource } from "@/lib/crm/wa";

export function WaAlert() {
  const { data, loaded } = useCrm();
  const [bad, setBad] = useState<WaSource[]>([]);
  const allowed = loaded && can(data, "whatsapp");

  useEffect(() => {
    if (!allowed) return;
    const check = () =>
      waApi<{ sources: WaSource[] }>("/api/sources")
        .then((r) => setBad(r.sources.filter((s) => s.canManage && (
          ["loggedOut", "error"].includes(s.status) ||
          (["qr", "reconnecting"].includes(s.status) && s.since != null && Date.now() - s.since > 2 * 60_000)
        ))))
        .catch(() => setBad([]));
    const first = setTimeout(check, 3000);
    const t = setInterval(check, 60_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [allowed]);

  if (!bad.length) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-[var(--crm-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--crm-danger)]">
      <span className="flex-1">انقطع ربط واتساب: <b>{bad.map((s) => s.label).join("، ")}</b> — لن تصل الرسائل الجديدة إلى النظام حتى تعيد الربط.</span>
      <Link href="/admin/whatsapp" className="crm-btn sm">إعادة الربط</Link>
    </div>
  );
}
