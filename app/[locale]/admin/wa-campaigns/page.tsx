"use client";

/**
 * «حملات واتساب» (client 2026-11-26), managers only: upload an Excel list of numbers, attach an image and/or a
 * message («{الاسم}» is replaced by each client's name), pick the sending number, and start. The WhatsApp server
 * (wa-server, /api/campaigns) does the sending: one message every 20–45 s, a pause after each batch (default 10
 * messages, then 30 minutes), numbers not on WhatsApp skipped, each number once. It carries on with the CRM closed.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import readExcelFile from "read-excel-file/browser";
import { readSheet } from "read-excel-file/browser";
import { useCrm } from "@/lib/crm/store";
import { localPhone, waApi, WA_STATUS_AR, type WaSource } from "@/lib/crm/wa";
import { Empty, PageHeader, Pill } from "@/components/crm/ui";

type Cell = string | number | boolean | Date | null;
interface Recipient { phone: string; name: string; status: "pending" | "sent" | "failed" | "invalid"; at: number | null; error: string | null }
interface Campaign {
  id: string; name: string; source: string; sourceLabel: string; text: string; image: string | null; batch: number; pauseMin: number;
  status: "running" | "paused" | "done" | "cancelled"; createdAt: number; nextAt: number; note: string | null;
  total: number; sent: number; failed: number; invalid: number; pending: number; recipients: Recipient[];
}

/** Same rule as the server: Saudi mobiles in any common form, or 10–15 digits. */
const toIntl = (raw: unknown) => {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("05")) d = "966" + d.slice(1);
  else if (d.length === 9 && d.startsWith("5")) d = "966" + d;
  return /^\d{10,15}$/.test(d) ? d : null;
};
const STATUS: Record<Campaign["status"], [string, "ok" | "warm" | "muted" | "hot"]> = {
  running: ["جارٍ الإرسال", "ok"], paused: ["موقوفة", "warm"], done: ["انتهت", "muted"], cancelled: ["ملغاة", "hot"],
};
const R_STATUS: Record<Recipient["status"], string> = { pending: "بالانتظار", sent: "أُرسلت", failed: "فشل", invalid: "ليس على واتساب" };
const hm = (ts: number) => new Date(ts).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit" });

/** Shrinks a photo to at most 1600 px (JPEG) so it uploads fast and stays well under WhatsApp's limits. */
async function imageToDataUrl(f: File): Promise<string> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.88);
  } finally { URL.revokeObjectURL(url); }
}

export default function WaCampaignsPage() {
  const { data, toast } = useCrm();
  const [sources, setSources] = useState<WaSource[] | null>(null);
  const [camps, setCamps] = useState<Campaign[] | null>(null);
  const [down, setDown] = useState(false);
  // form
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [rows, setRows] = useState<Cell[][]>([]);
  const [fileName, setFileName] = useState("");
  const [phoneCol, setPhoneCol] = useState(-1);
  const [nameCol, setNameCol] = useState(-1);
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [batch, setBatch] = useState(10);
  const [pause, setPause] = useState(30);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [now, setNow] = useState(0); // refreshed with each load (no Date.now() during render)

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([waApi<{ sources: WaSource[] }>("/api/sources"), waApi<{ campaigns: Campaign[] }>("/api/campaigns")]);
      setSources(s.sources); setCamps(c.campaigns); setDown(false); setNow(Date.now());
    } catch { setDown(true); setSources((x) => x ?? []); setCamps((x) => x ?? []); }
  }, []);
  useEffect(() => {
    if (!data.isMgr) return;
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [data.isMgr, load]);

  // Columns: the header row (first row) when it has text, else «عمود 1, 2, …».
  const width = Math.max(0, ...rows.slice(0, 50).map((r) => r.length));
  const head = rows[0] || [];
  const hasHeader = head.some((c) => typeof c === "string" && !toIntl(c));
  const colName = (i: number) => (hasHeader && String(head[i] ?? "").trim()) || "عمود " + (i + 1);
  const body = hasHeader ? rows.slice(1) : rows;

  const list = useMemo(() => {
    if (phoneCol < 0) return [];
    const seen = new Set<string>(), out: { phone: string; name: string }[] = [];
    for (const r of body) {
      const p = toIntl(r[phoneCol]);
      if (!p || seen.has(p)) continue;
      seen.add(p);
      out.push({ phone: p, name: nameCol >= 0 ? String(r[nameCol] ?? "").trim() : "" });
    }
    return out;
  }, [body, phoneCol, nameCol]);
  const badRows = phoneCol < 0 ? 0 : body.filter((r) => String(r[phoneCol] ?? "").trim()).length - list.length;

  async function onExcel(f: File | undefined) {
    if (!f) return;
    try {
      const sheets = await readExcelFile(f).catch(async () => [{ sheet: "", data: await readSheet(f) }]);
      const all = sheets.flatMap((s) => s.data as Cell[][]).filter((r) => r.some((c) => c != null && String(c).trim()));
      setRows(all); setFileName(f.name);
      // Guess the phone column (most cells that look like a number) and the name column (header «اسم»/«name»).
      const w = Math.max(0, ...all.slice(0, 50).map((r) => r.length));
      let best = -1, bestN = 0;
      for (let i = 0; i < w; i++) { const n = all.slice(0, 200).filter((r) => toIntl(r[i])).length; if (n > bestN) { best = i; bestN = n; } }
      setPhoneCol(best);
      const h = all[0] || [];
      setNameCol(h.findIndex((c, i) => i !== best && /اسم|name/i.test(String(c ?? ""))));
    } catch { toast("تعذّرت قراءة الملف — تأكد إنه إكسيل (.xlsx)"); }
  }

  const src = sources?.find((s) => s.id === source);
  const sample = text.split("{الاسم}").join(list[0]?.name || "محمد").replace(/[ \t]{2,}/g, " ").trim();
  const hours = list.length ? Math.ceil(list.length / batch) * pause / 60 + list.length * 32 / 3600 : 0;

  async function start() {
    if (!source) return toast("اختر الرقم اللي تنرسل منه");
    if (!list.length) return toast("ارفع ملف الإكسيل واختر عمود الأرقام");
    if (!text.trim() && !image) return toast("اكتب الرسالة أو أرفق صورة");
    if (src?.status !== "open") return toast("الرقم المختار غير متصل الحين — اربطه من قسم واتساب أولاً");
    if (!window.confirm(`إرسال الحملة إلى ${list.length} رقم من «${src?.label}»؟\n${batch} رسائل ثم استراحة ${pause} دقيقة — تقريباً ${hours.toFixed(1)} ساعة.`)) return;
    setBusy(true);
    try {
      await waApi("/api/campaigns", { name: name.trim() || "حملة " + new Date().toLocaleDateString("ar-SA-u-nu-latn"), source, text: text.trim(), dataUrl: image, list, batch, pauseMin: pause });
      toast("بدأت الحملة — تقدر تقفل الصفحة، الإرسال يكمل من الخادم");
      setRows([]); setFileName(""); setPhoneCol(-1); setNameCol(-1); setText(""); setImage(null); setName("");
      load();
    } catch (e) { toast("تعذّر بدء الحملة" + (e instanceof Error && e.message ? " — " + e.message : "")); }
    finally { setBusy(false); }
  }
  async function act(c: Campaign, a: "pause" | "resume" | "cancel") {
    if (a === "cancel" && !window.confirm("إلغاء الحملة «" + c.name + "»؟ الرسائل المتبقية ما بتنرسل.")) return;
    try { await waApi(`/api/campaigns/${c.id}/${a}`, {}); load(); } catch { toast("تعذّر التنفيذ"); }
  }

  if (!data.isMgr) return <Empty>هذا القسم للمدير فقط.</Empty>;

  return (
    <>
      <PageHeader title="حملات واتساب" sub="أرسل عرضاً لقائمة أرقام من ملف إكسيل، من الرقم اللي تختاره، على دفعات حتى ما ينحظر الرقم." />
      {down && <div className="crm-card mb-4 p-3 text-[13.5px] text-[var(--crm-danger)]">خادم الواتساب غير متاح الحين — جرّب بعد شوي.</div>}

      <div className="crm-card mb-6 grid gap-3 p-4 sm:grid-cols-2">
        <b className="font-heading text-[16px] sm:col-span-2">حملة جديدة</b>
        <label className="grid gap-1 text-[13px]">اسم الحملة
          <input value={name} placeholder="مثال: عرض تاون هاوس العارض" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="grid gap-1 text-[13px]">الإرسال من رقم
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">— اختر الرقم —</option>
            {(sources || []).map((s) => (
              <option key={s.id} value={s.id}>{s.label}{s.me?.id ? " · " + localPhone(s.me.id.split(/[:@]/)[0]) : ""} — {WA_STATUS_AR[s.status] || s.status}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-[13px] sm:col-span-2">ملف الإكسيل (الأرقام)
          <input type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => { onExcel(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {rows.length > 0 && (
          <>
            <label className="grid gap-1 text-[13px]">عمود الأرقام
              <select value={phoneCol} onChange={(e) => setPhoneCol(+e.target.value)}>
                <option value={-1}>—</option>
                {Array.from({ length: width }, (_, i) => <option key={i} value={i}>{colName(i)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[13px]">عمود الأسماء (اختياري)
              <select value={nameCol} onChange={(e) => setNameCol(+e.target.value)}>
                <option value={-1}>بدون أسماء</option>
                {Array.from({ length: width }, (_, i) => <option key={i} value={i}>{colName(i)}</option>)}
              </select>
            </label>
            <p className="m-0 text-[13px] text-[var(--crm-ink-2)] sm:col-span-2">
              📄 {fileName}: <b>{list.length}</b> رقم صالح بدون تكرار{badRows > 0 ? ` · ${badRows} مكرر أو غير صالح يُتخطّى` : ""}
            </p>
          </>
        )}

        <label className="grid gap-1 text-[13px] sm:col-span-2">صورة العرض (اختياري)
          <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setImage(await imageToDataUrl(f).catch(() => null)); }} />
        </label>
        <label className="grid gap-1 text-[13px] sm:col-span-2">الرسالة (تنكتب تحت الصورة)
          <textarea rows={8} value={text} placeholder={"السلام عليكم {الاسم} 🌷\n…تفاصيل العرض…"} onChange={(e) => setText(e.target.value)} />
          <span className="crm-hint">اكتب «{"{الاسم}"}» ويتبدّل باسم كل عميل من ملف الإكسيل.</span>
        </label>
        <label className="grid gap-1 text-[13px]">عدد الرسائل في كل دفعة
          <input inputMode="numeric" value={batch} onChange={(e) => setBatch(Math.max(1, Math.min(50, +e.target.value || 1)))} />
        </label>
        <label className="grid gap-1 text-[13px]">الاستراحة بين الدفعات (دقيقة)
          <input inputMode="numeric" value={pause} onChange={(e) => setPause(Math.max(5, Math.min(240, +e.target.value || 5)))} />
        </label>

        {(image || text.trim()) && (
          <div className="sm:col-span-2">
            <div className="mb-1 text-[12.5px] text-[var(--crm-ink-3)]">معاينة (كما تصل لأول عميل)</div>
            <div className="max-w-[340px] rounded-xl bg-[#d9fdd3] p-1.5 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {image && <img src={image} alt="" className="mb-1 w-full rounded-lg" />}
              {sample && <p className="m-0 whitespace-pre-line px-1.5 pb-1 text-[13.5px] leading-relaxed">{sample}</p>}
            </div>
            {image && <button type="button" className="crm-btn ghost sm mt-1" onClick={() => setImage(null)}>إزالة الصورة</button>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="button" className="crm-btn primary" disabled={busy} onClick={start}>{busy ? "جارٍ البدء…" : "ابدأ الإرسال"}</button>
          {list.length > 0 && <span className="text-[13px] text-[var(--crm-ink-3)]">{list.length} رقم · {batch} كل دفعة · استراحة {pause} د · تقريباً {hours.toFixed(1)} ساعة</span>}
        </div>
      </div>

      <h2 className="mb-3 font-heading text-[18px]">الحملات</h2>
      {camps === null ? <Empty>جارٍ التحميل…</Empty> : !camps.length ? <Empty>ما فيه حملات بعد.</Empty> : (
        <div className="grid gap-3">
          {camps.map((c) => {
            const done = c.sent + c.failed + c.invalid;
            const [st, tone] = STATUS[c.status];
            return (
              <div key={c.id} className="crm-card grid gap-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="font-heading text-[15.5px]">{c.name}</b>
                  <Pill tone={tone}>{st}</Pill>
                  <span className="text-[12.5px] text-[var(--crm-ink-3)]">من «{c.sourceLabel}» · {new Date(c.createdAt).toLocaleDateString("ar-SA-u-nu-latn")}</span>
                  <span className="ms-auto flex gap-1.5">
                    {c.status === "running" && <button type="button" className="crm-btn sm" onClick={() => act(c, "pause")}>⏸ إيقاف مؤقت</button>}
                    {c.status === "paused" && <button type="button" className="crm-btn sm primary" onClick={() => act(c, "resume")}>▶ استئناف</button>}
                    {["running", "paused"].includes(c.status) && <button type="button" className="crm-btn sm danger" onClick={() => act(c, "cancel")}>إلغاء</button>}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--crm-surface-2)]"><div className="h-full bg-[var(--crm-ok)]" style={{ width: (c.total ? (done / c.total) * 100 : 0) + "%" }} /></div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                  <span>أُرسلت: <b>{c.sent}</b> من {c.total}</span>
                  {c.invalid > 0 && <span className="text-[var(--crm-ink-3)]">ليست على واتساب: {c.invalid}</span>}
                  {c.failed > 0 && <span className="text-[var(--crm-danger)]">فشل: {c.failed}</span>}
                  {c.status === "running" && c.note === "waiting" && <span className="text-[var(--crm-warn)]">الرقم غير متصل — ينتظر رجوعه</span>}
                  {c.status === "running" && c.note !== "waiting" && c.pending > 0 && c.nextAt > now + 60_000 && <span className="text-[var(--crm-ink-3)]">استراحة — الدفعة الجاية {hm(c.nextAt)}</span>}
                  <button type="button" className="crm-btn ghost sm" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? "إخفاء الأرقام" : "عرض الأرقام"}</button>
                </div>
                {open === c.id && (
                  <div className="max-h-72 overflow-y-auto rounded-lg border border-[var(--crm-line)]">
                    <table className="crm-table w-full text-[13px]">
                      <thead><tr><th>الرقم</th><th>الاسم</th><th>الحالة</th><th>الوقت</th></tr></thead>
                      <tbody>
                        {c.recipients.map((r) => (
                          <tr key={r.phone}>
                            <td className="num" dir="ltr">{localPhone(r.phone)}</td><td>{r.name || "—"}</td>
                            <td className={r.status === "failed" ? "text-[var(--crm-danger)]" : r.status === "sent" ? "text-[var(--crm-ok)]" : ""} title={r.error || undefined}>{R_STATUS[r.status]}</td>
                            <td>{r.at ? hm(r.at) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
