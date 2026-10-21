"use client";

/**
 * "ملخص اليوم" on the Today screen. Managers looking at the whole team get one
 * line of team totals (folded; the per-employee table lives in لوحة المدير, so it
 * is not repeated here); everyone else (and a manager viewing one employee) sees
 * only that person's numbers. Today's deposits and sales are listed by name.
 */
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useCrm } from "@/lib/crm/store";
import { activityFor, clientById, isActive, members, nameOf, propById, type CrmData } from "@/lib/crm/logic";
import type { Request } from "@/lib/crm/types";
import { localDay, moneyFull, num, today } from "@/lib/crm/util";
import { Pill } from "./ui";

function dayFor(d: CrmData, id: string, t: string) {
  const act = activityFor(d, id, t, t);
  const cs = d.clients.filter((c) => c.assignee === id && isActive(c));
  return {
    ...act,
    late: cs.filter((c) => c.nextCall && c.nextCall < t).length,
    dueLeft: cs.filter((c) => c.nextCall && c.nextCall <= t).length,
    tasksDone: d.tasks.filter((x) => x.done && x.assignee === id && localDay(x.doneAt) === t).length,
  };
}

function Tile({ v, l, sub, tone }: { v: string | number; l: string; sub?: string; tone?: "gold" | "bad" }) {
  return (
    <div className="grid content-start gap-0.5 rounded-xl border border-[#efebe4] bg-[var(--crm-surface-2)] px-3 py-2.5">
      <span className="text-[12px] text-[var(--crm-ink-3)]">{l}</span>
      <b className={"num font-heading text-[22px] leading-tight " + (tone === "gold" ? "text-[var(--crm-gold-ink)]" : tone === "bad" ? "text-[var(--crm-danger)]" : "")}>{v}</b>
      {sub && <span className="num text-[11.5px] text-[var(--crm-ink-2)]">{sub}</span>}
    </div>
  );
}

export function DaySummary({ compact }: { compact?: boolean }) {
  const { data, openClient } = useCrm();
  const router = useRouter();
  const t = today();
  const team = data.isMgr && (!data.viewAs || data.viewAs === "none");
  const [open, setOpen] = useState(!team);
  const ids = team ? members(data) : [data.isMgr && data.viewAs ? data.viewAs : data.uid];
  const rows = ids.map((id) => ({ id, ...dayFor(data, id, t) }));
  const sum = (k: "calls" | "visits" | "sent" | "reqs" | "late" | "dueLeft" | "tasksDone" | "depositSum" | "commission") =>
    rows.reduce((s, r) => s + r[k], 0);
  const deals: Request[] = rows.flatMap((r) => [...r.deposits, ...r.sales.filter((x) => !r.deposits.includes(x))]);
  const depCount = rows.reduce((s, r) => s + r.deposits.filter((x) => x.status === "عربون").length, 0);
  const saleCount = rows.reduce((s, r) => s + r.sales.length, 0);
  const title = team ? "ملخص الفريق اليوم" : ids[0] === data.uid ? "ملخصك اليوم" : "ملخص " + nameOf(data, ids[0]) + " اليوم";

  return (
    <div className={"crm-card overflow-hidden" + (compact ? "" : " mb-4")}>
      <button type="button" className="flex w-full items-center gap-3 px-4 py-3.5 text-start" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <b className="font-heading text-[15px]">{title}</b>
        <span className="text-[13px] text-[var(--crm-ink-2)]">
          <span className="num">{sum("calls")}</span> مكالمة
          {team && <> · <span className="num">{sum("visits")}</span> زيارة · <span className="num">{sum("reqs")}</span> طلب جديد{sum("late") ? <> · <span className="font-semibold text-[var(--crm-danger)]"><span className="num">{sum("late")}</span> متأخر</span></> : null}</>}
          {depCount + saleCount > 0 && <> · <span className="font-semibold text-[var(--crm-gold-ink)]"><span className="num">{depCount}</span> عربون{saleCount ? <> · <span className="num">{saleCount}</span> بيع</> : null}</span></>}
        </span>
        <span className="ms-auto text-xs text-[var(--crm-ink-3)]">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="grid gap-3 border-t border-[#efebe4] px-4 pt-3 pb-4">
          <div className={"grid grid-cols-2 gap-2.5 " + (compact ? "" : "sm:grid-cols-3 lg:grid-cols-6")}>
            <Tile v={sum("calls")} l="مكالمات تمت" sub={sum("dueLeft") ? "المتبقي: " + sum("dueLeft") : "لا يوجد متبقٍ"} />
            <Tile v={sum("visits")} l="زيارات" />
            <Tile v={sum("sent")} l="عروض مُرسلة" />
            <Tile v={sum("reqs")} l="طلبات جديدة" />
            <Tile tone="gold" v={depCount + saleCount ? depCount + " / " + saleCount : "0"} l="عربون / بيع"
              sub={sum("depositSum") ? "عربون " + moneyFull(sum("depositSum")) : undefined} />
            <Tile tone={sum("late") ? "bad" : undefined} v={sum("late")} l="عملاء تأخر الاتصال بهم" />
          </div>

          {deals.length > 0 && (
            <div className="grid gap-1.5 rounded-xl border-s-4 border-[var(--crm-gold)] bg-[var(--crm-gold-soft)] px-3 py-2.5">
              <b className="text-[13.5px]">عربونات ومبيعات اليوم</b>
              {deals.map((r) => {
                const c = clientById(data, r.clientId), p = propById(data, r.propertyId);
                const sold = r.status === "تم البيع";
                return (
                  <div key={r.id} className="flex cursor-pointer flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md px-1 py-0.5 text-[13px] hover:bg-white/60" onClick={() => c && openClient(c.id, r.id)}>
                    <Pill tone={sold ? "ok" : "gold"}>{sold ? "تم البيع" : "عربون"}</Pill>
                    <b>{c?.name || "—"}</b>
                    {!sold && num(r.deposit) ? <b className="num">{moneyFull(num(r.deposit))}</b> : !sold ? <span className="text-[var(--crm-danger)]">المبلغ غير مسجّل</span> : null}
                    <span className="text-[var(--crm-ink-2)]">{p ? p.title + (r.unit ? " — " + r.unit : "") : ""}{r.price ? " · " + moneyFull(r.price) : ""}</span>
                    {team && <span className="muted ms-auto text-xs">{nameOf(data, r.assignee)}</span>}
                  </div>
                );
              })}
            </div>
          )}

          {team && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="muted text-xs">تفاصيل كل موظف في لوحة المدير.</span>
              <button type="button" className="crm-btn sm ms-auto" onClick={() => router.push("/admin/manager")}>لوحة المدير</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
