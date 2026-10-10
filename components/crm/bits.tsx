"use client";

/** Request/client display pieces reused across Today, Requests, Clients, and the client drawer. */
import { REQ, REQ_TONE, SOLD_ST, TEMP_TONE, UPD_TONE } from "@/lib/crm/constants";
import {
  clientById, demandOf, journey, match, nameOf, needsSaleInfo, OPEN_REQ, propById, reqsOf, typesOf, type CrmData,
} from "@/lib/crm/logic";
import type { Client, Demand, Request } from "@/lib/crm/types";
import { ageDays, fmtVisit, lateTxt, money, splitList, today, waLink } from "@/lib/crm/util";
import { useCrm, type Modal } from "@/lib/crm/store";
import { setReqStage } from "@/lib/crm/actions";
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
      {c.visitAt && <Chip cls="visit">زيارة {fmtVisit(c.visitAt)}{c.visitConfirmed ? " ✓" : ""}</Chip>}
      {data.isMgr && <Chip cls={c.assignee ? "" : "warn"}>{c.assignee ? "المسؤول: " + nameOf(data, c.assignee) : "غير مسند"}</Chip>}
    </div>
  );
}

export const TempPill = ({ t }: { t: string | null | undefined }) => <Pill tone={TEMP_TONE[t || ""] || "muted"}>{t}</Pill>;
export const UpdPill = ({ c }: { c: Client }) => (c.lastUpdate ? <Pill tone={UPD_TONE[c.lastUpdate] || "muted"}>{c.lastUpdate}</Pill> : null);
export const StagePill = ({ s }: { s: string | null | undefined }) => <Pill tone={REQ_TONE[s || "جديد"]}>{s || "جديد"}</Pill>;

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
    main = (
      <span className={cls("ok")}>
        {r.status === "تم البيع" ? "تم البيع" : "عربون"}
        {p ? ": " + p.title + (r.unit ? " · " + r.unit : "") : ""}
        {r.price ? <> · <b className="text-[var(--crm-gold-ink)]">{money(r.price)}</b></> : null}
      </span>
    );
  } else if (r.status === "ملغي") main = <span className={cls("muted")}>ملغي</span>;
  else if (j.visit?.past) main = <span className={cls("warn")}>الزيارة فاتت ({fmtVisit(j.visit.at)}) — سجّل النتيجة</span>;
  else if (j.visit) main = <span className={cls(j.visit.ok ? "ok" : "warn")}>زيارة {fmtVisit(j.visit.at)}{j.visit.ok ? " ✓ مؤكدة" : " · تحتاج تأكيد"}</span>;
  else if (j.visited) main = <span className={cls("ok")}>زار العقار {ageDays(j.visited.at)}</span>;
  else if (j.sent) main = <span>{j.sent.type === "تم إرسال التفاصيل" ? "انرسلت التفاصيل" : "انرسل الموقع"} {ageDays(j.sent.at)} ← حدد زيارة</span>;
  else main = <span className={cls("muted")}>ما انرسل له شي للحين</span>;
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
          ? (j.sent.type === "تم إرسال التفاصيل" ? "انرسلت التفاصيل" : "انرسل الموقع") + (j.sent.prop ? ": " + j.sent.prop.title : "") + " · " + ageDays(j.sent.at)
          : "ما انرسل له شي للحين"}
      </Row>
      {j.visit ? (
        <Row tone={j.visit.past ? "warn" : j.visit.ok ? "ok" : "warn"}>
          موعد {fmtVisit(j.visit.at)}{j.visit.prop ? " · " + j.visit.prop.title : ""}{" "}
          {j.visit.past ? <Pill tone="hot">فات</Pill> : j.visit.ok ? <Pill tone="ok">مؤكد</Pill> : <Pill tone="warm">يحتاج تأكيد</Pill>}
        </Row>
      ) : j.visited ? (
        <Row tone="ok">زار العقار · {ageDays(j.visited.at)}</Row>
      ) : (
        <Row tone="no">ما تحدد موعد زيارة</Row>
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
          <span key={x} title={x} className={"h-[5px] flex-1 rounded-full " + (k < i ? "bg-[var(--crm-ink-3)]" : k === i ? "bg-[var(--crm-gold)]" : "bg-[var(--crm-line)]")} />
        ))}
      </div>
      <div className="text-[12.5px]"><b>{st || "جديد"}</b><span className="text-[var(--crm-ink-3)]"> · {i + 1} من {line.length}</span></div>
    </div>
  );
}

/** Kebab menu items for a request (shared by the list, board cards, and drawer). */
export function reqMenu(data: CrmData, r: Request, open: (m: Modal) => void): KebabItem[] {
  const c = clientById(data, r.clientId);
  const sold = SOLD_ST.includes(r.status);
  const items: (KebabItem | false)[] = [
    { label: "أرسلت الموقع", onClick: () => open({ kind: "update", clientId: r.clientId, type: "تم إرسال الموقع", propertyId: data.props.find((p) => match(r, p))?.id }) },
    { label: c?.visitAt ? "تعديل موعد الزيارة" : "حدد موعد زيارة", onClick: () => open({ kind: "visit", reqId: r.id }) },
    !!c && { label: "سجّل تحديث", onClick: () => open({ kind: "update", clientId: c.id }) },
    !sold && { label: "سجّل عربون", onClick: () => open({ kind: "close", reqId: r.id, to: "عربون" }) },
    r.status !== "تم البيع" && { label: "تم البيع", onClick: () => open({ kind: "close", reqId: r.id, to: "تم البيع" }) },
    sold && { label: "تعديل بيانات " + (r.status === "تم البيع" ? "البيع" : "العربون"), onClick: () => open({ kind: "close", reqId: r.id, to: r.status }) },
    sold && { label: "إلغاء " + (r.status === "تم البيع" ? "البيع" : "العربون"), onClick: () => open({ kind: "cancel", reqId: r.id }) },
    !!c?.phone && { label: "واتساب", href: waLink(c.phone) || undefined },
    { label: "تعديل الطلب", onClick: () => open({ kind: "request", id: r.id }) },
  ];
  return items.filter(Boolean) as KebabItem[];
}

/** Stage change from a select/arrow: deposit/sale needs the sale form; leaving a sale needs the cancel form. */
export function changeStage(d: CrmData, r: Request, to: string, open: (m: Modal) => void, toast: (s: string) => void) {
  const from = r.status || "جديد";
  if (from === to) return;
  if (SOLD_ST.includes(to) && needsSaleInfo({ ...r, status: to })) return open({ kind: "close", reqId: r.id, to });
  if (SOLD_ST.includes(from) && !SOLD_ST.includes(to)) return open({ kind: "cancel", reqId: r.id, to });
  setReqStage(r.id, to).then(() => toast("انتقل الطلب إلى: " + to));
}

