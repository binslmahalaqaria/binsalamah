/**
 * Sends a printable document (invoice, receipt) to a client on WhatsApp as an
 * image: renders the element to JPEG in the browser, then sends it through the
 * CRM's WhatsApp (company number first). Without a linked number or WhatsApp
 * access it downloads the image and opens wa.me so it can be attached by hand.
 */
import { toJpeg } from "html-to-image";
import { can, type CrmData } from "@/lib/crm/logic";
import { intl, waLink } from "@/lib/crm/util";
import { seesAllOf, waApi, type WaSource } from "@/lib/crm/wa";

export async function sendDocWhatsApp(d: CrmData, el: HTMLElement, phone: string, caption: string, fileName: string): Promise<string> {
  const img = await toJpeg(el, { pixelRatio: 2, quality: 0.92, backgroundColor: "#ffffff", cacheBust: true });
  const p = intl(phone);
  if (can(d, "whatsapp") && p) {
    const { sources } = await waApi<{ sources: WaSource[] }>("/api/sources").catch(() => ({ sources: [] as WaSource[] }));
    const open = sources.filter((x) => x.status === "open");
    const src = open.find((x) => x.kind === "company" && seesAllOf(x, d.uid, d.isMgr)) || open.find((x) => seesAllOf(x, d.uid, d.isMgr));
    if (src) {
      await waApi("/api/send-media", { source: src.id, jid: p + "@s.whatsapp.net", dataUrl: img, caption });
      return "أُرسل للعميل على واتساب عبر «" + src.label + "»";
    }
  }
  const a = document.createElement("a");
  a.href = img;
  a.download = fileName + ".jpg";
  a.click();
  const link = waLink(phone, caption);
  if (link) window.open(link, "_blank", "noopener");
  return "نُزّلت الصورة — أرفقها في محادثة واتساب التي فُتحت";
}
