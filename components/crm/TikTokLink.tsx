"use client";

/**
 * «ربط إعلانات تيك توك» (owner only, Settings → أدوات; client 2026-11-12): TikTok Instant Form leads land in the CRM
 * at once, as a client + request for the next employee in turn. The owner creates a developer app on
 * business-api.tiktok.com (Lead Management → Leads Retrieval, redirect URL shown here), pastes its App ID and Secret,
 * and authorizes the ad account (app/api/tiktok-oauth, lib/tiktok-server.ts).
 */
import { useCallback, useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { useCrm } from "@/lib/crm/store";

type Status = { configured: boolean; connected: boolean; advertisers: { id: string; linked: boolean; error: string | null }[]; lastError: string | null; redirect: string; webhook: string };

async function call<T>(method: "GET" | "POST", body?: object): Promise<T> {
  const token = await auth?.currentUser?.getIdToken();
  const res = await fetch("/api/tiktok-oauth", { method, headers: { Authorization: "Bearer " + token, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || String(res.status));
  return j as T;
}

export function TikTokLink() {
  const { toast } = useCrm();
  const [st, setSt] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);
  const [appId, setAppId] = useState("");
  const [sec, setSec] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(() => call<Status>("GET").then(setSt).catch(() => setSt(null)), []);
  useEffect(() => {
    load();
    const q = new URLSearchParams(window.location.search).get("tiktok");
    if (q) {
      toast(q === "ok" ? "تم ربط تيك توك" : q === "bad_state" ? "انتهت مهلة الربط — جرّب مرة ثانية" : "تعذّر ربط تيك توك — شوف السبب في البطاقة");
      setOpen(true);
    }
  }, [load, toast]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr("");
    try { await fn(); } catch (e) { setErr(String((e as Error).message || e)); } finally { setBusy(false); load(); }
  };
  const go = (url: string) => { window.location.href = url; };
  const linked = (st?.advertisers || []).filter((a) => a.linked).length;

  return (
    <div className="crm-card grid gap-2.5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm">
          <b>ربط إعلانات تيك توك</b> — عملاء نماذج تيك توك ينزلون في النظام فوراً ويتوزعون بالدور.{" "}
          {st?.connected ? <span className="text-[var(--crm-ok,#1b6b32)]">مربوط · {linked} حساب إعلاني</span> : <span className="text-[var(--crm-ink-3)]">غير مربوط</span>}
        </span>
        <button type="button" className="crm-btn sm" onClick={() => setOpen((o) => !o)}>{open ? "إخفاء" : st?.connected ? "التفاصيل" : "ابدأ الربط"}</button>
      </div>
      {open && (
        <div className="grid gap-2.5 text-[13.5px]">
          {!st?.connected && (
            <>
              <ol className="m-0 grid list-decimal gap-1 ps-5 text-[var(--crm-ink-2)]">
                <li>في <b>business-api.tiktok.com</b> سجّل كمطوّر وأنشئ تطبيق (My Apps ← Create).</li>
                <li>اختر صلاحية <b>Lead Management ← Leads Retrieval</b>، وفي <b>Advertiser redirect URL</b> حط: <span className="num select-all break-all rounded bg-[var(--crm-surface-2)] px-1" dir="ltr">{st?.redirect || "…"}</span></li>
                <li>بعد موافقة تيك توك على التطبيق، الصق <b>App ID</b> و<b>Secret</b> هنا واضغط «تسجيل الدخول في تيك توك».</li>
              </ol>
              <input value={appId} placeholder="App ID" dir="ltr" aria-label="App ID" autoComplete="off" onChange={(e) => setAppId(e.target.value)} />
              <input value={sec} placeholder="Secret" dir="ltr" type="password" aria-label="Secret" autoComplete="off" onChange={(e) => setSec(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="crm-btn primary" disabled={busy || !appId.trim() || !sec.trim()}
                  onClick={() => run(async () => { const r = await call<{ url: string }>("POST", { action: "config", appId, secret: sec }); setSec(""); go(r.url); })}>
                  تسجيل الدخول في تيك توك
                </button>
                {st?.configured && <button type="button" className="crm-btn" disabled={busy} onClick={() => run(async () => { go((await call<{ url: string }>("POST", { action: "connect" })).url); })}>إعادة تسجيل الدخول</button>}
              </div>
            </>
          )}
          {st?.connected && (
            <>
              {st.advertisers.length ? (
                <ul className="m-0 grid list-none gap-1 p-0">
                  {st.advertisers.map((a) => <li key={a.id}>{a.linked ? "✅" : "⚠"} حساب <span className="num" dir="ltr">{a.id}</span>{a.error ? <span className="text-[var(--crm-danger)]"> — {a.error}</span> : null}</li>)}
                </ul>
              ) : <p className="crm-hint m-0">ما فيه حسابات إعلانية مربوطة.</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" className="crm-btn" disabled={busy} onClick={() => run(async () => { const r = await call<{ advertisers: Status["advertisers"] }>("POST", { action: "sync" }); toast("حسابات مربوطة: " + r.advertisers.filter((a) => a.linked).length); })}>تحديث الحسابات</button>
                <button type="button" className="crm-btn ghost" disabled={busy} onClick={() => run(async () => { go((await call<{ url: string }>("POST", { action: "connect" })).url); })}>إعادة تسجيل الدخول</button>
              </div>
              <p className="crm-hint m-0">كل نماذج الحساب الإعلاني مربوطة، حتى الجديدة.</p>
            </>
          )}
          {(err || st?.lastError) && <p className="m-0 text-[12.5px] text-[var(--crm-danger)]" dir="auto">⚠ {err || st?.lastError}</p>}
        </div>
      )}
    </div>
  );
}
