"use client";

/**
 * WhatsApp shortcuts for a client: open the CRM's own WhatsApp inbox on their
 * number (the company number, with the conversation history), and send them their
 * full request as a ready message to review before sending. Users without the
 * WhatsApp permission fall back to wa.me on their own phone.
 */
import { useRouter } from "@/i18n/navigation";
import { useCrm } from "@/lib/crm/store";
import { can, nameOf, reqsOf } from "@/lib/crm/logic";
import type { Client, Request } from "@/lib/crm/types";
import { waLink } from "@/lib/crm/util";
import { requestMessage, waInboxHref } from "@/lib/crm/wa";

function useOpenWa() {
  const { data } = useCrm();
  const router = useRouter();
  return (phone: string | null | undefined, text?: string) => {
    const inbox = can(data, "whatsapp") ? waInboxHref(phone, text) : null;
    if (inbox) return router.push(inbox);
    const ext = waLink(phone, text);
    if (ext) window.open(ext, "_blank", "noopener");
  };
}

/** "💬 واتساب" — chat with the client from the CRM. */
export function WaChatButton({ phone, small = true }: { phone: string | null | undefined; small?: boolean }) {
  const open = useOpenWa();
  if (!phone) return null;
  return (
    <button type="button" className={"crm-btn wa " + (small ? "sm" : "")} title="فتح المحادثة في واتساب النظام" onClick={(e) => { e.stopPropagation(); open(phone); }}>
      💬 واتساب
    </button>
  );
}

/** "📤 إرسال الطلب" — opens the chat with the client's full request written out, ready to send. */
export function SendRequestButton({ c, r, small = true }: { c: Client; r?: Request | null; small?: boolean }) {
  const { data } = useCrm();
  const open = useOpenWa();
  if (!c.phone) return null;
  const req = r === undefined ? reqsOf(data, c)[0] : r;
  return (
    <button type="button" className={"crm-btn " + (small ? "sm" : "")} title="رسالة واتساب فيها كامل طلب العميل لتأكيده"
      onClick={(e) => { e.stopPropagation(); open(c.phone, requestMessage(c, req, nameOf(data, data.uid))); }}>
      📤 إرسال الطلب
    </button>
  );
}
