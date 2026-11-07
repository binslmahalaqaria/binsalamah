"use client";

/**
 * «الاهتمامات» (client 2026-11-07): a client asked about one specific property. It is recorded with a follow-up date;
 * when the date comes the employee logs what happened: excellent, thinking, no answer, not interested, or turn it
 * into a request. Stored on the client (`Client.interests`), so a transfer moves them with the client.
 */
import { useState } from "react";
import { useCrm } from "@/lib/crm/store";
import { clientById, nameOf, OPEN_REQ, propById, unitsOf, visibleClients, workClients, type CrmData } from "@/lib/crm/logic";
import { addInterests, closeInterest, createClient, followInterest, isPhoneTaken, PHONE_TAKEN, removeInterest, type InterestItem as NewInterest, type InterestResult } from "@/lib/crm/actions";
import type { Client, Interest } from "@/lib/crm/types";
import { addDays, ageDays, fmtStamp, nowStamp, relDay, splitList, today } from "@/lib/crm/util";
import { ConfirmButton, ContactIcons, Field, ModalFrame, Pill, RadioChips, Select } from "./ui";
import { TempPill } from "./bits";
import { DupHint, findDup } from "./forms";

export const INT_OPEN = ["متابعة", "ممتاز"];
export const isOpenInterest = (x: Interest) => INT_OPEN.includes(x.status);
export type InterestItem = { c: Client; x: Interest };

/** Every interest of the clients this person may see; `work` keeps to their own queue, like the home page. */
export const interestItems = (d: CrmData, work = false): InterestItem[] =>
  (work ? workClients(d) : visibleClients(d)).flatMap((c) => (c.interests || []).map((x) => ({ c, x })));
/** Open interests whose follow-up is due today or overdue, oldest date first. */
export const dueInterests = (d: CrmData, work = false) => {
  const t = today();
  return interestItems(d, work).filter(({ x }) => isOpenInterest(x) && !!x.followUp && x.followUp <= t)
    .sort((a, b) => String(a.x.followUp).localeCompare(String(b.x.followUp)));
};

const DAYS: [string, string][] = [["1", "غداً"], ["3", "بعد 3 أيام"], ["7", "بعد أسبوع"], ["date", "تاريخ محدد"]];
const pickDate = (v: string, date: string) => (v === "date" ? date : addDays(+v));

export function InterestRow({ c, x, showClient = true }: InterestItem & { showClient?: boolean }) {
  const { data, openClient, openModal } = useCrm();
  const t = today(), open = isOpenInterest(x), team = data.isMgr && !data.viewAs;
  const title = propById(data, x.propertyId)?.title || x.propertyTitle;
  return (
    <div className={"crm-row grid-cols-[minmax(0,1fr)_auto] " + (open && x.followUp && x.followUp < t ? "late" : "")}>
      <div className="min-w-0 cursor-pointer" onClick={() => openClient(c.id)}>
        <div className="flex flex-wrap items-center gap-1.5">
          {showClient ? <b className="font-heading">{c.name}</b> : <b className="font-heading">{title}</b>}
          {showClient && <TempPill t={c.temp} />}
          {!x.propertyId && <Pill tone="muted">غير مضاف</Pill>}
          <Pill tone={x.status === "ممتاز" ? "ok" : x.status === "غير مهتم" ? "muted" : x.status === "حُوّل لطلب" ? "ok" : "warm"}>{x.status}</Pill>
        </div>
        {showClient && <div className="truncate text-[13px] text-[var(--crm-ink-2)]">مهتم في: {title}{x.unit ? " · " + x.unit : ""}</div>}
        {x.note && <div className="truncate text-[13px] text-[var(--crm-ink-2)]">📝 {x.note}</div>}
        <div className="text-xs text-[var(--crm-ink-3)]">
          استفسر {ageDays(x.at)}
          {open && x.followUp && <> · المتابعة: <span className={x.followUp < t ? "font-semibold text-[var(--crm-danger)]" : x.followUp === t ? "font-semibold" : ""}>{relDay(x.followUp)}</span></>}
          {team && c.assignee ? " · " + nameOf(data, c.assignee) : ""}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <ContactIcons phone={c.phone} />
        <button type="button" className={"crm-btn sm " + (open ? "primary" : "")} onClick={() => openModal({ kind: "interestFollow", clientId: c.id, id: x.id })}>{open ? "سجّل المتابعة" : "التفاصيل"}</button>
      </div>
    </div>
  );
}

/** Lists interests with one row per client: someone with several opens them from their row instead of filling the list. */
export function InterestList({ items }: { items: InterestItem[] }) {
  const { data, openClient, openModal } = useCrm();
  const t = today(), team = data.isMgr && !data.viewAs;
  const groups = new Map<string, InterestItem[]>();
  for (const it of items) groups.set(it.c.id, [...(groups.get(it.c.id) || []), it]);
  return (
    <>
      {[...groups.values()].map((g) => {
        if (g.length === 1) return <InterestRow key={g[0].c.id + g[0].x.id} c={g[0].c} x={g[0].x} />;
        const c = g[0].c;
        const next = g.map(({ x }) => x.followUp).filter((d): d is string => !!d).sort()[0];
        return (
          <div key={c.id} className={"crm-row grid-cols-[minmax(0,1fr)_auto] " + (next && next < t ? "late" : "")}>
            <div className="min-w-0 cursor-pointer" onClick={() => openClient(c.id)}>
              <div className="flex flex-wrap items-center gap-1.5"><b className="font-heading">{c.name}</b><TempPill t={c.temp} /><Pill tone="warm">{g.length} عقارات</Pill></div>
              <div className="text-xs text-[var(--crm-ink-3)]">
                {next && <>المتابعة: <span className={next < t ? "font-semibold text-[var(--crm-danger)]" : next === t ? "font-semibold" : ""}>{relDay(next)}</span></>}
                {team && c.assignee ? " · " + nameOf(data, c.assignee) : ""}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <ContactIcons phone={c.phone} />
              <button type="button" className="crm-btn sm primary" onClick={() => openModal({ kind: "interestClient", clientId: c.id })}>عرض الاهتمامات</button>
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Everything one client is interested in. */
export function ClientInterests({ clientId }: { clientId: string }) {
  const { data, closeModal, openModal } = useCrm();
  const c = clientById(data, clientId);
  if (!c) return null;
  const list = [...(c.interests || [])].sort((a, b) => Number(isOpenInterest(b)) - Number(isOpenInterest(a)) || String(a.followUp).localeCompare(String(b.followUp)));
  return (
    <ModalFrame title={"اهتمامات: " + c.name} onClose={closeModal} width={560}
      footer={<div className="flex gap-2"><button type="button" className="crm-btn primary" onClick={() => openModal({ kind: "interest", clientId: c.id })}>+ اهتمام بعقار</button><button type="button" className="crm-btn" onClick={closeModal}>إغلاق</button></div>}>
      <div className="overflow-hidden rounded-xl border border-[var(--crm-line)]">
        {list.map((x) => <InterestRow key={x.id} c={c} x={x} showClient={false} />)}
      </div>
    </ModalFrame>
  );
}

/** Record that a client asked about a property: an existing client, or a new name and number. */
export function InterestForm({ clientId: c0, propertyId: p0 }: { clientId?: string; propertyId?: string }) {
  const { data, closeModal, toast } = useCrm();
  const [clientId, setClientId] = useState(c0 || "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [picked, setPicked] = useState<string[]>(p0 ? [p0] : []);
  const [unit, setUnit] = useState("");
  // Properties not in the system: a name and a short description, so they can be recognised later.
  const [extras, setExtras] = useState<{ title: string; details: string }[]>([]);
  const [note, setNote] = useState("");
  const [days, setDays] = useState("3");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const clients = visibleClients(data).map((c) => [c.id, c.name] as [string, string]);
  const preset = clientById(data, c0);
  if (preset && !clients.some(([v]) => v === preset.id)) clients.unshift([preset.id, preset.name]);
  const prop = picked.length === 1 ? propById(data, picked[0]) : undefined;
  const units = prop ? unitsOf(prop) : [];
  const setExtra = (i: number, k: "title" | "details", v: string) => setExtras((xs) => xs.map((x, n) => (n === i ? { ...x, [k]: v } : x)));

  async function save() {
    if (!clientId && !name.trim()) return toast("اختر عميلاً موجوداً أو اكتب اسم العميل");
    const typed = extras.filter((x) => x.title.trim());
    if (extras.some((x) => !x.title.trim() && x.details.trim())) return toast("اكتب اسم العقار غير المضاف");
    if (!picked.length && !typed.length) return toast("اختر العقار الذي استفسر عنه");
    const followUp = pickDate(days, date);
    if (!followUp) return toast("اختر تاريخ المتابعة");
    if (!clientId && phone) {
      const dup = findDup(data, phone);
      if (dup) return toast("العميل مسجّل من قبل باسم " + dup.name + (dup.assignee ? " عند " + nameOf(data, dup.assignee) : ""));
    }
    setBusy(true);
    try {
      let id = clientId;
      let fresh: Client | undefined;
      if (!id) {
        const body = {
          name: name.trim(), phone: phone.trim() || null, source: null, temp: null, status: "نشط", nextCall: null, visitAt: null, notes: null, log: [],
          assignee: data.isMgr && data.viewAs && data.viewAs !== "none" ? data.viewAs : data.uid, assignedAt: nowStamp(), assignedBy: data.uid,
          createdAt: nowStamp(), updatedAt: nowStamp(),
        };
        id = await createClient(body);
        fresh = { ...body, id } as Client; // not back from the live listener yet
      }
      const items: NewInterest[] = [
        ...picked.map((pid) => ({ propertyId: pid, title: propById(data, pid)?.title || "عقار", unit: picked.length === 1 ? unit || null : null, note: note.trim() || null })),
        ...typed.map((x) => ({ propertyId: null, title: x.title.trim(), unit: null, note: [x.details.trim(), note.trim()].filter(Boolean).join(" — ") || null })),
      ];
      await addInterests(data, fresh || clientById(data, id)!, items, followUp);
      toast((items.length > 1 ? "سُجّلت " + items.length + " اهتمامات" : "سُجّل الاهتمام") + " — المتابعة " + relDay(followUp));
      closeModal();
    } catch (e) {
      toast(isPhoneTaken(e) ? PHONE_TAKEN : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalFrame title="تسجيل اهتمام بعقار" onClose={closeModal} width={520}
      footer={<div className="flex gap-2"><button type="button" className="crm-btn primary" disabled={busy} onClick={save}>حفظ</button><button type="button" className="crm-btn" onClick={closeModal}>إلغاء</button></div>}>
      <div className="grid gap-3">
        <Field label="عميل موجود"><Select value={clientId} onChange={setClientId} options={clients} blank="— عميل جديد —" /></Field>
        {!clientId && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="اسم العميل *"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="الجوال"><input value={phone} dir="ltr" placeholder="05xxxxxxxx" onChange={(e) => setPhone(e.target.value)} /><DupHint phone={phone} /></Field>
          </div>
        )}
        <Field label="العقارات التي استفسر عنها *" hint="تقدر تختار أكثر من عقار.">
          <Select value="" onChange={(v) => { if (v) setPicked((xs) => (xs.includes(v) ? xs : [...xs, v])); setUnit(""); }} blank="+ أضف عقار من النظام"
            options={data.props.filter((p) => !picked.includes(p.id)).map((p) => [p.id, (p.ref ? "#" + p.ref + " " : "") + p.title] as [string, string])} />
        </Field>
        {picked.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {picked.map((id) => (
              <button key={id} type="button" className="crm-btn sm" title="إزالة" onClick={() => { setPicked((xs) => xs.filter((x) => x !== id)); setUnit(""); }}>{propById(data, id)?.title || "عقار"} ✕</button>
            ))}
          </div>
        )}
        {extras.map((x, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-[var(--crm-line)] p-2.5">
            <div className="flex items-center justify-between text-[13px]"><b>عقار غير مضاف في النظام</b><button type="button" className="crm-btn ghost sm" onClick={() => setExtras((xs) => xs.filter((_, n) => n !== i))}>إزالة</button></div>
            <input value={x.title} placeholder="اسم العقار أو وصفه، مثال: فيلا حي الملقا" aria-label="اسم العقار" onChange={(e) => setExtra(i, "title", e.target.value)} />
            <input value={x.details} placeholder="تفاصيل بسيطة: السعر، المساحة، من أين سمع عنه" aria-label="تفاصيل العقار" onChange={(e) => setExtra(i, "details", e.target.value)} />
          </div>
        ))}
        <button type="button" className="crm-btn sm justify-self-start" onClick={() => setExtras((xs) => [...xs, { title: "", details: "" }])}>+ عقار غير مضاف في النظام</button>
        {units.length > 0 && (
          <Field label="الوحدة (اختياري)"><Select value={unit} onChange={setUnit} blank="—" options={units.map((u) => u.name)} /></Field>
        )}
        <Field label="ملاحظة (اختياري)"><input value={note} placeholder="مثال: سأل عن السعر ويبيها لسكنه" onChange={(e) => setNote(e.target.value)} /></Field>
        <div>
          <div className="crm-sec !mt-0 mb-2">نتواصل معه</div>
          <RadioChips options={DAYS} value={days} onChange={setDays} />
          {days === "date" && <input type="date" className="mt-2" min={today()} value={date} onChange={(e) => setDate(e.target.value)} />}
        </div>
      </div>
    </ModalFrame>
  );
}

const RESULTS: [InterestResult | "طلب", string][] = [["ممتاز", "⭐ ممتاز"], ["يفكر", "يفكر"], ["لم يرد", "لم يرد"], ["طلب", "حوّله طلب"], ["غير مهتم", "غير مهتم"]];

/** What came of the follow-up. */
export function InterestFollow({ clientId, id }: { clientId: string; id: string }) {
  const { data, closeModal, openModal, toast } = useCrm();
  const c = clientById(data, clientId);
  const x = c?.interests?.find((i) => i.id === id);
  const [result, setResult] = useState<string>("");
  const [days, setDays] = useState("3");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!c || !x) return null;
  const open = isOpenInterest(x);
  const p = propById(data, x.propertyId);
  const title = p?.title || x.propertyTitle;
  const needsDate = ["ممتاز", "يفكر", "لم يرد"].includes(result);

  async function save() {
    if (!result) return toast("اختر نتيجة المتابعة");
    setBusy(true);
    try {
      if (result === "طلب") {
        // One open request per client: an existing one is opened instead of adding a second.
        const ex = data.requests.find((r) => r.clientId === c!.id && OPEN_REQ(r));
        if (ex) {
          await closeInterest(data, c!, x!, ex.id, note.trim());
          toast("للعميل طلب قائم — رُبط الاهتمام به");
          return openModal({ kind: "request", id: ex.id });
        }
        const district = p?.district ? splitList(p.district) : [];
        return openModal({ kind: "request", preset: {
          clientId: c!.id, assignee: c!.assignee || data.uid, purpose: p?.purpose || undefined, propTypes: p?.type ? [p.type] : undefined,
          districts: district.join("، ") || undefined, budget: p?.price ?? undefined, requirements: "مهتم في: " + title + (note.trim() ? " — " + note.trim() : ""),
          _interestId: x!.id,
        } });
      }
      const nx = needsDate ? pickDate(days, date) : null;
      if (needsDate && !nx) return toast("اختر تاريخ المتابعة");
      await followInterest(data, c!, x!, result as InterestResult, nx, note.trim());
      toast(nx ? "تم — المتابعة القادمة " + relDay(nx) : "تم إغلاق الاهتمام");
      closeModal();
    } catch {
      toast("تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalFrame title={"متابعة اهتمام: " + c.name} onClose={closeModal} width={520}
      footer={
        <>
          {open ? (
            <div className="flex gap-2"><button type="button" className="crm-btn primary" disabled={busy} onClick={save}>حفظ</button><button type="button" className="crm-btn" onClick={closeModal}>إلغاء</button></div>
          ) : <button type="button" className="crm-btn" onClick={closeModal}>إغلاق</button>}
          <ConfirmButton onConfirm={async () => { await removeInterest(c, x); toast("تم الحذف"); closeModal(); }}>حذف</ConfirmButton>
        </>
      }>
      <div className="grid gap-3">
        <div className="rounded-xl bg-[var(--crm-surface-2)] p-3 text-sm">
          <b>{title}</b>{x.unit ? " · " + x.unit : ""}
          <div className="text-xs text-[var(--crm-ink-3)]">استفسر {ageDays(x.at)}{x.note ? " · " + x.note : ""}</div>
        </div>
        {(x.history || []).length > 0 && (
          <ol className="m-0 grid list-none gap-1 p-0 text-[13px]">
            {x.history!.map((h, i) => (
              <li key={i}><span className="num muted text-xs">{fmtStamp(h.at)}</span> · <b>{h.result}</b>{h.note ? " — " + h.note : ""} <span className="muted text-xs">({nameOf(data, h.by)})</span></li>
            ))}
          </ol>
        )}
        {open && (
          <>
            <div>
              <div className="crm-sec !mt-0 mb-2">نتيجة التواصل</div>
              <RadioChips options={RESULTS} value={result} onChange={(v) => { setResult(v); setDays(v === "لم يرد" ? "1" : "3"); }} />
            </div>
            <Field label="ملاحظة (اختياري)"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            {needsDate && (
              <div>
                <div className="crm-sec !mt-0 mb-2">المتابعة القادمة</div>
                <RadioChips options={DAYS} value={days} onChange={setDays} />
                {days === "date" && <input type="date" className="mt-2" min={today()} value={date} onChange={(e) => setDate(e.target.value)} />}
              </div>
            )}
            {result === "ممتاز" && <p className="crm-hint m-0">يصير العميل «ساخن».</p>}
            {result === "طلب" && <p className="crm-hint m-0">يُفتح نموذج الطلب معبّأً من بيانات العقار، وعند حفظه يُغلق الاهتمام.</p>}
          </>
        )}
      </div>
    </ModalFrame>
  );
}
