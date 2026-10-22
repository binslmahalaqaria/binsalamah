"use client";

import { useCrm } from "@/lib/crm/store";
import { PRIO_TONE } from "@/lib/crm/constants";
import { clientById, nameOf, propById } from "@/lib/crm/logic";
import { markWaSent, toggleTask } from "@/lib/crm/actions";
import type { Task } from "@/lib/crm/types";
import { lateTxt, today, waLink } from "@/lib/crm/util";

/** Ready-made fourth-attempt message (after three unanswered calls). */
export const waFourthMsg = (name: string, staff: string) =>
  ["السلام عليكم " + (name || "") + "،",
    "معك " + staff + " من بن سلمه العقارية. حاولنا التواصل معك بخصوص طلبك العقاري ولم نتمكن من الوصول إليك.",
    "نرجو إفادتنا بالوقت المناسب للاتصال، أو الرد هنا بما تحتاجه وسنخدمك مباشرة."].join("\n");
import { Chip, Pill } from "./ui";

export function TaskRow({ t }: { t: Task }) {
  const { data, openModal, toast } = useCrm();
  const late = !!t.due && t.due < today() && !t.done;
  const c = clientById(data, t.clientId),
    p = propById(data, t.propertyId);
  return (
    <div className={"flex items-start gap-2.5 border-b border-[var(--crm-line)] px-3.5 py-2.5 last:border-0 " + (late ? "shadow-[inset_-3px_0_0_var(--crm-danger)]" : "")}>
      <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[var(--crm-gold)]" checked={t.done} aria-label="تم إنجاز المهمة"
        onChange={async (e) => {
          await toggleTask(data, t.id, e.target.checked);
          if (e.target.checked) toast("أحسنت، تم إنجاز المهمة");
        }} />
      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => openModal({ kind: "task", id: t.id })}>
        <div className={"font-medium " + (t.done ? "text-[var(--crm-ink-3)] line-through" : "")}>
          {t.title} {t.seen === false && t.assignee === data.uid && <Pill tone="hot">جديدة</Pill>}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {t.priority && t.priority !== "عادية" && <Pill tone={PRIO_TONE[t.priority]}>{t.priority}</Pill>}
          {t.due && <Chip cls={late ? "warn" : ""}>{t.done ? t.due : lateTxt(t.due)}</Chip>}
          {c && <Chip>العميل: {c.name}</Chip>}
          {p && <Chip>{p.title}</Chip>}
          {(data.isMgr || t.assignee !== data.uid) && <Chip>{t.assignee === data.uid ? "لي" : "لـ " + nameOf(data, t.assignee)}</Chip>}
          {t.createdBy && t.createdBy !== t.assignee && <Chip>من {nameOf(data, t.createdBy)}</Chip>}
        </div>
      </div>
      {t.kind === "wa4" && !t.done && c?.phone && (
        // Opens WhatsApp with the ready message and records the fourth attempt (48 h to reply, else «لا يوجد رد»).
        <a className="crm-btn sm wa shrink-0" href={waLink(c.phone, waFourthMsg(c.name, nameOf(data, data.uid))) || "#"} target="_blank" rel="noopener"
          onClick={() => { markWaSent(data, c.id).then(() => toast("سُجّلت رسالة الواتساب — إن لم يرد خلال 48 ساعة يُنقل إلى «لا يوجد رد»")); }}>📲 أرسل الرسالة</a>
      )}
    </div>
  );
}
