"use client";

/**
 * "للتواصل" — the re-contact list: clients (e.g. old WhatsApp contacts) the team
 * still has to call. Per client: interested → record their request (the request
 * form turns them into an active client and the request appears in الطلبات),
 * not interested / wrong number → archive ("غير مهتم"), no answer → stays on the
 * list with the attempt counted. Employees see their own; managers see everyone,
 * assign, and spread the unassigned ones round-robin.
 */
import { useState } from "react";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCrm } from "@/lib/crm/store";
import { TO_CONTACT, lbl } from "@/lib/crm/constants";
import { can, members, nameOf, visibleClients } from "@/lib/crm/logic";
import { applyUpdate, applyUpdate0, assignClient } from "@/lib/crm/actions";
import { assertWritable } from "@/lib/crm/preview";
import type { Client } from "@/lib/crm/types";
import { fmtStamp, nowStamp } from "@/lib/crm/util";
import { ContactIcons, Empty, PageHeader, Pill } from "@/components/crm/ui";
import { SendRequestButton, WaChatButton } from "@/components/crm/WaButtons";
import { ContactImport, exportContactList } from "@/components/crm/ContactImport";

const PAGE = 60;
const noAnswers = (c: Client) => (c.log || []).filter((e) => e.type === "ما رد").length;
export default function ContactPage() {
  const { data, loaded, openModal, openClient, toast } = useCrm();
  const [q, setQ] = useState("");
  const [who, setWho] = useState("");
  const [show, setShow] = useState<"all" | "fresh" | "noanswer">("all");
  const [limit, setLimit] = useState(PAGE);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  if (!loaded) return <Empty>جارٍ تحميل البيانات…</Empty>;

  const all = visibleClients(data).filter((c) => c.status === TO_CONTACT);
  const qq = q.trim();
  let list = all.filter((c) => {
    if (who === "none" ? c.assignee : who && c.assignee !== who) return false;
    if (show === "fresh" && noAnswers(c)) return false;
    if (show === "noanswer" && !noAnswers(c)) return false;
    return !qq || [c.name, c.phone, c.notes].some((x) => x && x.includes(qq));
  });
  // Not tried yet first, then the longest since the last attempt.
  list = list.sort((a, b) => noAnswers(a) - noAnswers(b) || (a.lastUpdateAt || a.createdAt || "").localeCompare(b.lastUpdateAt || b.createdAt || ""));
  const unassigned = all.filter((c) => !c.assignee);
  const perEmp = members(data).map((id) => ({ id, n: all.filter((c) => c.assignee === id).length })).filter((x) => x.n);

  async function act(c: Client, kind: "noanswer" | "no" | "wrong") {
    setBusy(c.id);
    try {
      if (kind === "noanswer") {
        await applyUpdate0(data, c.id, "ما رد", null, "محاولة تواصل " + (noAnswers(c) + 1), null);
        toast("سُجّلت محاولة — يبقى في القائمة");
      } else {
        await applyUpdate(data, c.id, "صرف النظر", null, kind === "wrong" ? "رقم خاطئ" : "غير مهتم — من قائمة التواصل", null);
        toast("نُقل إلى الأرشيف (غير مهتم)");
      }
    } catch {
      toast("تعذّر الحفظ");
    } finally {
      setBusy(null);
    }
  }

  /** Spread the unassigned clients over the round-robin order (or all employees), continuing after rr.last. */
  async function spread() {
    assertWritable();
    const order = (data.rr.order.length ? data.rr.order : members(data)).filter((id) => data.staff.some((s) => s.id === id && s.active));
    if (!order.length) return toast("لا يوجد موظفون للتوزيع");
    if (!unassigned.length) return toast("لا يوجد عملاء غير مسندين");
    setBusy("spread");
    try {
      let i = data.rr.last ? order.indexOf(data.rr.last) : -1;
      for (let k = 0; k < unassigned.length; k += 400) {
        const batch = writeBatch(db);
        for (const c of unassigned.slice(k, k + 400)) {
          i = (i + 1) % order.length;
          batch.update(doc(db, "clients", c.id), { assignee: order[i], assignedAt: nowStamp(), assignedBy: data.uid, unseen: order[i] !== data.uid, updatedAt: nowStamp() });
        }
        await batch.commit();
      }
      toast("وُزّع " + unassigned.length + " عميل على " + order.length + " موظف بالدور");
    } catch {
      toast("تعذّر التوزيع");
    } finally {
      setBusy(null);
    }
  }

  const row = (c: Client) => {
    const n = noAnswers(c);
    const off = busy === c.id;
    return (
      <article key={c.id} className="crm-card grid gap-2.5 p-3.5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <b className="cursor-pointer font-heading text-[15.5px]" onClick={() => openClient(c.id)}>{c.name}</b>
            {c.phone && <span className="num text-[13px] text-[var(--crm-ink-3)]" dir="ltr">{c.phone}</span>}
            {n > 0 ? <Pill tone="warm">لم يرد ×{n}</Pill> : <Pill tone="accent">لم يُتصل به</Pill>}
            {c.lastUpdateAt && <span className="text-xs text-[var(--crm-ink-3)]">آخر محاولة: {fmtStamp(c.lastUpdateAt)}</span>}
          </div>
          {c.notes && <p className="m-0 mt-1 line-clamp-2 text-[13px] text-[var(--crm-ink-2)]">{c.notes}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {data.isMgr && (
            <select className="crm-quiet !text-[13px]" aria-label="المسؤول" value={c.assignee || ""}
              onChange={async (e) => { const x = await assignClient(data, c.id, e.target.value || null); toast(x.name ? "أُسند إلى " + x.name : "أصبح غير مسند"); }}>
              <option value="">غير مسند</option>
              {members(data).map((id) => <option key={id} value={id}>{nameOf(data, id)}</option>)}
            </select>
          )}
          <ContactIcons phone={c.phone} />
          <WaChatButton phone={c.phone} />
          <SendRequestButton c={c} />
          <button type="button" className="crm-btn sm primary" disabled={off}
            onClick={() => openModal({ kind: "request", preset: { clientId: c.id, assignee: c.assignee || data.uid, source: c.source || null } })}>✅ مهتم — سجّل طلبه</button>
          <button type="button" className="crm-btn sm" disabled={off} onClick={() => act(c, "noanswer")}>📵 لم يرد</button>
          <button type="button" className="crm-btn sm" disabled={off} onClick={() => act(c, "no")}>❌ غير مهتم</button>
          <button type="button" className="crm-btn ghost sm" disabled={off} onClick={() => act(c, "wrong")} title="يُنقل إلى الأرشيف">رقم خاطئ</button>
        </div>
      </article>
    );
  };

  return (
    <>
      <PageHeader title="للتواصل" sub="عملاء يجب التواصل معهم: المهتم سجّل طلبه فينتقل إلى الطلبات، وغير المهتم يُنقل إلى الأرشيف"
        action={
          <div className="flex flex-wrap gap-2">
            {can(data, "export") && (
              <button type="button" className="crm-btn" onClick={() => (list.length
                ? exportContactList(list.map((c) => ({ name: c.name, phone: c.phone || "", assignee: nameOf(data, c.assignee), tries: noAnswers(c), last: fmtStamp(c.lastUpdateAt), notes: c.notes || "" }))).catch(() => toast("تعذّر التصدير"))
                : toast("لا توجد بيانات للتصدير"))}>⬇ تصدير Excel</button>
            )}
            {data.isMgr && <button type="button" className={"crm-btn" + (adding ? "" : " primary")} onClick={() => setAdding((v) => !v)}>+ إضافة عملاء</button>}
          </div>
        } />
      {adding && data.isMgr && <ContactImport onClose={() => setAdding(false)} />}

      <div className="mb-3 grid gap-2.5 sm:grid-cols-3">
        <div className="crm-card p-3.5"><div className="text-xs text-[var(--crm-ink-3)]">المتبقي</div><b className="num text-2xl">{all.length}</b></div>
        <div className="crm-card p-3.5"><div className="text-xs text-[var(--crm-ink-3)]">لم يُتصل بهم بعد</div><b className="num text-2xl">{all.filter((c) => !noAnswers(c)).length}</b></div>
        <div className="crm-card p-3.5"><div className="text-xs text-[var(--crm-ink-3)]">لم يردوا</div><b className="num text-2xl">{all.filter((c) => noAnswers(c)).length}</b></div>
      </div>

      {data.isMgr && all.length > 0 && (
        <div className="crm-card mb-3 flex flex-wrap items-center gap-2 p-3 text-[13px]">
          <span className="muted">التوزيع:</span>
          {perEmp.map((x) => (
            <button key={x.id} type="button" className={"crm-qchip" + (who === x.id ? " on" : "")} onClick={() => setWho(who === x.id ? "" : x.id)}>
              {nameOf(data, x.id)} <span className="num">{x.n}</span>
            </button>
          ))}
          {unassigned.length > 0 && (
            <>
              <button type="button" className={"crm-qchip" + (who === "none" ? " on" : "")} onClick={() => setWho(who === "none" ? "" : "none")}>
                غير مسند <span className="num">{unassigned.length}</span>
              </button>
              <button type="button" className="crm-btn sm primary" disabled={busy === "spread"} onClick={spread}>
                {busy === "spread" ? "جارٍ التوزيع…" : "توزيع غير المسندين بالدور"}
              </button>
            </>
          )}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="crm-input min-w-[200px] flex-1" placeholder="ابحث بالاسم أو الجوال أو الملاحظات" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} />
        {([["all", "الكل"], ["fresh", "لم يُتصل بهم"], ["noanswer", "لم يردوا"]] as const).map(([k, l]) => (
          <button key={k} type="button" className={"crm-qchip" + (show === k ? " on" : "")} onClick={() => { setShow(k); setLimit(PAGE); }}>{l}</button>
        ))}
      </div>

      {list.length ? (
        <div className="grid gap-2.5">
          {list.slice(0, limit).map(row)}
          {list.length > limit && <button type="button" className="crm-btn justify-self-center" onClick={() => setLimit((l) => l + PAGE)}>عرض المزيد ({list.length - limit})</button>}
        </div>
      ) : (
        <Empty>{all.length ? "لا توجد نتائج." : "لا يوجد عملاء للتواصل حالياً. " + (data.isMgr ? "عند استيراد العملاء القدامى يظهرون هنا ليتواصل معهم الفريق." : "")}</Empty>
      )}
      <p className="crm-hint mt-3">«{lbl(TO_CONTACT)}» لا يظهرون في قائمة العملاء ولا في مكالمات اليوم حتى يُسجَّل طلبهم. غير المهتمين تجدهم في العملاء ← الأرشيف.</p>
    </>
  );
}
