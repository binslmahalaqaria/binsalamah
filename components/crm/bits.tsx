"use client";

import { Link } from "@/i18n/navigation";

/** Request/client display pieces reused across Today, Requests, Clients, and the client drawer. */
import { REQ, REQ_TONE, SOLD_ST, TEMP_TONE, UPD_TONE, lbl } from "@/lib/crm/constants";
import {
  can, clientById, comm, demandOf, journey, match, nameOf, needsSaleInfo, OPEN_REQ, propById, reqsOf, typesOf, type CrmData,
} from "@/lib/crm/logic";
import type { Client, Demand, Request } from "@/lib/crm/types";
import { ageDays, fmtVisit, lateTxt, localDay, money, moneyFull, num, splitList, today, waLink } from "@/lib/crm/util";
import { useCrm, type Modal } from "@/lib/crm/store";
import { deleteRequest, setReqStage } from "@/lib/crm/actions";
import { Chip, Pill, type KebabItem } from "./ui";

export function DemandChips({ r }: { r: Demand }) {
  const ts = typesOf(r);
  return (
    <>
      <Chip>{(r.purpose || "شراء") + (ts.length ? " · " + ts.join(" / ") : "")}</Chip>
      {!!r.budget && <Chip>{money(r.budget)}</Chip>}
      {r.districts && <Chip>{r.districts}</Chip>}
      {r.payment && <Chip>{r.payment + (r.bank ? " · " + r.bank : "")}</Chip>}
      {!!r.areaMin && <Chip><span className="num">{r.areaMin}</span> م²+</Chip>}
      {!!r.bedroomsMin && <Chip>{r.bedroomsMin} غرف+</Chip>}
      {Array.isArray(r.floors) && r.floors.length > 0 && <Chip>الدور: {r.floors.join(" / ")}</Chip>}
    </>
  );
}

/** Chips summarizing a client: their demand, visit, and (for managers) assignee. */
export function ClientChips({ c }: { c: Client }) {
  const { data } = useCrm();
  const d = demandOf(data, c);
  const nreq = reqsOf(data, c).length;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {nreq > 1 && <Chip>{nreq} طلبات</Chip>}
      <DemandChips r={d} />
      {c.visitAt && <Chip cls="visit">معاينة {fmtVisit(c.visitAt)}{c.visitConfirmed ? " ✓" : ""}</Chip>}
      {data.isMgr && <Chip cls={c.assignee ? "" : "warn"}>{c.assignee ? "المسؤول: " + nameOf(data, c.assignee) : "غير مسند"}</Chip>}
    </div>
  );
}

export const TempPill = ({ t }: { t: string | null | undefined }) => <Pill tone={TEMP_TONE[t || ""] || "muted"}>{t || "لم يُحدد"}</Pill>;
export const UpdPill = ({ c }: { c: Client }) => (c.lastUpdate ? <Pill tone={UPD_TONE[c.lastUpdate] || "muted"}>{lbl(c.lastUpdate)}</Pill> : null);
export const StagePill = ({ s }: { s: string | null | undefined }) => <Pill tone={REQ_TONE[s || "جديد"]}>{lbl(s || "جديد")}</Pill>;

export function NeedLine({ r }: { r: Demand }) {
  const ts = typesOf(r);
  const b = [splitList(r.districts).slice(0, 3).join("، "), r.budget ? money(r.budget) : "", r.payment || ""].filter(Boolean);
  return (
    <div className="grid min-w-0 text-[13px]">
      <b className="font-semibold">{(r.purpose || "شراء") + (ts.length ? " · " + ts.join(" / ") : "")}</b>
      {b.length > 0 && <span className="truncate text-[var(--crm-ink-2)]">{b.join(" · ")}</span>}
    </div>
  );
}

/** The deal behind a deposit/sale, spelled out: property, deposit amount and date, sale value, commission, and what's missing. */
export function DealBox({ r }: { r: Request }) {
  const { data, openModal } = useCrm();
  if (!SOLD_ST.includes(r.status)) return null;
  const sold = r.status === "تم البيع";
  const p = propById(data, r.propertyId);
  const dep = num(r.deposit);
  const rows: [string, React.ReactNode][] = [
    ["العقار", p ? p.title + (r.unit ? " — " + r.unit : "") : <span className="text-[var(--crm-danger)]">لم يُحدَّد</span>],
    ["مبلغ العربون", dep ? <b className="num">{moneyFull(dep)}</b> : <span className="muted">غير مسجّل</span>],
    ["تاريخ العربون", r.depositAt ? <span className="num">{localDay(r.depositAt)} <span className="muted">· {ageDays(r.depositAt)}</span></span> : "—"],
    ["قيمة البيع", r.price ? <span className="num">{moneyFull(r.price)}</span> : <span className="text-[var(--crm-danger)]">غير مسجّلة</span>],
    ["السعي", r.price ? <b className="num text-[var(--crm-gold-ink)]">{moneyFull(comm(r))} <span className="muted text-xs font-normal">({r.commissionPct ?? 2.5}%)</span></b> : "—"],
  ];
  if (sold) rows.push(["تاريخ الإفراغ", r.closedAt ? <span className="num">{localDay(r.closedAt)}</span> : "—"]);
  return (
    <div className={"grid gap-2 rounded-xl border-s-4 p-3 " + (sold ? "border-[var(--crm-ok)] bg-[var(--crm-ok-soft)]" : "border-[var(--crm-gold)] bg-[var(--crm-gold-soft)]")}>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={sold ? "ok" : "gold"}>{sold ? "تم البيع" : "عربون"}</Pill>
        {!sold && dep ? <b className="num font-heading text-[17px]">{moneyFull(dep)}</b> : null}
        <span className="ms-auto muted text-xs">
          المسؤول: {nameOf(data, r.assignee)}
          {(() => { const by = sold ? r.closedBy || r.depositBy : r.depositBy; return by && by !== r.assignee ? " · سجّله " + nameOf(data, by) : null; })()}
        </span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[var(--crm-ink-3)]">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {can(data, "recordDeals") && <div className="flex flex-wrap gap-1.5">
        <button type="button" className={"crm-btn sm " + (needsSaleInfo(r) || (!sold && !dep) ? "primary" : "")}
          onClick={() => openModal({ kind: "close", reqId: r.id, to: r.status })}>
          {needsSaleInfo(r) || (!sold && !dep) ? "أكمل البيانات" : "تعديل " + (sold ? "البيع" : "العربون")}
        </button>
        {!sold && <button type="button" className="crm-btn sm" onClick={() => openModal({ kind: "close", reqId: r.id, to: "تم البيع" })}>تم البيع</button>}
        <button type="button" className="crm-btn ghost sm" onClick={() => openModal({ kind: "cancel", reqId: r.id })}>إلغاء {sold ? "البيع" : "العربون"}</button>
      </div>}
      <div className="flex flex-wrap gap-1.5">
        {!!dep && <Link href={"/admin/receipt/" + r.id} className="crm-btn sm">🧾 سند قبض العربون{r.receiptNo ? " · " + r.receiptNo : ""}</Link>}
        {sold && r.price ? <Link href={"/admin/invoices/new?req=" + r.id} className="crm-btn sm">🧾 فاتورة السعي</Link> : null}
      </div>
    </div>
  );
}

/** "What's the next step" for a request, derived from its journey. */
export function NextStep({ r }: { r: Request }) {
  const { data } = useCrm();
  const j = journey(data, r);
  const c = j.c;
  let main: React.ReactNode;
  const cls = (k: "ok" | "warn" | "muted" | "") =>
    k === "ok" ? "text-[var(--crm-ok)]" : k === "warn" ? "text-[var(--crm-gold-ink)]" : k === "muted" ? "text-[var(--crm-ink-3)]" : "";
  if (SOLD_ST.includes(r.status)) {
    const p = propById(data, r.propertyId);
    const sold = r.status === "تم البيع";
    main = (
      <span className="grid gap-0.5">
        <span className={cls("ok")}>
          <b>{sold ? "تم البيع" : "عربون"}</b>
          {!sold && num(r.deposit) ? <> <b className="num">{moneyFull(num(r.deposit))}</b></> : null}
          {p ? " · " + p.title + (r.unit ? " · " + r.unit : "") : ""}
          {r.price ? <> · <span className="text-[var(--crm-gold-ink)]">{money(r.price)}</span></> : null}
        </span>
        <span className="text-xs text-[var(--crm-ink-3)]">
          {sold ? (r.closedAt ? "الإفراغ " + localDay(r.closedAt) : "") : r.depositAt ? "العربون " + localDay(r.depositAt) + " · " + ageDays(r.depositAt) : ""}
          {needsSaleInfo(r) || (!sold && !num(r.deposit)) ? <span className="font-semibold text-[var(--crm-danger)]"> · البيانات ناقصة</span> : null}
        </span>
      </span>
    );
  } else if (r.status === "ملغي") main = <span className={cls("muted")}>ملغي</span>;
  else if (j.visit?.past) main = <span className={cls("warn")}>المعاينة فاتت ({fmtVisit(j.visit.at)}) — سجّل النتيجة</span>;
  else if (j.visit) main = <span className={cls(j.visit.ok ? "ok" : "warn")}>معاينة {fmtVisit(j.visit.at)}{j.visit.ok ? " ✓ مؤكدة" : " · بحاجة إلى تأكيد"}</span>;
  else if (j.visited) main = <span className={cls("ok")}>زار العقار {ageDays(j.visited.at)}</span>;
  else if (j.sent) main = <span>{j.sent.type === "تم إرسال التفاصيل" ? "أُرسلت التفاصيل" : "أُرسل الموقع"} {ageDays(j.sent.at)} ← يُرجى تحديد موعد معاينة</span>;
  else main = <span className={cls("muted")}>لم يُرسل إليه أي عرض بعد</span>;
  if (r.awaitingUpdate && OPEN_REQ(r)) main = <span className="font-semibold text-[var(--crm-danger)]">بانتظار تحديث الموظف — سجّل نتيجة التواصل</span>;
  const late = c?.nextCall && c.nextCall < today();
  return (
    <div className="grid min-w-0 gap-0.5 text-[13px]">
      {main}
      {OPEN_REQ(r) && c?.nextCall && (
        <span className={"text-xs " + (late ? "font-semibold text-[var(--crm-danger)]" : "text-[var(--crm-ink-3)]")}>الاتصال: {lateTxt(c.nextCall)}</span>
      )}
    </div>
  );
}

function Row({ tone, children }: { tone: "ok" | "no" | "warn" | "info"; children: React.ReactNode }) {
  return (
    <div className={"flex items-baseline gap-1.5 " + (tone === "no" ? "text-[var(--crm-ink-3)]" : "text-[var(--crm-ink)]")}>
      <span className={"h-2 w-2 shrink-0 -translate-y-px rounded-full " +
        (tone === "ok" ? "bg-[var(--crm-ok)]" : tone === "warn" ? "bg-[var(--crm-warn)]" : tone === "info" ? "bg-[var(--crm-cold)]" : "bg-[var(--crm-line)]")} />
      <span>{children}</span>
    </div>
  );
}

/** Dot timeline: sent → visit → next call. */
export function JourneyBox({ r }: { r: Request }) {
  const { data } = useCrm();
  const j = journey(data, r);
  return (
    <div className="grid gap-1 rounded-lg bg-[var(--crm-surface-2)] px-2.5 py-2 text-[12.5px]">
      <Row tone={j.sent ? "ok" : "no"}>
        {j.sent
          ? (j.sent.type === "تم إرسال التفاصيل" ? "أُرسلت التفاصيل" : "أُرسل الموقع") + (j.sent.prop ? ": " + j.sent.prop.title : "") + " · " + ageDays(j.sent.at)
          : "لم يُرسل إليه أي عرض بعد"}
      </Row>
      {j.visit ? (
        <Row tone={j.visit.past ? "warn" : j.visit.ok ? "ok" : "warn"}>
          موعد {fmtVisit(j.visit.at)}{j.visit.prop ? " · " + j.visit.prop.title : ""}{" "}
          {j.visit.past ? <Pill tone="hot">انقضى</Pill> : j.visit.ok ? <Pill tone="ok">مؤكد</Pill> : <Pill tone="warm">بحاجة إلى تأكيد</Pill>}
        </Row>
      ) : j.visited ? (
        <Row tone="ok">زار العقار · {ageDays(j.visited.at)}</Row>
      ) : (
        <Row tone="no">لم يُحدَّد موعد معاينة</Row>
      )}
      {j.c?.nextCall && <Row tone="info">الاتصال القادم: {lateTxt(j.c.nextCall)}</Row>}
    </div>
  );
}

export function Stepper({ st }: { st: string }) {
  const line = REQ.filter((x) => x !== "ملغي");
  const i = line.indexOf((st || "جديد") as never);
  if (st === "ملغي") return <Pill tone="muted">ملغي</Pill>;
  return (
    <div className="grid gap-1">
      <div className="flex gap-[3px]" aria-label={"المرحلة " + st}>
        {line.map((x, k) => (
          <span key={x} title={lbl(x)} className={"h-[5px] flex-1 rounded-full " + (k < i ? "bg-[var(--crm-ink-3)]" : k === i ? "bg-[var(--crm-gold)]" : "bg-[var(--crm-line)]")} />
        ))}
      </div>
      <div className="text-[12.5px]"><b>{lbl(st || "جديد")}</b><span className="text-[var(--crm-ink-3)]"> · {i + 1} من {line.length}</span></div>
    </div>
  );
}

/** Kebab menu items for a request (shared by the list, board cards, and drawer). */
export function reqMenu(data: CrmData, r: Request, open: (m: Modal) => void): KebabItem[] {
  const c = clientById(data, r.clientId);
  const sold = SOLD_ST.includes(r.status);
  const deals = can(data, "recordDeals");
  const items: (KebabItem | false)[] = [
    { label: "تم إرسال الموقع", onClick: () => open({ kind: "update", clientId: r.clientId, reqId: r.id, type: "تم إرسال الموقع", propertyId: data.props.find((p) => match(r, p))?.id }) },
    !!c && { label: "تسجيل تحديث", onClick: () => open({ kind: "update", clientId: c.id, reqId: r.id }) },
    deals && !sold && { label: "تسجيل عربون", onClick: () => open({ kind: "close", reqId: r.id, to: "عربون" }) },
    deals && r.status !== "تم البيع" && { label: "تم البيع", onClick: () => open({ kind: "close", reqId: r.id, to: "تم البيع" }) },
    deals && sold && { label: "تعديل بيانات " + (r.status === "تم البيع" ? "البيع" : "العربون"), onClick: () => open({ kind: "close", reqId: r.id, to: r.status }) },
    deals && sold && { label: "إلغاء " + (r.status === "تم البيع" ? "البيع" : "العربون"), onClick: () => open({ kind: "cancel", reqId: r.id }) },
    data.isMgr && { label: "⇄ تحويل الطلب لموظف آخر", onClick: () => open({ kind: "transfer", reqId: r.id }) },
    !!c?.phone && { label: "واتساب", href: waLink(c.phone) || undefined },
    { label: "تعديل الطلب", onClick: () => open({ kind: "request", id: r.id }) },
    { label: "🗑 حذف الطلب", onClick: () => { deleteRequest(data, r); } },
  ];
  return items.filter(Boolean) as KebabItem[];
}

/** Stage change from a select/arrow: deposit/sale needs the sale form; leaving a sale needs the cancel form. */
export function changeStage(d: CrmData, r: Request, to: string, open: (m: Modal) => void, toast: (s: string) => void) {
  const from = r.status || "جديد";
  if (from === to) return;
  if ((SOLD_ST.includes(to) || SOLD_ST.includes(from)) && !can(d, "recordDeals")) return toast("لا تملك صلاحية تسجيل العربون أو البيع");
  // Every move into a deposit or sale goes through its form (amount, unit, sale date, reservation).
  if (SOLD_ST.includes(to)) return open({ kind: "close", reqId: r.id, to });
  if (SOLD_ST.includes(from) && !SOLD_ST.includes(to)) return open({ kind: "cancel", reqId: r.id, to });
  setReqStage(r.id, to, d).then(() => toast("انتقل الطلب إلى: " + lbl(to)));
}

