/**
 * Tax invoices: totals, the ZATCA e-invoice QR (Phase 1 — TLV of seller name,
 * VAT number, timestamp, total with VAT, VAT amount, Base64), sequential
 * numbering (a Firestore transaction on `counters/invoices`, so two people
 * issuing at once never share a number), and issue / cancel.
 */
import { doc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { assertWritable } from "./preview";
import type { CrmSettings, Invoice, InvoiceLine } from "./types";
import { nowStamp } from "./util";

export const SELLER_NAME = "بن سلمه العقارية";
export const round2 = (n: number) => Math.round(n * 100) / 100;

export function totalsOf(lines: InvoiceLine[], rate: number) {
  const subtotal = round2(lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0));
  const vat = round2((subtotal * rate) / 100);
  return { subtotal, vat, total: round2(subtotal + vat) };
}

/** ZATCA QR payload: TLV (tag, length, UTF-8 value) for tags 1–5, Base64-encoded. */
export function zatcaQr(seller: string, vatNo: string, isoTime: string, total: number, vat: number) {
  const enc = new TextEncoder();
  const parts = [seller, vatNo, isoTime, total.toFixed(2), vat.toFixed(2)].map((v, i) => {
    const bytes = enc.encode(v);
    return [i + 1, bytes.length, ...bytes];
  });
  const all = Uint8Array.from(parts.flat());
  let bin = "";
  all.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

/** "INV-2026-00001" */
export const invoiceNo = (seq: number, at: Date) => "INV-" + at.getFullYear() + "-" + String(seq).padStart(5, "0");

/** Issues a draft: takes the next number, stamps the time, computes totals and the QR, and freezes it. */
export async function issueInvoice(inv: Invoice, settings: CrmSettings, uid: string) {
  assertWritable();
  const vatNo = settings.vatNo;
  if (!vatNo) throw new Error("no_vat");
  const at = new Date();
  const t = totalsOf(inv.lines, inv.vatRate);
  return runTransaction(db, async (tx) => {
    const cref = doc(db, "counters", "invoices");
    const iref = doc(db, "invoices", inv.id);
    const [c, cur] = await Promise.all([tx.get(cref), tx.get(iref)]);
    if (!cur.exists() || cur.data().status !== "مسودة") throw new Error("not_draft");
    const seq = ((c.exists() ? Number(c.data().next) : 0) || 0) + 1;
    tx.set(cref, { next: seq }, { merge: true });
    tx.update(iref, {
      ...t, seq, no: invoiceNo(seq, at), status: "صادرة", issueAt: at.toISOString(), issuedBy: uid, updatedAt: nowStamp(),
      qr: zatcaQr(SELLER_NAME, vatNo, at.toISOString(), t.total, t.vat),
    });
    return invoiceNo(seq, at);
  });
}

export const sellerAddress = (s: CrmSettings) =>
  [s.addrBuilding && "مبنى " + s.addrBuilding, s.addrStreet, s.addrDistrict && "حي " + s.addrDistrict, s.addrCity, s.addrPostal && "الرمز البريدي " + s.addrPostal, s.addrExtra && "الرقم الإضافي " + s.addrExtra]
    .filter(Boolean).join("، ");
