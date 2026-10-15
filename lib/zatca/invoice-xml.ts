/**
 * ZATCA Phase 2 invoice document: UBL 2.1 XML for standard (B2B, clearance) and
 * simplified (B2C, reporting) tax invoices, credit and debit notes; then the
 * cryptographic stamp — invoice hash, ECDSA signature, XAdES signed properties,
 * and the Phase 2 QR (tags 1–9).
 *
 * The XML is written without any whitespace between elements and with attributes
 * and namespace declarations already in canonical order, so the bytes we hash are
 * exactly the C14N 1.1 form ZATCA's validator computes after its three XPath
 * transforms remove UBLExtensions, cac:Signature and the QR reference.
 * Server-only (uses the private key).
 */
import { createHash, createSign, X509Certificate } from "node:crypto";

export type DocType = "invoice" | "credit" | "debit";
export interface ZParty {
  name: string;
  vatNo?: string | null;
  crNo?: string | null; // seller: required (schemeID CRN)
  street?: string | null;
  building?: string | null;
  district?: string | null;
  city?: string | null;
  postal?: string | null;
  extra?: string | null;
}
export interface ZLine { name: string; qty: number; price: number; vatRate: number }
export interface ZInvoice {
  no: string;
  uuid: string;
  icv: number; // invoice counter value
  pih: string; // previous invoice hash (Base64); first invoice: SHA-256 of "0"
  issueDate: string; // YYYY-MM-DD
  issueTime: string; // HH:mm:ss
  kind: "standard" | "simplified";
  docType: DocType;
  billingRef?: string | null; // original invoice number for credit/debit notes
  reason?: string | null; // why a credit/debit note was issued
  supplyDate?: string | null;
  seller: ZParty;
  buyer: ZParty;
  lines: ZLine[];
}
/** PIH for the first invoice of an EGS unit. */
export const FIRST_PIH = "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escA = (s: string) => esc(s).replace(/"/g, "&quot;");
/** Element with optional attributes; empty content still gets an end tag (canonical form). */
const el = (name: string, content: string, attrs?: Record<string, string>) =>
  "<" + name + (attrs ? Object.entries(attrs).map(([k, v]) => " " + k + '="' + escA(v) + '"').join("") : "") + ">" + content + "</" + name + ">";
const t = (name: string, text: string | number, attrs?: Record<string, string>) => el(name, esc(String(text)), attrs);
const amt = (n: number) => n.toFixed(2);
const sar = { currencyID: "SAR" };
const r2 = (n: number) => Math.round(n * 100) / 100;

const TYPE_CODE: Record<DocType, string> = { invoice: "388", credit: "381", debit: "383" };

function party(p: ZParty, _seller: boolean) {
  const ids = p.crNo ? el("cac:PartyIdentification", t("cbc:ID", p.crNo, { schemeID: "CRN" })) : "";
  const addr = el("cac:PostalAddress",
    (p.street ? t("cbc:StreetName", p.street) : "") +
    (p.extra ? t("cbc:AdditionalStreetName", p.extra) : "") +
    (p.building ? t("cbc:BuildingNumber", p.building) : "") +
    (p.district ? t("cbc:CitySubdivisionName", p.district) : "") +
    (p.city ? t("cbc:CityName", p.city) : "") +
    (p.postal ? t("cbc:PostalZone", p.postal) : "") +
    el("cac:Country", t("cbc:IdentificationCode", "SA")));
  const tax = p.vatNo ? el("cac:PartyTaxScheme", t("cbc:CompanyID", p.vatNo) + el("cac:TaxScheme", t("cbc:ID", "VAT"))) : "";
  return el("cac:Party", ids + addr + tax + el("cac:PartyLegalEntity", t("cbc:RegistrationName", p.name)));
}

export function totalsOf(lines: ZLine[]) {
  const rows = lines.map((l) => { const base = r2(l.qty * l.price); const vat = r2((base * l.vatRate) / 100); return { ...l, base, vat }; });
  const sub = r2(rows.reduce((s, x) => s + x.base, 0));
  const vat = r2(rows.reduce((s, x) => s + x.vat, 0));
  return { rows, sub, vat, total: r2(sub + vat) };
}

/** The document body; `ublExt` and `qr` are filled in after signing (empty strings while hashing). */
export function buildXml(inv: ZInvoice, ublExt: string, qr: string) {
  const { rows, sub, vat, total } = totalsOf(inv.lines);
  const rate = inv.lines[0]?.vatRate ?? 15;
  const cat = rate > 0 ? "S" : "Z";
  const head =
    t("cbc:ProfileID", "reporting:1.0") + t("cbc:ID", inv.no) + t("cbc:UUID", inv.uuid) +
    t("cbc:IssueDate", inv.issueDate) + t("cbc:IssueTime", inv.issueTime) +
    t("cbc:InvoiceTypeCode", TYPE_CODE[inv.docType], { name: inv.kind === "standard" ? "0100000" : "0200000" }) +
    t("cbc:DocumentCurrencyCode", "SAR") + t("cbc:TaxCurrencyCode", "SAR") +
    (inv.docType !== "invoice" && inv.billingRef ? el("cac:BillingReference", el("cac:InvoiceDocumentReference", t("cbc:ID", inv.billingRef))) : "") +
    el("cac:AdditionalDocumentReference", t("cbc:ID", "ICV") + t("cbc:UUID", inv.icv)) +
    el("cac:AdditionalDocumentReference", t("cbc:ID", "PIH") + el("cac:Attachment", t("cbc:EmbeddedDocumentBinaryObject", inv.pih, { mimeCode: "text/plain" })));
  const qrRef = el("cac:AdditionalDocumentReference", t("cbc:ID", "QR") + el("cac:Attachment", t("cbc:EmbeddedDocumentBinaryObject", qr, { mimeCode: "text/plain" })));
  const sig = el("cac:Signature", t("cbc:ID", "urn:oasis:names:specification:ubl:signature:Invoice") + t("cbc:SignatureMethod", "urn:oasis:names:specification:ubl:dsig:enveloped:xades"));
  const body =
    el("cac:AccountingSupplierParty", party(inv.seller, true)) +
    el("cac:AccountingCustomerParty", party(inv.buyer, false)) +
    (inv.supplyDate ? el("cac:Delivery", t("cbc:ActualDeliveryDate", inv.supplyDate)) : "") +
    el("cac:PaymentMeans", t("cbc:PaymentMeansCode", "10") + (inv.docType !== "invoice" && inv.reason ? t("cbc:InstructionNote", inv.reason) : "")) +
    el("cac:TaxTotal", t("cbc:TaxAmount", amt(vat), sar)) +
    el("cac:TaxTotal", t("cbc:TaxAmount", amt(vat), sar) + el("cac:TaxSubtotal",
      t("cbc:TaxableAmount", amt(sub), sar) + t("cbc:TaxAmount", amt(vat), sar) +
      el("cac:TaxCategory", t("cbc:ID", cat) + t("cbc:Percent", rate.toFixed(2)) +
        (cat === "Z" ? t("cbc:TaxExemptionReasonCode", "VATEX-SA-OOS") + t("cbc:TaxExemptionReason", "Not subject to VAT") : "") +
        el("cac:TaxScheme", t("cbc:ID", "VAT"))))) +
    el("cac:LegalMonetaryTotal",
      t("cbc:LineExtensionAmount", amt(sub), sar) + t("cbc:TaxExclusiveAmount", amt(sub), sar) + t("cbc:TaxInclusiveAmount", amt(total), sar) +
      t("cbc:AllowanceTotalAmount", "0.00", sar) + t("cbc:PrepaidAmount", "0.00", sar) + t("cbc:PayableAmount", amt(total), sar)) +
    rows.map((l, i) => el("cac:InvoiceLine",
      t("cbc:ID", i + 1) + t("cbc:InvoicedQuantity", l.qty.toFixed(6), { unitCode: "PCE" }) + t("cbc:LineExtensionAmount", amt(l.base), sar) +
      el("cac:TaxTotal", t("cbc:TaxAmount", amt(l.vat), sar) + t("cbc:RoundingAmount", amt(r2(l.base + l.vat)), sar)) +
      el("cac:Item", t("cbc:Name", l.name) + el("cac:ClassifiedTaxCategory", t("cbc:ID", l.vatRate > 0 ? "S" : "Z") + t("cbc:Percent", l.vatRate.toFixed(2)) + el("cac:TaxScheme", t("cbc:ID", "VAT")))) +
      el("cac:Price", t("cbc:PriceAmount", l.price.toFixed(2), sar)))).join("");
  const ns = ' xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"';
  return { root: "<Invoice" + ns + ">", ublExt, head, qrRef, sig, body, total, vat, sub };
}

/** What ZATCA hashes: the invoice without UBLExtensions, cac:Signature and the QR reference, canonical form. */
const pure = (p: ReturnType<typeof buildXml>) => p.root + p.head + p.body + "</Invoice>";
const full = (p: ReturnType<typeof buildXml>) => '<?xml version="1.0" encoding="UTF-8"?>' + p.root + p.ublExt + p.head + p.qrRef + p.sig + p.body + "</Invoice>";

/** The SignedProperties exactly as ZATCA re-renders them to check their digest (spacing included). */
function signedPropsForHash(time: string, certHash: string, issuer: string, serial: string) {
  return `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">
                                    <xades:SignedSignatureProperties>
                                        <xades:SigningTime>${time}</xades:SigningTime>
                                        <xades:SigningCertificate>
                                            <xades:Cert>
                                                <xades:CertDigest>
                                                    <ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                                                    <ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${certHash}</ds:DigestValue>
                                                </xades:CertDigest>
                                                <xades:IssuerSerial>
                                                    <ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${issuer}</ds:X509IssuerName>
                                                    <ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${serial}</ds:X509SerialNumber>
                                                </xades:IssuerSerial>
                                            </xades:Cert>
                                        </xades:SigningCertificate>
                                    </xades:SignedSignatureProperties>
                                </xades:SignedProperties>`;
}

/** TLV (tag, length, bytes). */
function tlv(entries: [number, Buffer][]) {
  return Buffer.concat(entries.map(([tag, v]) => Buffer.concat([Buffer.from([tag, v.length]), v]))).toString("base64");
}

/** Reads the parts of the certificate the stamp needs. `certB64` is the Base64 DER body ("MIIC…"). */
export function certInfo(certB64: string) {
  const der = Buffer.from(certB64, "base64");
  const x = new X509Certificate(der);
  // signatureValue: the BIT STRING after signatureAlgorithm at the end of the certificate.
  const sigStart = der.lastIndexOf(Buffer.from([0x03]), der.length - 2);
  const spki = x.publicKey.export({ type: "spki", format: "der" }) as Buffer;
  return {
    hash: Buffer.from(createHash("sha256").update(certB64).digest("hex")).toString("base64"),
    issuer: x.issuer.split("\n").reverse().join(", "),
    serial: BigInt("0x" + x.serialNumber).toString(10),
    publicKey: spki,
    signature: certSignature(der) ?? der.subarray(sigStart),
  };
}
/** The certificate's signatureValue bytes (BIT STRING content without the unused-bits byte). */
function certSignature(der: Buffer): Buffer | null {
  const readLen = (p: number): [number, number] => {
    const b = der[p];
    if (b < 0x80) return [b, p + 1];
    const n = b & 0x7f;
    let v = 0;
    for (let i = 0; i < n; i++) v = v * 256 + der[p + 1 + i];
    return [v, p + 1 + n];
  };
  if (der[0] !== 0x30) return null;
  let [, p] = readLen(1); // outer SEQUENCE content start
  const skip = (q: number) => { const [l, s] = readLen(q + 1); return s + l; };
  p = skip(p); // tbsCertificate
  p = skip(p); // signatureAlgorithm
  if (der[p] !== 0x03) return null;
  const [l, s] = readLen(p + 1);
  return der.subarray(s + 1, s + l);
}

/** Hashes, signs and stamps the invoice; returns the final XML, its hash (the next PIH) and the QR. */
export function signInvoice(inv: ZInvoice, certB64: string, privatePem: string, signingTime = new Date()) {
  const draft = buildXml(inv, "", "");
  const invoiceHash = createHash("sha256").update(pure(draft), "utf8").digest("base64");
  const signer = createSign("sha256");
  signer.update(Buffer.from(invoiceHash, "base64"));
  const signatureValue = signer.sign(privatePem).toString("base64");
  const ci = certInfo(certB64);
  const time = signingTime.toISOString().slice(0, 19);
  const spHash = Buffer.from(createHash("sha256").update(signedPropsForHash(time, ci.hash, ci.issuer, ci.serial), "utf8").digest("hex")).toString("base64");

  const signedProps =
    '<xades:SignedProperties Id="xadesSignedProperties"><xades:SignedSignatureProperties>' + t("xades:SigningTime", time) +
    "<xades:SigningCertificate><xades:Cert><xades:CertDigest>" +
    el("ds:DigestMethod", "", { Algorithm: "http://www.w3.org/2001/04/xmlenc#sha256" }) + t("ds:DigestValue", ci.hash) +
    "</xades:CertDigest><xades:IssuerSerial>" + t("ds:X509IssuerName", ci.issuer) + t("ds:X509SerialNumber", ci.serial) +
    "</xades:IssuerSerial></xades:Cert></xades:SigningCertificate></xades:SignedSignatureProperties></xades:SignedProperties>";
  const xpath = (x: string) => el("ds:Transform", t("ds:XPath", x), { Algorithm: "http://www.w3.org/TR/1999/REC-xpath-19991116" });
  const ublExt =
    "<ext:UBLExtensions><ext:UBLExtension>" + t("ext:ExtensionURI", "urn:oasis:names:specification:ubl:dsig:enveloped:xades") + "<ext:ExtensionContent>" +
    '<sig:UBLDocumentSignatures xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2" xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2" xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2">' +
    "<sac:SignatureInformation>" + t("cbc:ID", "urn:oasis:names:specification:ubl:signature:1") +
    t("sbc:ReferencedSignatureID", "urn:oasis:names:specification:ubl:signature:Invoice") +
    '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="signature"><ds:SignedInfo>' +
    el("ds:CanonicalizationMethod", "", { Algorithm: "http://www.w3.org/2006/12/xml-c14n11" }) +
    el("ds:SignatureMethod", "", { Algorithm: "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256" }) +
    '<ds:Reference Id="invoiceSignedData" URI=""><ds:Transforms>' +
    xpath("not(//ancestor-or-self::ext:UBLExtensions)") + xpath("not(//ancestor-or-self::cac:Signature)") +
    xpath("not(//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID='QR'])") +
    el("ds:Transform", "", { Algorithm: "http://www.w3.org/2006/12/xml-c14n11" }) + "</ds:Transforms>" +
    el("ds:DigestMethod", "", { Algorithm: "http://www.w3.org/2001/04/xmlenc#sha256" }) + t("ds:DigestValue", invoiceHash) + "</ds:Reference>" +
    '<ds:Reference Type="http://www.w3.org/2000/09/xmldsig#SignatureProperties" URI="#xadesSignedProperties">' +
    el("ds:DigestMethod", "", { Algorithm: "http://www.w3.org/2001/04/xmlenc#sha256" }) + t("ds:DigestValue", spHash) + "</ds:Reference>" +
    "</ds:SignedInfo>" + t("ds:SignatureValue", signatureValue) +
    "<ds:KeyInfo><ds:X509Data>" + t("ds:X509Certificate", certB64) + "</ds:X509Data></ds:KeyInfo>" +
    '<ds:Object><xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="signature">' + signedProps + "</xades:QualifyingProperties></ds:Object>" +
    "</ds:Signature></sac:SignatureInformation></sig:UBLDocumentSignatures></ext:ExtensionContent></ext:UBLExtension></ext:UBLExtensions>";

  const tags: [number, Buffer][] = [
    [1, Buffer.from(inv.seller.name, "utf8")],
    [2, Buffer.from(inv.seller.vatNo || "", "utf8")],
    [3, Buffer.from(inv.issueDate + "T" + inv.issueTime, "utf8")],
    [4, Buffer.from(amt(draft.total), "utf8")],
    [5, Buffer.from(amt(draft.vat), "utf8")],
    [6, Buffer.from(invoiceHash, "utf8")],
    [7, Buffer.from(signatureValue, "utf8")],
    [8, ci.publicKey],
  ];
  if (inv.kind === "simplified") tags.push([9, ci.signature]);
  const qr = tlv(tags);
  const xml = full(buildXml(inv, ublExt, qr));
  return { xml, invoiceHash, qr, signatureValue };
}
