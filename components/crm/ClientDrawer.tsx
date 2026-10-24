"use client";

/** Client file: contact, next step, requests with their journey, open tasks, notes, and the full log. */
import { useEffect } from "react";
import { useCrm } from "@/lib/crm/store";
import { can, clientById, journey, match, nameOf, OPEN_REQ, propById } from "@/lib/crm/logic";
import { confirmVisit, deleteRequest, postpone, write } from "@/lib/crm/actions";
import { isPreview } from "@/lib/crm/preview";
import { fmtStamp, fmtVisit, money, nowStamp, relDay, today } from "@/lib/crm/util";
import { Chip, ContactIcons, Empty, Icon, Kebab, Pill } from "./ui";
import { SendRequestButton, WaChatButton } from "./WaButtons";
import { DealBox, DemandChips, JourneyBox, Stepper } from "./bits";
import { SOLD_ST, TEMPS, lbl } from "@/lib/crm/constants";
import { TaskRow } from "./TaskRow";
import { ProposalRow, ViewingRow } from "./Journey";

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
    // Background "seen" markers are skipped while previewing as an employee.
    if (c && c.unseen && c.assignee === data.uid && !isPreview()) write("clients", c.id, { unseen: false }, "update").catch(() => {});
  }, [c, data.uid]);

  if (!drawer || !c) return null;
  const reqs = data.requests
    .filter((r) => r.clientId === c.id)
    .sort((a, b) => Number(OPEN_REQ(b)) - Number(OPEN_REQ(a)) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const tasks = data.tasks.filter((t) => t.clientId === c.id && !t.done);
  // The visit shown is the one on the opened request (not a date left on the client from an earlier request).
  const curReq = reqs.find((r) => r.id === drawer.req) || reqs.find(OPEN_REQ);
  const vis = curReq ? journey(data, curReq).visit : null;
  const vp = vis?.prop;

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
                {/* Interest level: one tap to change (ساخن / دافئ / بارد). */}
                <select aria-label="درجة الاهتمام" className="crm-quiet !py-0 !text-[12.5px] font-semibold" value={c.temp || "دافئ"}
                  onChange={async (e) => { await write("clients", c.id, { temp: e.target.value, updatedAt: nowStamp() }, "update"); toast("درجة الاهتمام: " + e.target.value); }}>
                  {TEMPS.map((x) => <option key={x}>{x}</option>)}
                </select>
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
                <WaChatButton phone={c.phone} />
                <SendRequestButton c={c} />
                <button type="button" className="crm-btn sm" onClick={() => navigator.clipboard?.writeText(c.phone || "").then(() => toast("تم نسخ الرقم"))}>نسخ</button>
              </>
            ) : (
              <span className="muted">لا يوجد رقم جوال</span>
            )}
            <span className="flex-1" />
            <button type="button" className="crm-btn sm" onClick={() => openModal({ kind: "client", id: c.id })}>تعديل البيانات</button>
          </div>

          <section className="crm-card grid gap-2.5 p-3.5">
            <h3 className="text-[14.5px]">الخطوة التالية</h3>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="grid gap-0.5 rounded-xl bg-[var(--crm-surface-2)] p-2.5">
                <span className="muted text-xs">الاتصال القادم</span>
                <b className={"text-sm " + (c.nextCall && c.nextCall < today() ? "text-[var(--crm-danger)]" : "")}>
                  {relDay(c.nextCall)} {c.nextCall && <small className="muted num">{c.nextCall}</small>}
                </b>
              </div>
              <div className="grid gap-0.5 rounded-xl bg-[var(--crm-surface-2)] p-2.5">
                <span className="muted text-xs">موعد المعاينة</span>
                <b className="text-sm">
                  {vis ? (
                    <>
                      {fmtVisit(vis.at)}{vp ? " · " + vp.title : ""}{" "}
                      {vis.ok ? <Pill tone="ok">مؤكد</Pill> : <Pill tone="warm">بحاجة إلى تأكيد</Pill>}
                    </>
                  ) : "—"}
                </b>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="crm-btn primary" onClick={() => openModal({ kind: "update", clientId: c.id })}>تحديث</button>
              <button type="button" className="crm-btn" onClick={async () => { const n = await postpone(data, c.id); if (n) toast("تم التأجيل إلى " + n); }}>تأجيل 3 أيام</button>
              {vis && !vis.ok && (
                <button type="button" className="crm-btn" onClick={async () => { await confirmVisit(data, c.id); toast("تم تأكيد الموعد"); }}>تأكيد الزيارة</button>
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
                  <div key={r.id} className={"grid gap-2 rounded-xl border p-3 " + (drawer.req === r.id ? "border-[var(--crm-gold)]" : "border-[var(--crm-line)]") + (r.status === "ملغي" ? " opacity-70" : "")}>
                    <Stepper st={r.status} />
                    <div className="flex flex-wrap gap-1.5"><DemandChips r={r} /></div>
                    {r.requirements && <div className="muted text-[13px]">{r.requirements}</div>}
                    {open && c.phone && <div><SendRequestButton c={c} r={r} /></div>}
                    {SOLD_ST.includes(r.status) ? <DealBox r={r} /> : <JourneyBox r={r} />}
                    {SOLD_ST.includes(r.status) ? null : open ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button type="button" className={"crm-btn sm " + (mc ? "primary" : "")} onClick={() => openModal({ kind: "reqMatches", reqId: r.id })}>
                          {mc ? mc + " عقار مناسب" : "لا يوجد عقار مطابق"}
                        </button>
                        <button type="button" className="crm-btn sm" onClick={() => openModal({ kind: "update", clientId: c.id, reqId: r.id, type: "تم إرسال الموقع", propertyId: data.props.find((p) => match(r, p))?.id })}>تم إرسال الموقع</button>
                        <Kebab items={[
                          can(data, "recordDeals") && { label: "تسجيل عربون", onClick: () => openModal({ kind: "close", reqId: r.id, to: "عربون" }) },
                          can(data, "recordDeals") && { label: "تم البيع", onClick: () => openModal({ kind: "close", reqId: r.id, to: "تم البيع" }) },
                          { label: "تعديل الطلب", onClick: () => openModal({ kind: "request", id: r.id }) },
                          { label: "🗑 حذف الطلب", onClick: async () => { if (await deleteRequest(data, r)) toast("تم حذف الطلب"); } },
                        ]} />
                      </div>
                    ) : r.price ? (
                      <div className="muted text-[13px]">
                        {propById(data, r.propertyId)?.title || ""}{r.unit ? " · " + r.unit : ""} · <b className="text-[var(--crm-gold-ink)]">{money(r.price)}</b>
                      </div>
                    ) : null}
                    {/* Offers and viewings for this request (trial 2026-10-22). */}
                    {data.proposals.some((p) => p.requestId === r.id) && (
                      <details className="crm-more !col-span-1" open={open}>
                        <summary>العروض المرسلة ({data.proposals.filter((p) => p.requestId === r.id).length})</summary>
                        <div className="-mx-3 border-t border-[var(--crm-line)]">{data.proposals.filter((p) => p.requestId === r.id).map((p) => <ProposalRow key={p.id} p={p} showClient={false} />)}</div>
                      </details>
                    )}
                    {data.viewings.some((v) => v.requestId === r.id) && (
                      <details className="crm-more !col-span-1" open={open}>
                        <summary>المعاينات ({data.viewings.filter((v) => v.requestId === r.id).length})</summary>
                        <div className="-mx-3 border-t border-[var(--crm-line)]">{data.viewings.filter((v) => v.requestId === r.id).map((v) => <ViewingRow key={v.id} v={v} showClient={false} />)}</div>
                      </details>
                    )}
                  </div>
                );
              })
            ) : (
              <Empty>
                لم يُسجَّل طلب العميل بعد.{" "}
                <button type="button" className="crm-btn sm primary" onClick={() => openModal({ kind: "request", preset: { clientId: c.id, assignee: c.assignee || data.uid } })}>تسجيل طلبه</button>
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
                      <b>{lbl(l.type) || "ملاحظة"}</b>{l.text ? " — " + l.text : ""}
                      {l.propertyId && propById(data, l.propertyId) && <span className="muted"> ({propById(data, l.propertyId)!.title})</span>}
                      {l.byId && <div className="muted text-xs">{nameOf(data, l.byId)}</div>}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="crm-hint">لا يوجد سجل بعد.</p>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}
