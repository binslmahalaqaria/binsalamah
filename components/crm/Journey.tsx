"use client";

/**
 * Offer and viewing rows (trial 2026-10-22), shared by «لوحتي», the offers/viewings lists and the client file.
 * Each row shows where things stand and the next action in one tap.
 */
import { useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { PROP_TONE, VIEW_TONE } from "@/lib/crm/constants";
import { clientById, nameOf, propById } from "@/lib/crm/logic";
import { confirmVisit, setProposalStatus } from "@/lib/crm/actions";
import type { Proposal, Viewing } from "@/lib/crm/types";
import { ageDays, fmtVisit, money, today } from "@/lib/crm/util";
import { ContactIcons, Kebab, Pill } from "./ui";

export function ProposalRow({ p, showClient = true }: { p: Proposal; showClient?: boolean }) {
  const { data, openClient, openModal, toast } = useCrm();
  const [busy, setBusy] = useState(false);
  const c = clientById(data, p.clientId), pr = propById(data, p.propertyId);
  const waiting = ["أُرسل", "بانتظار الرد"].includes(p.status);
  const set = async (st: string, fb?: string) => {
    setBusy(true);
    try {
      await setProposalStatus(data, p, st, fb);
      toast(st === "غير مناسب" ? "سُجّل العرض غير مناسب" : "حالة العرض: " + st);
    } finally { setBusy(false); }
  };
  return (
    <div className="crm-row grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0 cursor-pointer" onClick={() => c && openClient(c.id, p.requestId)}>
        <div className="flex flex-wrap items-center gap-1.5">
          {showClient && <b className="font-heading">{c?.name || "—"}</b>}
          <span className="text-[13.5px]">{pr?.title || "عقار محذوف"}{p.unit ? " — " + p.unit : ""}</span>
          <Pill tone={PROP_TONE[p.status]}>{p.status}</Pill>
        </div>
        <div className="text-xs text-[var(--crm-ink-3)]">
          أُرسل {ageDays(p.sentAt)}{p.price ? " · " + money(p.price) : ""}{p.feedback ? " · رأيه: " + p.feedback : ""}
          {data.isMgr && p.assignee ? " · " + nameOf(data, p.assignee) : ""}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {showClient && <ContactIcons phone={c?.phone} />}
        {waiting && <>
          <button type="button" className="crm-btn sm primary" disabled={busy} onClick={() => set("مهتم")}>مهتم</button>
          <button type="button" className="crm-btn sm danger" disabled={busy} onClick={() => { const fb = window.prompt("سبب عدم مناسبته (اختياري)") ?? undefined; if (fb !== undefined) set("غير مناسب", fb); }}>غير مناسب</button>
        </>}
        {["أُرسل", "بانتظار الرد", "مهتم"].includes(p.status) && (
          <button type="button" className="crm-btn sm" onClick={() => openModal({ kind: "visit", reqId: p.requestId, propertyId: p.propertyId })}>حدد زيارة</button>
        )}
        <Kebab items={[
          p.status === "أُرسل" ? { label: "شاهد العرض — بانتظار رده", onClick: () => set("بانتظار الرد") } : null,
          { label: "تسجيل رأي العميل", onClick: () => { const fb = window.prompt("رأي العميل في العرض", p.feedback || ""); if (fb != null) set(p.status, fb); } },
          p.status !== "غير مناسب" ? { label: "غير مناسب", onClick: () => set("غير مناسب") } : { label: "إعادة كمهتم", onClick: () => set("مهتم") },
        ]} />
      </div>
    </div>
  );
}

export function ViewingRow({ v, showClient = true }: { v: Viewing; showClient?: boolean }) {
  const { data, openClient, openModal, toast } = useCrm();
  const c = clientById(data, v.clientId), pr = propById(data, v.propertyId);
  const open = ["مجدولة", "مؤجلة"].includes(v.status);
  const past = open && v.at.slice(0, 10) < today();
  const confirmed = open && !!c?.visitConfirmed && c.visitAt === v.at;
  return (
    <div className={"crm-row grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto] " + (past ? "late" : "")}>
      <div className="min-w-0 cursor-pointer" onClick={() => c && openClient(c.id, v.requestId || undefined)}>
        <div className="flex flex-wrap items-center gap-1.5">
          {showClient && <b className="font-heading">{c?.name || "—"}</b>}
          <Pill tone={VIEW_TONE[v.status]}>{v.status}</Pill>
          {past ? <Pill tone="hot">تمت الزيارة — اتصل وسجّل انطباعه</Pill> : open && (confirmed ? <Pill tone="ok">مؤكدة</Pill> : <Pill tone="warm">بحاجة إلى تأكيد</Pill>)}
        </div>
        <div className="text-xs text-[var(--crm-ink-3)]">
          {fmtVisit(v.at)}{pr ? " · " + pr.title : ""}{v.feedback ? " · " + v.feedback : ""}{v.followUp ? " · المتابعة " + v.followUp : ""}
          {data.isMgr && v.assignee ? " · " + nameOf(data, v.assignee) : ""}
        </div>
      </div>
      {open && (
        <div className="flex flex-wrap items-center gap-1.5">
          {showClient && <ContactIcons phone={c?.phone} />}
          {!past && !confirmed && c && <button type="button" className="crm-btn sm" onClick={async () => { await confirmVisit(data, c.id); toast("تم تأكيد الموعد"); }}>تأكيد الموعد</button>}
          <button type="button" className="crm-btn sm primary" onClick={() => openModal({ kind: "viewResult", viewingId: v.id })}>{past ? "سجّل الانطباع" : "تمت الزيارة"}</button>
          {v.requestId && <button type="button" className="crm-btn sm" onClick={() => openModal({ kind: "visit", reqId: v.requestId!, viewingId: v.id })}>تأجيل / إلغاء</button>}
        </div>
      )}
    </div>
  );
}
