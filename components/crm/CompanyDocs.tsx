"use client";

/**
 * "بيانات السندات" (owner, Settings → أدوات): what every receipt prints —
 * commercial registration number, the bank account for transfers, the
 * authorised signatory's name, and their signature image. The signature is
 * shrunk to a small PNG in the browser and kept in `crm/settings` (no file
 * storage needed); a white background disappears when printed.
 */
import { useEffect, useRef, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCrm } from "@/lib/crm/store";
import { assertWritable } from "@/lib/crm/preview";
import { nameOf } from "@/lib/crm/logic";

/** Image file → PNG data URL at most 480×200, white made transparent, so it sits cleanly on the receipt. */
async function toSignature(file: File): Promise<string> {
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();
  const scale = Math.min(1, 480 / img.width, 200 / img.height);
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < px.data.length; i += 4) {
    const [r, g, b] = [px.data[i], px.data[i + 1], px.data[i + 2]];
    if (r > 200 && g > 200 && b > 200) px.data[i + 3] = 0; // paper → transparent
  }
  ctx.putImageData(px, 0, 0);
  URL.revokeObjectURL(img.src);
  return cv.toDataURL("image/png");
}

/** Sign with the mouse or a finger: ink on a transparent canvas, cropped to the strokes and exported as PNG. */
function SignaturePad({ onDone, onCancel }: { onDone: (png: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  const ink = "#1e3a8a";
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) * e.currentTarget.width) / r.width, ((e.clientY - r.top) * e.currentTarget.height) / r.height] as const;
  };
  const clear = () => { const c = ref.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setEmpty(true); };
  function done() {
    const c = ref.current!, ctx = c.getContext("2d")!;
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (data[(y * c.width + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x1 <= x0) return;
    const pad = 12, w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2;
    const out = document.createElement("canvas");
    const scale = Math.min(1, 480 / w, 200 / h);
    out.width = Math.round(w * scale); out.height = Math.round(h * scale);
    out.getContext("2d")!.drawImage(c, x0 - pad, y0 - pad, w, h, 0, 0, out.width, out.height);
    onDone(out.toDataURL("image/png"));
  }
  return (
    <div className="grid gap-2">
      <canvas ref={ref} width={900} height={320} className="w-full max-w-[600px] cursor-crosshair touch-none rounded-xl border-2 border-dashed border-[var(--crm-line)] bg-white"
        style={{ aspectRatio: "900 / 320" }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const ctx = e.currentTarget.getContext("2d")!;
          const [x, y] = pos(e);
          ctx.strokeStyle = ink; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.lineJoin = "round";
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.1, y + 0.1); ctx.stroke();
          setEmpty(false);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext("2d")!;
          const [x, y] = pos(e);
          ctx.lineTo(x, y); ctx.stroke();
        }}
        onPointerUp={() => { drawing.current = false; }}
        onPointerLeave={() => { drawing.current = false; }} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="crm-hint flex-1">وقّع داخل المربع بالماوس أو بإصبعك.</span>
        <button type="button" className="crm-btn ghost sm" onClick={clear}>مسح</button>
        <button type="button" className="crm-btn ghost sm" onClick={onCancel}>إلغاء</button>
        <button type="button" className="crm-btn primary sm" disabled={empty} onClick={done}>اعتماد التوقيع</button>
      </div>
    </div>
  );
}

export function CompanyDocs() {
  const { data, settings, toast } = useCrm();
  const [f, setF] = useState(() => ({
    vatNo: settings.vatNo || "", addrBuilding: settings.addrBuilding || "", addrStreet: settings.addrStreet || "", addrDistrict: settings.addrDistrict || "", addrCity: settings.addrCity || "", addrPostal: settings.addrPostal || "", addrExtra: settings.addrExtra || "",
    crNo: settings.crNo || "", bankName: settings.bankName || "", iban: settings.iban || "", accountNo: settings.accountNo || "", accountName: settings.accountName || "بن سلمه العقارية",
    signerName: settings.signerName || nameOf(data, data.uid), signature: settings.signature || ""
  }));
  const [busy, setBusy] = useState(false);
  const [signing, setSigning] = useState(false);
  const touched = useRef(false);
  const set = (k: keyof typeof f, v: string) => { touched.current = true; setF((x) => ({ ...x, [k]: v })); };
  // Settings may arrive after this card mounts: take them until the owner starts editing, so "حفظ" never wipes saved values.
  useEffect(() => {
    if (touched.current) return;
    setF((x) => ({
      crNo: settings.crNo || "", bankName: settings.bankName || "", iban: settings.iban || "", accountNo: settings.accountNo || "",
      vatNo: settings.vatNo || "", addrBuilding: settings.addrBuilding || "", addrStreet: settings.addrStreet || "", addrDistrict: settings.addrDistrict || "", addrCity: settings.addrCity || "", addrPostal: settings.addrPostal || "", addrExtra: settings.addrExtra || "",
      accountName: settings.accountName || x.accountName, signerName: settings.signerName || x.signerName, signature: settings.signature || "",
    }));
  }, [settings]);
  if (!data.isAdmin) return null;

  async function save() {
    assertWritable();
    setBusy(true);
    try {
      await setDoc(doc(db, "crm", "settings"), {
        vatNo: f.vatNo.trim() || null, addrBuilding: f.addrBuilding.trim() || null, addrStreet: f.addrStreet.trim() || null, addrDistrict: f.addrDistrict.trim() || null, addrCity: f.addrCity.trim() || null, addrPostal: f.addrPostal.trim() || null, addrExtra: f.addrExtra.trim() || null,
        crNo: f.crNo.trim() || null, bankName: f.bankName.trim() || null, iban: f.iban.replace(/\s+/g, "").toUpperCase() || null, accountNo: f.accountNo.replace(/\s+/g, "") || null,
        accountName: f.accountName.trim() || null, signerName: f.signerName.trim() || null, signature: f.signature || null,
      }, { merge: true });
      toast("تم حفظ بيانات المنشأة");
    } catch {
      toast("تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="crm-card grid gap-3 p-4">
      <h2 className="text-[15.5px]">بيانات المنشأة (السندات والفواتير)</h2>
      <p className="crm-hint m-0">تُطبع على كل سند قبض: السجل التجاري، والحساب البنكي، واسم المفوّض بالتوقيع وتوقيعه.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="crm-field"><label>الرقم الضريبي (VAT)</label><input dir="ltr" inputMode="numeric" placeholder="3xxxxxxxxxxxxx3" value={f.vatNo} onChange={(e) => set("vatNo", e.target.value.replace(/\D/g, ""))} /></div>
        <div className="crm-field"><label>المدينة</label><input value={f.addrCity} placeholder="الرياض" onChange={(e) => set("addrCity", e.target.value)} /></div>
        <div className="crm-field"><label>الحي</label><input value={f.addrDistrict} onChange={(e) => set("addrDistrict", e.target.value)} /></div>
        <div className="crm-field"><label>الشارع</label><input value={f.addrStreet} onChange={(e) => set("addrStreet", e.target.value)} /></div>
        <div className="crm-field"><label>رقم المبنى</label><input dir="ltr" inputMode="numeric" value={f.addrBuilding} onChange={(e) => set("addrBuilding", e.target.value)} /></div>
        <div className="crm-field"><label>الرمز البريدي</label><input dir="ltr" inputMode="numeric" value={f.addrPostal} onChange={(e) => set("addrPostal", e.target.value)} /></div>
        <div className="crm-field"><label>الرقم الإضافي</label><input dir="ltr" inputMode="numeric" value={f.addrExtra} onChange={(e) => set("addrExtra", e.target.value)} /></div>
        <div className="crm-field"><label>رقم السجل التجاري</label><input dir="ltr" inputMode="numeric" value={f.crNo} onChange={(e) => set("crNo", e.target.value)} /></div>
        <div className="crm-field"><label>اسم البنك</label><input value={f.bankName} placeholder="مثال: مصرف الراجحي" onChange={(e) => set("bankName", e.target.value)} /></div>
        <div className="crm-field"><label>رقم الحساب</label><input dir="ltr" inputMode="numeric" value={f.accountNo} onChange={(e) => set("accountNo", e.target.value)} /></div>
        <div className="crm-field"><label>رقم الآيبان (IBAN)</label><input dir="ltr" value={f.iban} placeholder="SA00 0000 0000 0000 0000 0000" onChange={(e) => set("iban", e.target.value)} /></div>
        <div className="crm-field"><label>اسم صاحب الحساب</label><input value={f.accountName} onChange={(e) => set("accountName", e.target.value)} /></div>
        <div className="crm-field"><label>اسم المفوّض بالتوقيع</label><input value={f.signerName} onChange={(e) => set("signerName", e.target.value)} /></div>
        <div className="crm-field">
          <label>التوقيع (صورة)</label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="crm-btn sm primary" onClick={() => setSigning(true)}>✍️ وقّع هنا</button>
            <label className="crm-btn sm cursor-pointer">
              {f.signature ? "رفع صورة أخرى" : "أو ارفع صورة"}
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try { set("signature", await toSignature(file)); } catch { toast("تعذّرت قراءة الصورة"); }
              }} />
            </label>
            {f.signature && <button type="button" className="crm-btn ghost sm" onClick={() => set("signature", "")}>إزالة</button>}
          </div>
        </div>
      </div>
      {signing && <SignaturePad onDone={(png) => { set("signature", png); setSigning(false); toast("تم اعتماد التوقيع — اضغط «حفظ»"); }} onCancel={() => setSigning(false)} />}
      {f.signature && !signing && (
        <div className="grid justify-items-start gap-1">
          <span className="text-[12px] text-[var(--crm-ink-3)]">معاينة التوقيع:</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.signature} alt="التوقيع" className="max-h-20 rounded-lg border border-dashed border-[var(--crm-line)] bg-white p-1" />
        </div>
      )}
      <button type="button" className="crm-btn primary justify-self-start" disabled={busy} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
    </div>
  );
}
