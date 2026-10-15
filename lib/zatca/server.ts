import "server-only";
/**
 * ZATCA Phase 2 — server side. Two jobs:
 *  1. onboard(): the owner gives the OTP from the Fatoora portal; we create the
 *     EGS key + CSR, get the compliance CSID, pass ZATCA's six compliance checks
 *     automatically, then get the production CSID.
 *  2. submit(): sign an issued invoice and report it (simplified) or clear it
 *     (standard), keeping the ICV / previous-invoice-hash chain.
 * State lives in Firestore `zatca/egs`, read and written with the caller's own
 * ID token (no service account needed). The private key and the CSID secrets
 * are stored AES-256-GCM-encrypted with ZATCA_ENC_KEY, which only this server
 * knows — so the stored values are useless to anyone reading the database.
 */
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { buildCsr, generateKeyPair, type ZatcaEnv } from "./csr";
import { FIRST_PIH, signInvoice, type DocType, type ZInvoice, type ZParty } from "./invoice-xml";

const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/`;
const BASE: Record<ZatcaEnv, string> = {
  sandbox: "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal",
  simulation: "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation",
  production: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core",
};
const SELLER_NAME = "بن سلمه العقارية";

/* ---------------- caller ---------------- */
const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
export async function caller(token: string) {
  const { payload } = await jwtVerify(token, jwks, { issuer: "https://securetoken.google.com/" + PROJECT, audience: PROJECT });
  const s = await getDoc("staff/" + payload.sub, token);
  if (!s || s.active !== true) return null;
  return { uid: String(payload.sub), role: String(s.role || "sales") };
}

/* ---------------- Firestore REST ---------------- */
type V = { stringValue?: string; integerValue?: string; doubleValue?: number; booleanValue?: boolean; nullValue?: null; arrayValue?: { values?: V[] }; mapValue?: { fields?: Record<string, V> }; timestampValue?: string };
function fromV(v: V): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue?.values || []).map(fromV);
  if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue?.fields || {}).map(([k, x]) => [k, fromV(x)]));
  return null;
}
function toV(x: unknown): V {
  if (x === null || x === undefined) return { nullValue: null };
  if (typeof x === "string") return { stringValue: x };
  if (typeof x === "boolean") return { booleanValue: x };
  if (typeof x === "number") return Number.isInteger(x) ? { integerValue: String(x) } : { doubleValue: x };
  if (Array.isArray(x)) return { arrayValue: { values: x.map(toV) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(x as Record<string, unknown>).map(([k, y]) => [k, toV(y)])) } };
}
export async function getDoc(path: string, token: string): Promise<(Record<string, unknown> & { _updateTime?: string }) | null> {
  const r = await fetch(DOCS + path, { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("read " + path + " " + r.status);
  const j = await r.json();
  return { ...(fromV({ mapValue: { fields: j.fields || {} } }) as Record<string, unknown>), _updateTime: j.updateTime };
}
/** Merge-writes the given fields; with `updateTime` the write fails if the doc changed meanwhile. */
export async function patchDoc(path: string, data: Record<string, unknown>, token: string, updateTime?: string) {
  const q = Object.keys(data).map((k) => "updateMask.fieldPaths=" + encodeURIComponent(k)).join("&") + (updateTime ? "&currentDocument.updateTime=" + encodeURIComponent(updateTime) : "");
  const r = await fetch(DOCS + path + "?" + q, {
    method: "PATCH", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toV(v)])) }),
  });
  if (!r.ok) throw Object.assign(new Error("write " + path + " " + r.status), { status: r.status });
}

/* ---------------- secrets ---------------- */
function encKey() {
  const k = process.env.ZATCA_ENC_KEY;
  if (!k) throw new Error("no_enc_key");
  const b = Buffer.from(k, "base64");
  if (b.length !== 32) throw new Error("bad_enc_key");
  return b;
}
export function seal(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", encKey(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}
export function unseal(sealed: string) {
  const [iv, tag, data] = sealed.split(".").map((s) => Buffer.from(s, "base64"));
  const d = createDecipheriv("aes-256-gcm", encKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}

/* ---------------- ZATCA API ---------------- */
async function zatca(env: ZatcaEnv, path: string, body: unknown, auth?: { token: string; secret: string } | null, extra: Record<string, string> = {}) {
  const r = await fetch(BASE[env] + path, {
    method: "POST",
    headers: {
      accept: "application/json", "Accept-Language": "ar", "Accept-Version": "V2", "Content-Type": "application/json",
      ...(auth ? { Authorization: "Basic " + Buffer.from(auth.token + ":" + auth.secret).toString("base64") } : {}), ...extra,
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json: Record<string, unknown> = {};
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 500) }; }
  return { status: r.status, json };
}
type Msg = { code?: string; message?: string };
const msgs = (v: unknown) => ((v as Msg[] | undefined) || []).map((m) => (m.code ? m.code + ": " : "") + (m.message || ""));
function results(json: Record<string, unknown>) {
  const v = (json.validationResults || {}) as { status?: string; errorMessages?: Msg[]; warningMessages?: Msg[] };
  return { status: v.status || "", errors: msgs(v.errorMessages), warnings: msgs(v.warningMessages) };
}

/* ---------------- seller from settings ---------------- */
async function sellerOf(token: string): Promise<ZParty & { name: string }> {
  const s = (await getDoc("crm/settings", token)) || {};
  return {
    name: SELLER_NAME, vatNo: (s.vatNo as string) || null, crNo: (s.crNo as string) || null, street: (s.addrStreet as string) || null,
    building: (s.addrBuilding as string) || null, district: (s.addrDistrict as string) || null, city: (s.addrCity as string) || null,
    postal: (s.addrPostal as string) || null, extra: (s.addrExtra as string) || null,
  };
}
const riyadh = (d: Date) => {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
    .formatToParts(d).reduce((a, x) => ({ ...a, [x.type]: x.value }), {} as Record<string, string>);
  return { date: p.year + "-" + p.month + "-" + p.day, time: (p.hour === "24" ? "00" : p.hour) + ":" + p.minute + ":" + p.second };
};

/* ---------------- onboarding ---------------- */
export async function onboard(token: string, env: ZatcaEnv, otp: string, log: (s: string) => void) {
  const seller = await sellerOf(token);
  const vatNo = seller.vatNo || (env === "sandbox" ? "399999999900003" : "");
  if (!/^3\d{13}3$/.test(vatNo)) throw new Error("الرقم الضريبي للمنشأة غير صحيح أو غير مُدخل (15 رقماً يبدأ وينتهي بـ 3)");
  if (env !== "sandbox" && (!seller.crNo || !seller.city || !seller.street || !seller.building || !seller.postal || !seller.district))
    throw new Error("أكمل العنوان الوطني والسجل التجاري في بيانات المنشأة قبل الربط");
  const sellerX = { ...seller, vatNo };
  const keys = generateKeyPair();
  const unitId = randomUUID();
  const csr = buildCsr({
    env, vatNo, orgName: "Bin Slmah Real Estate", orgUnit: (seller.city || "Riyadh") + " Branch", commonName: "BinSlmah-CRM-" + unitId.slice(0, 8),
    serial: "1-BinSlmahCRM|2-1.0|3-" + unitId, address: [seller.building, seller.street, seller.district, seller.city].filter(Boolean).join(" ") || "Riyadh",
    category: "Real Estate",
  }, keys);
  log("طلب شهادة الامتثال");
  const c = await zatca(env, "/compliance", { csr: csr.base64 }, null, { OTP: otp });
  if (c.status !== 200 || !c.json.binarySecurityToken) throw new Error("رفضت الهيئة طلب الربط: " + (msgs(c.json.errors).join("، ") || JSON.stringify(c.json).slice(0, 300)));
  const compliance = { token: String(c.json.binarySecurityToken), secret: String(c.json.secret) };
  const cert = Buffer.from(compliance.token, "base64").toString("utf8");

  // The six compliance checks: invoice / credit / debit, simplified and standard.
  const buyerStd: ZParty = { name: "شركة اختبار الامتثال", vatNo: "399999999800003", street: "شارع العليا", building: "4321", district: "العليا", city: "الرياض", postal: "12211" };
  let pih = FIRST_PIH;
  const checks: { name: string; ok: boolean; info: string }[] = [];
  const cases: [ZInvoice["kind"], DocType][] = [["standard", "invoice"], ["standard", "credit"], ["standard", "debit"], ["simplified", "invoice"], ["simplified", "credit"], ["simplified", "debit"]];
  for (const [i, [kind, docType]] of cases.entries()) {
    const t = riyadh(new Date());
    const inv: ZInvoice = {
      no: "CMP-" + (i + 1), uuid: randomUUID(), icv: i + 1, pih, issueDate: t.date, issueTime: t.time, kind, docType,
      billingRef: docType === "invoice" ? null : "CMP-1", reason: docType === "invoice" ? null : "اختبار الامتثال", supplyDate: t.date,
      seller: sellerX, buyer: kind === "standard" ? buyerStd : { name: "عميل فرد" }, lines: [{ name: "عمولة تسويق عقار", qty: 1, price: 1000, vatRate: 15 }],
    };
    const s = signInvoice(inv, cert, keys.privatePem);
    const r = await zatca(env, "/compliance/invoices", { invoiceHash: s.invoiceHash, uuid: inv.uuid, invoice: Buffer.from(s.xml).toString("base64") }, compliance);
    const v = results(r.json);
    const name = (kind === "standard" ? "ضريبية" : "مبسطة") + " — " + ({ invoice: "فاتورة", credit: "إشعار دائن", debit: "إشعار مدين" } as const)[docType];
    checks.push({ name, ok: r.status === 200 && v.status !== "ERROR", info: [...v.errors, ...v.warnings].join("، ") || String(r.json.reportingStatus || r.json.clearanceStatus || r.status) });
    log("فحص " + name + ": " + (checks[i].ok ? "نجح" : "فشل"));
    pih = s.invoiceHash;
  }
  if (!checks.every((x) => x.ok)) {
    await patchDoc("zatca/egs", { status: "فشل الفحص", env, checks, updatedAt: new Date().toISOString() }, token);
    throw new Error("لم تنجح كل فحوصات الامتثال: " + checks.filter((x) => !x.ok).map((x) => x.name + " (" + x.info + ")").join("؛ "));
  }

  log("طلب الشهادة الإنتاجية");
  const p = await zatca(env, "/production/csids", { compliance_request_id: String(c.json.requestID) }, compliance);
  if (p.status !== 200 || !p.json.binarySecurityToken) throw new Error("تعذّر إصدار الشهادة الإنتاجية: " + JSON.stringify(p.json).slice(0, 300));
  // The developer-portal sandbox hands out a fixed sample production certificate that is not
  // built on our key, so invoices signed with it can never validate there. In the sandbox we
  // keep signing with the compliance certificate and send through the compliance-check API
  // (same validation); simulation and production use the real production certificate.
  const use = env === "sandbox" ? { token: compliance.token, secret: compliance.secret } : { token: String(p.json.binarySecurityToken), secret: String(p.json.secret) };
  await patchDoc("zatca/egs", {
    status: "مربوط", env, unitId, vatNo, checks, onboardedAt: new Date().toISOString(),
    cert: Buffer.from(use.token, "base64").toString("utf8"), prodToken: use.token, prodSecret: seal(use.secret), privateKey: seal(keys.privatePem),
    icv: 0, pih: FIRST_PIH, updatedAt: new Date().toISOString(),
  }, token);
  // Non-secret flags the app reads from settings (to submit automatically after issuing).
  await patchDoc("crm/settings", { zatcaOn: true, zatcaEnv: env }, token);
  return { env, checks };
}

/* ---------------- per-invoice submission ---------------- */
type InvoiceDoc = {
  no: string; status: string; kind: "standard" | "simplified"; docType?: DocType; billingRef?: string | null; reason?: string | null;
  issueAt: string; supplyDate?: string | null; buyerName: string; buyerVat?: string | null; buyerCr?: string | null;
  buyerStreet?: string | null; buyerBuilding?: string | null; buyerDistrict?: string | null; buyerCity?: string | null; buyerPostal?: string | null;
  lines: { desc: string; qty: number; price: number }[]; vatRate: number; zatca?: { status?: string; uuid?: string };
};
export async function submit(token: string, invoiceId: string) {
  const egs = await getDoc("zatca/egs", token);
  if (!egs || egs.status !== "مربوط") throw new Error("النظام غير مربوط بالهيئة بعد");
  const inv = (await getDoc("invoices/" + invoiceId, token)) as unknown as InvoiceDoc | null;
  if (!inv || inv.status === "مسودة") throw new Error("الفاتورة غير صادرة");
  if (inv.zatca?.status === "معتمدة" || inv.zatca?.status === "مُبلّغ عنها") return { already: true };
  const env = egs.env as ZatcaEnv;
  const seller = { ...(await sellerOf(token)), vatNo: String(egs.vatNo) };
  const icv = Number(egs.icv || 0) + 1;
  const pih = String(egs.pih || FIRST_PIH);
  const uuid = inv.zatca?.uuid || randomUUID();
  const t = riyadh(new Date(inv.issueAt));
  const zi: ZInvoice = {
    no: inv.no, uuid, icv, pih, issueDate: t.date, issueTime: t.time, kind: inv.kind, docType: inv.docType || "invoice",
    billingRef: inv.billingRef || null, reason: inv.reason || null, supplyDate: inv.supplyDate || t.date, seller,
    buyer: inv.kind === "standard"
      ? { name: inv.buyerName, vatNo: inv.buyerVat || null, crNo: inv.buyerVat ? null : inv.buyerCr || null, street: inv.buyerStreet || null, building: inv.buyerBuilding || null,
          district: inv.buyerDistrict || null, city: inv.buyerCity || null, postal: inv.buyerPostal || null }
      : { name: inv.buyerName },
    lines: inv.lines.map((l) => ({ name: l.desc || "خدمة", qty: Number(l.qty) || 1, price: Number(l.price) || 0, vatRate: Number(inv.vatRate) })),
  };
  const s = signInvoice(zi, String(egs.cert), unseal(String(egs.privateKey)));
  const auth = { token: String(egs.prodToken), secret: unseal(String(egs.prodSecret)) };
  const std = inv.kind === "standard";
  const path = env === "sandbox" ? "/compliance/invoices" : std ? "/invoices/clearance/single" : "/invoices/reporting/single";
  const r = await zatca(env, path,
    { invoiceHash: s.invoiceHash, uuid, invoice: Buffer.from(s.xml).toString("base64") }, auth, std ? { "Clearance-Status": "1" } : {});
  const v = results(r.json);
  const ok = (r.status === 200 || r.status === 202) && v.status !== "ERROR";
  let qr = s.qr;
  let xml = s.xml;
  if (ok && std && r.json.clearedInvoice) {
    // A cleared invoice comes back stamped by ZATCA; its QR is the one to print.
    xml = Buffer.from(String(r.json.clearedInvoice), "base64").toString("utf8");
    const m = /<cbc:ID>QR<\/cbc:ID>\s*<cac:Attachment>\s*<cbc:EmbeddedDocumentBinaryObject[^>]*>([^<]+)</.exec(xml);
    if (m) qr = m[1];
  }
  const zatcaField = {
    status: ok ? (std ? "معتمدة" : "مُبلّغ عنها") : "مرفوضة", env, uuid, icv, hash: s.invoiceHash, qr: ok ? qr : null,
    errors: v.errors, warnings: v.warnings, httpStatus: r.status, submittedAt: new Date().toISOString(),
    xml: ok ? Buffer.from(xml).toString("base64") : null,
  };
  await patchDoc("invoices/" + invoiceId, { zatca: zatcaField }, token);
  if (ok) await patchDoc("zatca/egs", { icv, pih: s.invoiceHash, lastInvoice: inv.no, updatedAt: new Date().toISOString() }, token, egs._updateTime);
  return { ok, status: zatcaField.status, errors: v.errors, warnings: v.warnings };
}
