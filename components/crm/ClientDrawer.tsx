"use client";

/** Client file: contact, next step, requests with their journey, open tasks, notes, and the full log. */
import { useEffect } from "react";
import { useCrm } from "@/lib/crm/store";
import { clientById, match, nameOf, OPEN_REQ, propById } from "@/lib/crm/logic";
import { confirmVisit, postpone, write } from "@/lib/crm/actions";
import { fmtStamp, fmtVisit, money, relDay, today } from "@/lib/crm/util";
import { Chip, ContactIcons, Empty, Icon, Kebab, Pill } from "./ui";
import { DemandChips, JourneyBox, Stepper, TempPill } from "./bits";
import { TaskRow } from "./TaskRow";

export function ClientDrawer() {
  const { data, drawer, closeClient, openModal, toast } = useCrm();
  const c = drawer ? clientById(data, drawer.id) : undefined;

  useEffect(() => {
    if (!drawer) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && closeClient();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [drawer, closeClient]);

  // Opening a newly assigned client clears its "new" badge.
  useEffect(() => {
    if (c && c.unseen && c.assignee === data.uid) write("clients", c.id, { unseen: false }, "update").catch(() => {});
  }, [c, data.uid]);

  if (!drawer || !c) return null;
  const reqs = data.requests
    .filter((r) => r.clientId === c.id)
    .sort((a, b) => Number(OPEN_REQ(b)) - Number(OPEN_REQ(a)) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const tasks = data.tasks.filter((t) => t.clientId === c.id && !t.done);
  const vp = propById(data, c.visitProperty);

  return (
    <>
      <div className="crm-drawer-bg" onClick={closeClient} />
      <aside className="crm-drawer" role="dialog" aria-modal="true" aria-label="ملف العميل" dir="rtl">
        <div className="flex items-start justify-between gap-2.5 border-b border-[var(--crm-line)] bg-white px-4.5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--crm-ink)] font-heading text-xl text-white">
              {(c.name || "؟").trim().slice(0, 1)}
            </div>
            <div className="min-w-0">
              <h2 className="mb-1 text-[19px]">{c.name}</h2>
              <div className="flex flex-wrap gap-1.5">
                <TempPill t={c.temp} />
                <Pill tone={(c.status || "نشط") === "نشط" ? "ok" : "muted"}>{c.status || "نشط"}</Pill>
                {c.source && <Chip>{c.source}</Chip>}
                {c.assignee ? <Chip>{nameOf(data, c.assignee)}</Chip> : <Chip cls="warn">غير مسند</Chip>}
              </div>
            </div>
          </div>
          <button type="button" className="crm-btn ghost icon" aria-label="إغلاق" onClick={closeClient}><Icon k="close" size={18} /></button>
        </div>

        <div className="grid flex-1 content-start gap-3.5 overflow-y-auto px-4.5 pt-3.5 pb-8">
          <div className="crm-card flex flex-wrap items-center gap-1.5 px-3 py-2.5">
            {c.phone ? (
              <>
                <span className="num me-1 text-[15px] font-semibold">{c.phone}</span>
                <ContactIcons phone={c.phone} />
                <button type="button" className="crm-btn sm" onClick={() => navigator.clipboard?.writeText(c.phone || "").then(() => toast("تم نسخ الرقم"))}>نسخ</button>
              </>
            ) : (
              <span className="muted">ما فيه جوال</span>
            )}
            <span className="flex-1" />
            <button type="button" className="crm-btn sm" onClick={() => openModal({ kind: "client", id: c.id })}>تعديل البيانات</button>
          </div>

          <section className="crm-card grid gap-2.5 p-3.5">
            <h3 className="text-[14.5px]">الخطوة الجاية</h3>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="grid gap-0.5 rounded-xl bg-[var(--crm-surface-2)] p-2.5">
                <span className="muted text-xs">الاتصال القادم</span>
                <b className={"text-sm " + (c.nextCall && c.nextCall < today() ? "text-[var(--crm-danger)]" : "")}>
                  {relDay(c.nextCall)} {c.nextCall && <small className="muted num">{c.nextCall}</small>}
                </b>
              </div>
              <div className="grid gap-0.5 rounded-xl bg-[var(--crm-surface-2)] p-2.5">
                <span className="muted text-xs">موعد الزيارة</span>
                <b className="text-sm">
                  {c.visitAt ? (
                    <>
                      {fmtVisit(c.visitAt)}{vp ? " · " + vp.title : ""}{" "}
                      {c.visitConfirmed ? <Pill tone="ok">مؤكد</Pill> : <Pill tone="warm">يحتاج تأكيد</Pill>}
                    </>
                  ) : "—"}
                </b>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="crm-btn primary" onClick={() => openModal({ kind: "update", clientId: c.id })}>تحديث</button>
              <button type="button" className="crm-btn" onClick={async () => { const n = await postpone(data, c.id); if (n) toast("تأجّل إلى " + n); }}>أجّل 3 أيام</button>
              {c.visitAt && !c.visitConfirmed && (
                <button type="button" className="crm-btn" onClick={async () => { await confirmVisit(data, c.id); toast("تم تأكيد الموعد"); }}>أكّد الزيارة</button>
              )}
              <button type="button" className="crm-btn" onClick={() => openModal({ kind: "task", preset: { clientId: c.id, assignee: c.assignee || data.uid } })}>+ مهمة</button>
            </div>
          </section>

          <section className="crm-card grid gap-2.5 p-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[14.5px]">طلبات العميل</h3>
              <button type="button" className="crm-btn sm" onClick={() => openModal({ kind: "request", preset: { clientId: c.id, assignee: c.assignee || data.uid } })}>+ طلب جديد</button>
            </div>
            {reqs.length ? (
              reqs.map((r) => {
                const mc = data.props.filter((p) => match(r, p)).length;
                const open = OPEN_REQ(r);
                return (
                  <div key={r.id} className={"grid gap-2 rounded-xl border p-3 " + (drawer.req === r.id ? "border-[var(--crm-gold)]" : "border-[var(--crm-line)]") + (open ? "" : " opacity-70")}>
                    <Stepper st={r.status} />
                    <div className="flex flex-wrap gap-1.5"><DemandChips r={r} /></div>
                    {r.requirements && <div className="muted text-[13px]">{r.requirements}</div>}
                    <JourneyBox r={r} />
                    {open ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button type="button" className={"crm-btn sm " + (mc ? "primary" : "")} onClick={() => openModal({ kind: "reqMatches", reqId: r.id })}>
                          {mc ? mc + " عقار مناسب" : "ما فيه مطابق"}
                        </button>
                        <button type="button" className="crm-btn sm" onClick={() => openModal({ kind: "update", clientId: c.id, type: "تم إرسال الموقع", propertyId: data.props.find((p) => match(r, p))?.id })}>أرسلت الموقع</button>
                        <button type="button" className="crm-btn sm" onClick={() => openModal({ kind: "visit", reqId: r.id })}>{c.visitAt ? "تعديل الموعد" : "حدد موعد"}</button>
                        <Kebab items={[
                          { label: "سجّل عربون", onClick: () => openModal({ kind: "close", reqId: r.id, to: "عربون" }) },
                          { label: "تم البيع", onClick: () => openModal({ kind: "close", reqId: r.id, to: "تم البيع" }) },
                          { label: "تعديل الطلب", onClick: () => openModal({ kind: "request", id: r.id }) },
                        ]} />
                      </div>
                    ) : r.price ? (
                      <div className="muted text-[13px]">
                        {propById(data, r.propertyId)?.title || ""}{r.unit ? " · " + r.unit : ""} · <b className="text-[var(--crm-gold-ink)]">{money(r.price)}</b>
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <Empty>
                ما سجّلت وش يبي العميل.{" "}
                <button type="button" className="crm-btn sm primary" onClick={() => openModal({ kind: "request", preset: { clientId: c.id, assignee: c.assignee || data.uid } })}>سجّل طلبه</button>
              </Empty>
            )}
          </section>

          {tasks.length > 0 && (
            <section className="crm-card grid gap-2 p-3.5">
              <h3 className="text-[14.5px]">مهام مفتوحة</h3>
              <div className="overflow-hidden rounded-xl border border-[var(--crm-line)]">{tasks.map((t) => <TaskRow key={t.id} t={t} />)}</div>
            </section>
          )}

          {c.notes && (
            <section className="crm-card grid gap-2 p-3.5">
              <h3 className="text-[14.5px]">ملاحظات</h3>
              <p className="m-0 whitespace-pre-wrap text-[var(--crm-ink-2)]">{c.notes}</p>
            </section>
          )}

          <section className="crm-card grid gap-2 p-3.5">
            <h3 className="text-[14.5px]">السجل</h3>
            {(c.log || []).length ? (
              <ol className="m-0 grid max-h-96 list-none overflow-y-auto p-0">
                {c.log.map((l, i) => (
                  <li key={i} className="grid gap-1 border-b border-dashed border-[var(--crm-line)] py-2 text-[13.5px] last:border-0 sm:grid-cols-[118px_1fr] sm:gap-2.5">
                    <span className="num muted text-xs">{fmtStamp(l.at)}</span>
                    <div>
                      <b>{l.type || "ملاحظة"}</b>{l.text ? " — " + l.text : ""}
                      {l.propertyId && propById(data, l.propertyId) && <span className="muted"> ({propById(data, l.propertyId)!.title})</span>}
                      {l.byId && <div className="muted text-xs">{nameOf(data, l.byId)}</div>}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="crm-hint">ما فيه سجل للحين.</p>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}
