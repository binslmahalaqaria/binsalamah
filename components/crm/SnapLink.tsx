"use client";

/**
 * «ربط إعلانات سناب» (owner only, Settings → أدوات; client 2026-11-12): Snapchat lead-form leads land in the CRM
 * as soon as they are submitted, as a client + request for the next employee in turn (like website requests).
 * Steps: create an OAuth app in Snap Business Manager with the redirect URI shown here, paste its Client ID and
 * Client Secret, sign in to Snap, and every lead form gets a webhook (app/api/snap-oauth, lib/snap-server.ts).
 * The keys go straight to the server (secrets/snap) and are never shown again.
 */
import { useCallback, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { useCrm } from "@/lib/crm/store";

type Status = {
  configured: boolean; connected: boolean; signing: boolean; forms: { name: string; linked: boolean; error: string | null }[];
  connectedAt: number | null; syncedAt: number | null; lastError: string | null; redirect: string; webhook: string;
};

async function call<T>(method: "GET" | "POST", body?: object): Promise<T> {
  const token = await auth?.currentUser?.getIdToken();
  const res = await fetch("/api/snap-oauth", { method, headers: { Authorization: "Bearer " + token, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || String(res.status));
  return j as T;
}

export function SnapLink() {
  const { toast } = useCrm();
  const [st, setSt] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);
  const [cid, setCid] = useState("");
  const [sec, setSec] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(() => call<Status>("GET").then(setSt).catch(() => setSt(null)), []);
  useEffect(() => {
    load();
    // Back from Snap's sign-in: say how it went.
    const q = new URLSearchParams(window.location.search).get("snap");
    if (q) {
      const n = new URLSearchParams(window.location.search).get("forms");
      toast(q === "ok" ? "تم ربط سناب — نماذج مربوطة: " + (n || 0) : q === "bad_state" ? "انتهت مهلة الربط — جرّب مرة ثانية" : "تعذّر ربط سناب — شوف السبب في البطاقة");
      setOpen(true);
    }
  }, [load, toast]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr("");
    try { await fn(); } catch (e) { setErr(String((e as Error).message || e)); } finally { setBusy(false); load(); }
  };
  const go = (url: string) => { window.location.href = url; };
  const linked = (st?.forms || []).filter((f) => f.linked).length;

  return (
    <div className="crm-card grid gap-2.5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm">
          <b>ربط إعلانات سناب</b> — عملاء نماذج سناب ينزلون في النظام فوراً ويتوزعون بالدور.{" "}
          {st?.connected ? <span className="text-[var(--crm-ok,#1b6b32)]">مربوط · {linked} نموذج</span> : <span className="text-[var(--crm-ink-3)]">غير مربوط</span>}
        </span>
        <button type="button" className="crm-btn sm" onClick={() => setOpen((o) => !o)}>{open ? "إخفاء" : st?.connected ? "التفاصيل" : "ابدأ الربط"}</button>
      </div>
      {open && (
        <div className="grid gap-2.5 text-[13.5px]">
          {!st?.connected && (
            <>
              <ol className="m-0 grid list-decimal gap-1 ps-5 text-[var(--crm-ink-2)]">
                <li>ادخل <b>business.snapchat.com</b> ← Business Details ← <b>OAuth Apps</b> ← أنشئ تطبيق.</li>
                <li>في <b>Redirect URI</b> حط هذا الرابط بالضبط: <span className="num select-all break-all rounded bg-[var(--crm-surface-2)] px-1" dir="ltr">{st?.redirect || "…"}</span></li>
                <li>انسخ <b>Client ID</b> و<b>Client Secret</b> والصقهم هنا، واضغط «تسجيل الدخول في سناب».</li>
              </ol>
              <input value={cid} placeholder="Client ID" dir="ltr" aria-label="Client ID" autoComplete="off" onChange={(e) => setCid(e.target.value)} />
              <input value={sec} placeholder="Client Secret" dir="ltr" type="password" aria-label="Client Secret" autoComplete="off" onChange={(e) => setSec(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="crm-btn primary" disabled={busy || !cid.trim() || !sec.trim()}
                  onClick={() => run(async () => { const r = await call<{ url: string }>("POST", { action: "config", clientId: cid, clientSecret: sec }); setSec(""); go(r.url); })}>
                  تسجيل الدخول في سناب
                </button>
                {st?.configured && <button type="button" className="crm-btn" disabled={busy} onClick={() => run(async () => { go((await call<{ url: string }>("POST", { action: "connect" })).url); })}>إعادة تسجيل الدخول</button>}
              </div>
            </>
          )}
          {st?.connected && (
            <>
              {st.forms.length ? (
                <ul className="m-0 grid list-none gap-1 p-0">
                  {st.forms.map((f, i) => <li key={i}>{f.linked ? "✅" : "⚠"} {f.name}{f.error ? <span className="text-[var(--crm-danger)]"> — {f.error}</span> : null}</li>)}
                </ul>
              ) : <p className="crm-hint m-0">ما فيه نماذج عملاء في حساب سناب الإعلاني. أنشئ نموذج (Lead Form) ثم اضغط «تحديث النماذج».</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" className="crm-btn" disabled={busy} onClick={() => run(async () => { const r = await call<{ forms: Status["forms"] }>("POST", { action: "sync" }); toast("نماذج مربوطة: " + r.forms.filter((f) => f.linked).length); })}>تحديث النماذج</button>
                <button type="button" className="crm-btn" disabled={busy || !linked} onClick={() => run(async () => { const r = await call<{ ok: boolean; form: string }>("POST", { action: "test" }); toast(r.ok ? "سناب أرسل عميل تجريبي من «" + r.form + "» — يظهر في الطلبات خلال ثواني" : "تعذّر الإرسال التجريبي"); })}>إرسال عميل تجريبي</button>
                <button type="button" className="crm-btn ghost" disabled={busy} onClick={() => run(async () => { go((await call<{ url: string }>("POST", { action: "connect" })).url); })}>إعادة تسجيل الدخول</button>
              </div>
              <p className="crm-hint m-0">نموذج جديد في سناب؟ اضغط «تحديث النماذج» ويتربط.</p>
            </>
          )}
          {(err || st?.lastError) && <p className="m-0 text-[12.5px] text-[var(--crm-danger)]" dir="auto">⚠ {err || st?.lastError}</p>}
        </div>
      )}
    </div>
  );
}
