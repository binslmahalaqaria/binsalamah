/**
 * ZATCA e-invoicing (Phase 2) onboarding: the EGS unit's key pair and its
 * certificate signing request. ZATCA requires an EC key on secp256k1 and a CSR
 * whose subject is C=SA / OU / O / CN, with the certificate template-name
 * extension (1.3.6.1.4.1.311.20.2) and a subjectAltName directory name carrying
 * SN (solution | model | serial), UID (VAT number), title (invoice types,
 * "1100" = standard + simplified), registeredAddress and businessCategory.
 * Server-only: the private key must never reach a browser.
 */
import { KEYUTIL, KJUR } from "jsrsasign";

export type ZatcaEnv = "sandbox" | "simulation" | "production";
/** Template name per environment, as ZATCA expects in the CSR. */
const TEMPLATE: Record<ZatcaEnv, string> = { sandbox: "TSTZATCA-Code-Signing", simulation: "PREZATCA-Code-Signing", production: "ZATCA-Code-Signing" };

export interface CsrInput {
  env: ZatcaEnv;
  vatNo: string; // 15 digits, starts and ends with 3
  orgName: string; // O
  orgUnit: string; // OU — branch name, or the 10-digit TIN for VAT groups
  commonName: string; // CN — a name for this EGS unit
  serial: string; // "1-<solution>|2-<model>|3-<uuid>"
  invoiceTypes?: string; // default "1100"
  address: string; // registeredAddress
  category: string; // businessCategory
}

const toHex = (s: string) => Buffer.from(s, "utf8").toString("hex");
const len = (hex: string) => { const n = hex.length / 2; return n < 128 ? n.toString(16).padStart(2, "0") : "81" + n.toString(16).padStart(2, "0"); };
/** DER PrintableString / UTF8String as hex. */
const printable = (s: string) => { const h = toHex(s); return "13" + len(h) + h; };

export function generateKeyPair() {
  const kp = KEYUTIL.generateKeypair("EC", "secp256k1");
  const priv = KEYUTIL.getPEM(kp.prvKeyObj, "PKCS8PRV");
  const pub = KEYUTIL.getPEM(kp.pubKeyObj);
  return { privatePem: priv, publicPem: pub, prvKeyObj: kp.prvKeyObj, pubKeyObj: kp.pubKeyObj };
}

/** Builds and signs the CSR; returns it as PEM and as the Base64(PEM) string ZATCA's API takes. */
export function buildCsr(i: CsrInput, keys: { prvKeyObj: unknown; pubKeyObj: unknown }) {
  const csr = new KJUR.asn1.csr.CertificationRequest({
    subject: { array: [
      [{ type: "C", value: "SA", ds: "prn" }],
      [{ type: "OU", value: i.orgUnit, ds: "utf8" }],
      [{ type: "O", value: i.orgName, ds: "utf8" }],
      [{ type: "CN", value: i.commonName, ds: "utf8" }],
    ] },
    sbjpubkey: keys.pubKeyObj as never,
    extreq: [
      // Certificate template name, as ZATCA's OpenSSL config writes it (ASN1:PRINTABLESTRING:…).
      { extname: "1.3.6.1.4.1.311.20.2", extn: printable(TEMPLATE[i.env]) },
      { extname: "subjectAltName", array: [{ dn: { array: [
        [{ type: "2.5.4.4", value: i.serial, ds: "utf8" }],
        [{ type: "0.9.2342.19200300.100.1.1", value: i.vatNo, ds: "utf8" }],
        [{ type: "2.5.4.12", value: i.invoiceTypes || "1100", ds: "utf8" }],
        [{ type: "2.5.4.26", value: i.address, ds: "utf8" }],
        [{ type: "2.5.4.15", value: i.category, ds: "utf8" }],
      ] } }] },
    ] as never,
    sigalg: "SHA256withECDSA",
    sbjprvkey: keys.prvKeyObj as never,
  } as never);
  const pem = csr.getPEM();
  return { pem, base64: Buffer.from(pem, "utf8").toString("base64") };
}
