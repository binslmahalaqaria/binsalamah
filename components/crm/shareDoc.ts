/**
 * CRM documents (invoice, receipt) as real PDF files (client 2026-10-21: not images).
 * `docPdf` sends the element's HTML with the page's stylesheets to /api/pdf, which
 * renders it in print mode with a headless browser. `sendDocWhatsApp` sends that PDF
 * to the client through the CRM's WhatsApp (company number first); without a linked
 * number or WhatsApp access it downloads the PDF and opens wa.me to attach it by hand.
 */
import { auth } from "@/lib/firebase";
import { can, type CrmData } from "@/lib/crm/logic";
import { intl, waLink } from "@/lib/crm/util";
import { seesAllOf, waApi, type WaSource } from "@/lib/crm/wa";

export async function docPdf(el: HTMLElement): Promise<Blob> {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error("signed_out");
  // The page's CSS inlined (linked stylesheets fail to load in the headless renderer — cross-origin),
  // with relative url(...) (fonts, images) made absolute against each stylesheet.
  const css = Array.from(document.styleSheets).map((sh) => {
    try {
      const base = sh.href || location.href;
      return Array.from(sh.cssRules).map((r) => r.cssText).join("\n")
        .replace(/url\((['"]?)(?!data:|https?:|#)([^'")]+)\1\)/g, (_m, q, u) => "url(" + q + new URL(u, base).href + q + ")");
    } catch { return ""; }
  }).join("\n");
  const styles = "<style>" + css.replace(/<\/style/gi, "<\\/style") + "</style>";
  const html =
    `<!doctype html><html lang="ar" dir="rtl" class="${document.documentElement.className}"><head><meta charset="utf-8">${styles}` +
    `<style>@page{size:A4;margin:8mm}html,body{background:#fff!important}.crm-noprint{display:none!important}</style></head>` +
    `<body class="${document.body.className}"><div class="crm" dir="rtl" style="background:#fff;min-height:0">${el.outerHTML}</div></body></html>`;
  const res = await fetch("/api/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ html }),
  });
  if (!res.ok) throw new Error("pdf_" + res.status);
  return res.blob();
}

const toDataUrl = (b: Blob) =>
  new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = bad; r.readAsDataURL(b); });

export function saveBlob(b: Blob, fileName: string) {
  const url = URL.createObjectURL(b);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".pdf") ? fileName : fileName + ".pdf";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadDocPdf(el: HTMLElement, fileName: string) {
  saveBlob(await docPdf(el), fileName);
}

export async function sendDocWhatsApp(d: CrmData, el: HTMLElement, phone: string, caption: string, fileName: string): Promise<string> {
  const pdf = await docPdf(el);
  const file = fileName.endsWith(".pdf") ? fileName : fileName + ".pdf";
  const p = intl(phone);
  if (can(d, "whatsapp") && p) {
    const { sources } = await waApi<{ sources: WaSource[] }>("/api/sources").catch(() => ({ sources: [] as WaSource[] }));
    const open = sources.filter((x) => x.status === "open");
    const src = open.find((x) => x.kind === "company" && seesAllOf(x, d.uid, d.isMgr)) || open.find((x) => seesAllOf(x, d.uid, d.isMgr));
    if (src) {
      const dataUrl = (await toDataUrl(pdf)).replace(/^data:[^;,]*/, "data:application/pdf");
      await waApi("/api/send-media", { source: src.id, jid: p + "@s.whatsapp.net", dataUrl, caption, fileName: file });
      return "أُرسل للعميل ملف PDF على واتساب عبر «" + src.label + "»";
    }
  }
  saveBlob(pdf, file);
  const link = waLink(phone, caption);
  if (link) window.open(link, "_blank", "noopener");
  return "نُزّل ملف PDF — أرفقه في محادثة واتساب التي فُتحت";
}
