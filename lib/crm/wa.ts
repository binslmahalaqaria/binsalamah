/**
 * Client for the WhatsApp link server in /wa-server (see its README). Every
 * call carries the signed-in user's Firebase ID token.
 */
import { auth } from "@/lib/firebase";
import { assertWritable } from "./preview";
import type { Client, Demand } from "./types";
import { areaRange } from "./logic";
import { intl, splitList } from "./util";

// The WhatsApp server runs on Railway (always on, see wa-server/README.md); override with NEXT_PUBLIC_WA_SERVER_URL (e.g. http://localhost:4100).
export const WA_SERVER = process.env.NEXT_PUBLIC_WA_SERVER_URL || "https://binsalamah-production.up.railway.app";

/** A linked number ("source"): company numbers or an employee's own. */
export interface WaSource {
  id: string;
  label: string;
  kind: "company" | "personal";
  ownerUid: string | null;
  /** New conversations on this number belong to this employee. */
  defaultAssignee: string | null;
  /** "team": everyone with WhatsApp access sees it (employees: their clients only); "private": owner, default employee, managers. */
  visibility: "team" | "private";
  status: string;
  me: { id: string; name: string | null } | null;
  since: number | null;
  unread: number;
  qr: string | null;
  /** Set by the server when a link was refused (e.g. the same phone is already linked as another number). */
  warn?: string | null;
  canManage: boolean;
  /** History sync from the phone: percent (when known) and whether it finished. */
  sync: { progress: number | null; done: boolean; at: number | null } | null;
  chats: number;
  /** Chats WhatsApp shows only under a hidden id (no phone number yet). */
  hidden: number;
  /** "Pull all conversations" job: chats finished / total, messages added this run. */
  backfill: { running: boolean; done: number; total: number; added: number; startedAt: number | null } | null;
}
export interface WaChat {
  jid: string; source: string; name: string | null; phone: string | null; last?: string; lastFromMe?: boolean; ts: number; unread: number; tags: string[];
  /** WhatsApp Business label ids on this chat. */
  labels?: string[];
  /** A labelled chat older than the history synced from the phone: listed, but no messages are stored. */
  old?: boolean;
}
/** A WhatsApp Business label (التصنيف), per linked number. */
export interface WaLabel { id: string; name: string; color: number; source: string }
/** WhatsApp's 20 label colours, by colour index. */
export const WA_LABEL_COLORS = [
  "#ff9485", "#64c4ff", "#ffd429", "#dfaef0", "#99b6c1", "#55ccb3", "#ff9dff", "#d3a91d", "#6d7cce", "#d7e752",
  "#00d0e2", "#ffc5c7", "#93ceac", "#f74848", "#00a0f2", "#83e422", "#ffaf04", "#b5ebff", "#9ba6ff", "#9368cf",
];
/** Media on a message; the file itself comes from wa-server's /api/media. */
export interface WaMedia { kind: "audio" | "image" | "video" | "document" | "sticker"; mime: string; secs?: number; ptt?: boolean; caption?: string | null; name?: string; size?: number }
export interface WaMsg { id: string; fromMe: boolean; text: string; ts: number; media?: WaMedia; pending?: boolean }

export async function waApi<T>(p: string, body?: object): Promise<T> {
  if (body) assertWritable(); // no sending, tagging or linking while previewing as an employee
  const token = await auth?.currentUser?.getIdToken();
  // A stopped or restarting server (Railway) used to leave the request hanging for minutes, so the WhatsApp page
  // sat on «جارٍ الاتصال…». Give up after a few seconds so the page can say the service is down instead.
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), body ? 60000 : 10000); // sending media can take longer than reading
  try {
    const r = await fetch(WA_SERVER + p, {
      method: body ? "POST" : "GET",
      headers: { Authorization: "Bearer " + token, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  } finally {
    clearTimeout(timer);
  }
}

/** 9665XXXXXXXX → 05XXXXXXXX (Saudi mobiles); other countries keep the + form. */
export const localPhone = (intl: string | null | undefined) =>
  !intl ? "" : intl.startsWith("9665") ? "0" + intl.slice(3) : "+" + intl;

export const waTime = (ts: number) => {
  const d = new Date(ts), now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit" })
    : d.getDate() + "/" + (d.getMonth() + 1); // built by hand: the Arabic locale adds direction marks that flip "11/10"
};

export const WA_STATUS_AR: Record<string, string> = {
  open: "متصل", qr: "بانتظار الربط", loggedOut: "غير مربوط", reconnecting: "جارٍ إعادة الاتصال", starting: "جارٍ التشغيل", error: "خطأ", stopped: "متوقف",
};
/** Whether this user sees every chat of the source, or only chats with their own clients. */
export const seesAllOf = (s: WaSource, uid: string, isMgr: boolean) =>
  isMgr || s.ownerUid === uid || s.defaultAssignee === uid;

/**
 * The client's full request as a WhatsApp message, for the employee to send from
 * the CRM so the client can confirm it. Uses the given request, or the client's
 * own demand fields when no request exists yet. Lines with no value are left out.
 */
export function requestMessage(c: Client, r: Demand | null | undefined, staffName: string) {
  const x: Demand = r || c;
  const money = (n: number) => (n >= 1e6 ? Math.round(n / 1e4) / 100 + " مليون ريال" : Math.round(n).toLocaleString("en-US") + " ريال");
  const types = Array.isArray(x.propTypes) ? x.propTypes : [];
  const districts = splitList(x.districts);
  const lines = [
    x.purpose ? "• نوع الطلب: " + x.purpose : "",
    types.length ? "• نوع العقار: " + types.join("، ") : "",
    districts.length ? "• الأحياء: " + districts.join("، ") : "",
    x.budget ? "• الميزانية: حتى " + money(x.budget) : "",
    x.payment ? "• طريقة الدفع: " + x.payment + (x.bank ? " (" + x.bank + ")" : "") : "",
    areaRange(x) ? "• المساحة: " + areaRange(x) : "",
    x.bedroomsMin ? "• عدد الغرف: " + x.bedroomsMin + " فأكثر" : "",
    x.floors?.length ? "• الدور المطلوب: " + x.floors.join("، ") : "",
    x.requirements ? "• تفاصيل إضافية: " + x.requirements : "",
  ].filter(Boolean);
  const first = (c.name || "").trim().split(/\s+/)[0];
  const hello = first && !/^[+\d٠-٩]/.test(first) ? "السلام عليكم " + first + "،" : "السلام عليكم،";
  return [
    hello,
    "معك " + staffName + " من بن سلمه العقارية.",
    "",
    lines.length ? "هذا ملخص طلبك المسجّل لدينا:" : "يسعدنا خدمتك، نرجو تزويدنا بتفاصيل طلبك (نوع العقار، الحي، الميزانية).",
    ...lines,
    "",
    lines.length ? "نرجو تأكيد البيانات أو تعديل ما يلزم، وسنرسل لك الخيارات المناسبة أولاً بأول." : "",
  ].filter((l, i, a) => l !== "" || (i > 0 && a[i - 1] !== "")).join("\n").trim();
}

/** Internal link that opens the CRM's WhatsApp inbox on this number, with an optional draft. */
export const waInboxHref = (phone: string | null | undefined, text?: string) => {
  const p = intl(phone);
  return p ? "/admin/whatsapp?phone=" + p + (text ? "&text=" + encodeURIComponent(text) : "") : null;
};
