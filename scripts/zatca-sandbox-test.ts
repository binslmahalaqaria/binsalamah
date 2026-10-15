/**
 * End-to-end check of the ZATCA Phase 2 code against ZATCA's public developer
 * sandbox (no account needed, OTP 123345): compliance CSID → the six
 * compliance invoices → production CSID. Run: npx tsx scripts/zatca-sandbox-test.ts
 */
import { randomUUID } from "node:crypto";
import { buildCsr, generateKeyPair } from "../lib/zatca/csr";
import { FIRST_PIH, signInvoice, type DocType, type ZInvoice, type ZParty } from "../lib/zatca/invoice-xml";

const BASE = "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal";
async function post(path: string, body: unknown, auth?: { token: string; secret: string }, extra: Record<string, string> = {}) {
  const r = await fetch(BASE + path, {
    method: "POST",
    headers: { accept: "application/json", "Accept-Language": "en", "Accept-Version": "V2", "Content-Type": "application/json", ...(auth ? { Authorization: "Basic " + Buffer.from(auth.token + ":" + auth.secret).toString("base64") } : {}), ...extra },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  try { return { status: r.status, json: JSON.parse(t) }; } catch { return { status: r.status, json: { raw: t } }; }
}
const brief = (j: { validationResults?: { status?: string; errorMessages?: { message: string }[]; warningMessages?: { message: string }[] }; reportingStatus?: string; clearanceStatus?: string }) =>
  [j.reportingStatus || j.clearanceStatus || j.validationResults?.status, ...(j.validationResults?.errorMessages || []).map((m) => "ERR " + m.message), ...(j.validationResults?.warningMessages || []).map((m) => "WARN " + m.message)].join(" | ");

(async () => {
  const vatNo = "399999999900003";
  const seller: ZParty = { name: "بن سلمه العقارية", vatNo, crNo: "7041122982", street: "طريق الملك فهد", building: "1234", district: "الملقا", city: "الرياض", postal: "13521" };
  const buyerCr: ZParty = { name: "شركة المشتري", crNo: "1010010000", street: "شارع العليا", building: "4321", district: "العليا", city: "الرياض", postal: "12211" };
  const keys = generateKeyPair();
  const csr = buildCsr({ env: "sandbox", vatNo, orgName: "Bin Slmah Real Estate", orgUnit: "Riyadh Branch", commonName: "BinSlmah-CRM-test", serial: "1-BinSlmahCRM|2-1.0|3-" + randomUUID(), address: "Riyadh", category: "Real Estate" }, keys);
  const c = await post("/compliance", { csr: csr.base64 }, undefined, { OTP: "123345" });
  console.log("compliance", c.status, c.json.dispositionMessage);
  const comp = { token: c.json.binarySecurityToken, secret: c.json.secret };
  let cert = Buffer.from(comp.token, "base64").toString();
  let pih = FIRST_PIH, icv = 0;
  const mk = (kind: ZInvoice["kind"], docType: DocType, buyer: ZParty): ZInvoice => {
    const d = new Date(Date.now() + 3 * 3600e3).toISOString();
    return { no: "T-" + (icv + 1), uuid: randomUUID(), icv: ++icv, pih, issueDate: d.slice(0, 10), issueTime: d.slice(11, 19), kind, docType, billingRef: docType === "invoice" ? null : "T-1", reason: docType === "invoice" ? null : "إلغاء", supplyDate: d.slice(0, 10), seller, buyer, lines: [{ name: "عمولة تسويق", qty: 1, price: 2500, vatRate: 15 }] };
  };
  const cases: [ZInvoice["kind"], DocType, ZParty][] = [["standard", "invoice", buyerCr], ["standard", "credit", buyerCr], ["standard", "debit", buyerCr], ["simplified", "invoice", { name: "عميل" }], ["simplified", "credit", { name: "عميل" }], ["simplified", "debit", { name: "عميل" }]];
  for (const [k, dt, b] of cases) {
    const inv = mk(k, dt, b);
    const s = signInvoice(inv, cert, keys.privatePem);
    const r = await post("/compliance/invoices", { invoiceHash: s.invoiceHash, uuid: inv.uuid, invoice: Buffer.from(s.xml).toString("base64") }, comp);
    console.log("check", k, dt, r.status, brief(r.json));
    pih = s.invoiceHash;
  }
  // The sandbox production CSID is a fixed sample certificate not built on our key (it cannot
  // sign anything that validates), so the app keeps the compliance CSID there — see lib/zatca/server.ts.
  const p = await post("/production/csids", { compliance_request_id: String(c.json.requestID) }, comp);
  console.log("production csid", p.status, p.json.dispositionMessage);
})();
