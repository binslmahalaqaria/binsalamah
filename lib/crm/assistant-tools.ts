/**
 * Tools for the CRM AI assistant, ported from the original artifact CRM.
 * Each tool runs in the browser against the live CRM data and writes with
 * the signed-in staff member's own Firestore permissions — the model only
 * proposes calls (see app/api/assistant/route.ts for the server half).
 * Visibility matches the UI: employees only see/act on their own clients.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { CSTATUS, FLOORS, OWNERK, PAY, PRIO, PSTATUS, PTYPES, REQ, SOURCES, TEMPS, UPD } from "./constants";
import {
  clientById, demandOf, isMgrId, match, matchesFor, members, nameOf, OPEN_REQ, propById, propMsg, propSummary, reqsOf,
  statsFor, typesOf, unitsOf, unitView, visibleClients, visibleRequests, visibleTasks, type CrmData,
} from "./logic";
import { applyUpdate, applyUpdate0, assignClient, write } from "./actions";
import type { Client, Property, Request } from "./types";
import { addDays, fmtStamp, moneyFull, normPhone, nowStamp, num, relDay, splitList, today, waLink } from "./util";

export interface OfferItem {
  cid: string; rid: string | null; name: string; score: number; why: string; as: string; link: string | null;
}
export interface ToolCtx {
  act: (label: string, kind: string | null, id: string | null) => void;
  offer: (o: { title: string; pid: string; items: OfferItem[] }) => void;
  wa: (label: string, link: string) => void;
}
type Input = Record<string, unknown>;
type Tool = Anthropic.Beta.BetaTool & { run: (d: CrmData, i: Input, ctx: ToolCtx) => unknown | Promise<unknown> };

const str = (v: unknown) => (v == null ? "" : String(v));
const arr = (v: unknown) =>
  Array.isArray(v) ? v.map(String).filter(Boolean) : v ? String(v).split(/[،,]/).map((x) => x.trim()).filter(Boolean) : [];
function parseDay(v: unknown): string | null | undefined {
  if (v == null || v === "") return undefined;
  const s = String(v).trim();
  if (s === "none" || s === "بدون") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const n = parseInt(s.replace("+", ""), 10);
  if (!isNaN(n)) return addDays(n);
  throw new Error("صيغة التاريخ غير مفهومة: " + s + " (استخدم YYYY-MM-DD أو عدد أيام)");
}
function memberByName(d: CrmData, n: unknown) {
  const s = str(n).trim();
  if (!s) return null;
  if (["أنا", "انا", "لي", "me", "نفسي"].includes(s)) return d.uid;
  const ms = members(d);
  return ms.find((id) => nameOf(d, id) === s) || ms.find((id) => nameOf(d, id).includes(s) || s.includes(nameOf(d, id))) || null;
}
const teamList = (d: CrmData) => members(d).map((x) => nameOf(d, x)).join("، ");
function needClient(d: CrmData, id: unknown): Client {
  const c = visibleClients(d).find((x) => x.id === str(id));
  if (!c) throw new Error("ما لقيت عميل بهذا المعرّف. استخدم find_clients أول.");
  return c;
}
const findDup = (d: CrmData, phone: string, except?: string) => {
  const n = normPhone(phone);
  return n ? d.clients.find((c) => c.id !== except && normPhone(c.phone) === n) || null : null;
};

const cSum = (d: CrmData, c: Client) => {
  const x = demandOf(d, c);
  return {
    id: c.id, open_requests: reqsOf(d, c).map((r) => r.id), name: c.name, phone: c.phone || "", purpose: x.purpose || "شراء",
    types: typesOf(x), budget: num(x.budget), payment: x.payment || "", districts: x.districts || "",
    visit: c.visitAt ? c.visitAt + (c.visitConfirmed ? " (مؤكد)" : "") : undefined,
    temp: c.temp || "", status: c.status || "نشط", next_call: c.nextCall || null, last_update: c.lastUpdate || "",
    assignee: c.assignee ? nameOf(d, c.assignee) : "غير مسند",
  };
};
const pSum = (p: Property) => ({
  id: p.id, title: p.title, type: p.type || "", purpose: p.purpose || "بيع", status: p.status || "متاح", price: num(p.price),
  district: p.district || "", area: num(p.area), bedrooms: num(p.bedrooms), owner_kind: p.ownerKind || "",
  contact: (p.contactName || "") + (p.contactPhone ? " " + p.contactPhone : ""),
  units: unitsOf(p).length ? unitsOf(p).map((u) => ({ name: u.name, area: num(u.area), price: num(u.price), bedrooms: num(u.bedrooms), status: u.status || "متاح" })) : undefined,
});

const S = (props: Record<string, unknown>, required?: string[]) =>
  ({ type: "object", properties: props, ...(required ? { required } : {}) }) as Anthropic.Beta.BetaTool["input_schema"];
const enumS = (vals: readonly string[]) => ({ type: "string", enum: [...vals] });

export function buildTools(): Tool[] {
  return [
    {
      name: "find_clients",
      description: "يبحث في عملاء المستخدم الظاهرين له ويرجع قائمة مختصرة (id، الاسم، الجوال، الطلب، الميزانية، الأحياء، الحالة، موعد الاتصال، المسؤول). query يبحث في الاسم والجوال والحي والملاحظات.",
      input_schema: S({ query: { type: "string" }, due: enumS(["late", "today", "week", "none"]), status: enumS(CSTATUS), temp: enumS(TEMPS), limit: { type: "number" } }),
      run(d, i) {
        let l = visibleClients(d).slice();
        const q = str(i.query).trim(), t = today();
        if (q) l = l.filter((c) => { const x = demandOf(d, c); return [c.name, c.phone, x.districts, c.notes, x.requirements].join(" ").includes(q); });
        if (i.status) l = l.filter((c) => (c.status || "نشط") === i.status);
        if (i.temp) l = l.filter((c) => c.temp === i.temp);
        if (i.due === "late") l = l.filter((c) => c.nextCall && c.nextCall < t);
        if (i.due === "today") l = l.filter((c) => c.nextCall && c.nextCall <= t);
        if (i.due === "week") l = l.filter((c) => c.nextCall && c.nextCall <= addDays(7));
        if (i.due === "none") l = l.filter((c) => !c.nextCall);
        return { count: l.length, clients: l.slice(0, Math.min(num(i.limit) || 25, 40)).map((c) => cSum(d, c)) };
      },
    },
    {
      name: "client_details",
      description: "يرجع كل تفاصيل عميل واحد مع آخر 10 تحديثات وأفضل 3 عقارات مطابقة له.",
      input_schema: S({ client_id: { type: "string" } }, ["client_id"]),
      run(d, i) {
        const c = needClient(d, i.client_id);
        const x = demandOf(d, c);
        return {
          ...cSum(d, c), bank: x.bank || "", area_min: num(x.areaMin), bedrooms_min: num(x.bedroomsMin), requirements: x.requirements || "",
          notes: c.notes || "", source: c.source || "",
          log: (c.log || []).slice(0, 10).map((l) => ({ at: fmtStamp(l.at), type: l.type || "", text: l.text || "", by: l.byId ? nameOf(d, l.byId) : "" })),
          matches: matchesFor(d, c).slice(0, 3).map(({ p, m }) => ({ property_id: p.id, title: p.title, score: m.score, unit: m.unit?.name, why: m.why.join("، ") })),
        };
      },
    },
    {
      name: "clients_for_offer",
      description: "يطلع العملاء اللي يناسبهم عرض عقاري. استخدمه لما المستخدم يعطيك عرض (نص من واتساب أو وصف) أو يسأل مين يناسبه عقار. استخرج من العرض: النوع، الحي، السعر، المساحة، الغرف، الدور، بيع أو إيجار. إذا العقار موجود في النظام أرسل property_id بدل التفاصيل. message: نص الرسالة اللي تنرسل للعملاء بالواتساب (صياغة مرتبة للعرض بدون أرقام المالك أو العمولة). يطلع للمستخدم قائمة بالعملاء مع زر واتساب لكل واحد.",
      input_schema: S({
        property_id: { type: "string" }, title: { type: "string", description: "وصف قصير للعرض مثل: فيلا 300م الملقا" }, type: enumS(PTYPES),
        purpose: enumS(["بيع", "إيجار"]), district: { type: "string" }, price: { type: "number" }, area: { type: "number" }, bedrooms: { type: "number" },
        floor: enumS(FLOORS), message: { type: "string" }, include_other_districts: { type: "boolean", description: "true يضم عملاء طالبين أحياء ثانية" },
      }),
      run(d, i, ctx) {
        let p: Property;
        if (i.property_id) {
          const x = propById(d, str(i.property_id));
          if (!x) throw new Error("ما لقيت العقار. استخدم find_properties.");
          p = x;
        } else {
          if (!i.type && !i.district && i.price == null) throw new Error("أحتاج على الأقل النوع أو الحي أو السعر من العرض");
          p = {
            id: "", title: str(i.title) || [i.type, i.area ? i.area + "م" : "", i.district].filter(Boolean).join(" "), type: (i.type as string) || null,
            purpose: (i.purpose as string) || "بيع", district: str(i.district), price: num(i.price), area: num(i.area), bedrooms: num(i.bedrooms),
            floor: (i.floor as string) || null, status: "متاح", units: [],
          } as unknown as Property;
        }
        const best: Record<string, { c: Client; rid: string | null; score: number; why: string[] }> = {};
        const consider = (c: Client, r: Request | Client, rid: string | null) => {
          const m = match(r, p);
          if (!m) return;
          const ds = splitList(r.districts);
          const dOk = !ds.length || !p.district || m.why.includes("الحي مطابق");
          if (!dOk && !i.include_other_districts) return;
          const sc = m.score - (dOk ? 0 : 25);
          if (!best[c.id] || best[c.id].score < sc) best[c.id] = { c, rid, score: sc, why: m.why.concat(dOk ? [] : ["يطلب " + ds.slice(0, 2).join("، ")]) };
        };
        visibleRequests(d).filter(OPEN_REQ).forEach((r) => { const c = clientById(d, r.clientId); if (c && (c.status || "نشط") === "نشط") consider(c, r, r.id); });
        visibleClients(d).filter((c) => (c.status || "نشط") === "نشط" && !reqsOf(d, c).length && (c.budget || typesOf(c).length || c.districts)).forEach((c) => consider(c, c, null));
        const list = Object.values(best).sort((a, b) => b.score - a.score).slice(0, 40);
        const msg = str(i.message || (p.id ? propMsg(p) : p.title)).trim();
        ctx.offer({
          title: p.title, pid: p.id,
          items: list.map((x) => ({
            cid: x.c.id, rid: x.rid, name: x.c.name, score: x.score, why: x.why.join(" · "), as: x.c.assignee ? nameOf(d, x.c.assignee) : "",
            link: x.c.phone ? waLink(x.c.phone, "السلام عليكم " + x.c.name + "،\n" + msg) : null,
          })),
        });
        return {
          offer: p.title, count: list.length,
          clients: list.slice(0, 15).map((x) => ({ client_id: x.c.id, name: x.c.name, score: x.score, why: x.why.join("، "), assignee: x.c.assignee ? nameOf(d, x.c.assignee) : "غير مسند" })),
          note: "القائمة الكاملة ظاهرة للمستخدم مع أزرار واتساب. لا تعيد سردها كلها، لخّص بجملة.",
        };
      },
    },
    {
      name: "find_properties",
      description: "يبحث في مخزون العقارات ويرجع قائمة مختصرة مع الوحدات إن وجدت. استخدم for_client_id ليرجع العقارات المطابقة لعميل مرتبة بالنسبة.",
      input_schema: S({ query: { type: "string" }, type: enumS(PTYPES), district: { type: "string" }, max_price: { type: "number" }, min_area: { type: "number" }, status: enumS(PSTATUS), for_client_id: { type: "string" } }),
      run(d, i) {
        if (i.for_client_id) {
          const c = needClient(d, i.for_client_id);
          return matchesFor(d, c).slice(0, 10).map(({ p, m }) => ({ ...pSum(p), score: m.score, why: m.why.join("، "), matched_units: m.units?.map((u) => u.name) }));
        }
        let l = d.props.slice();
        const q = str(i.query).trim();
        if (q) l = l.filter((p) => [p.title, p.district, p.features, p.contactName].join(" ").includes(q));
        if (i.type) l = l.filter((p) => p.type === i.type || unitsOf(p).some((u) => u.type === i.type));
        if (i.district) l = l.filter((p) => str(p.district).includes(str(i.district)));
        if (i.status) l = l.filter((p) => (p.status || "متاح") === i.status);
        const mx = num(i.max_price), ma = num(i.min_area);
        if (mx != null || ma != null)
          l = l.filter((p) => (unitsOf(p).length ? unitsOf(p).map((u) => unitView(p, u)) : [p]).some((v) =>
            (mx == null || (v.price != null && v.price <= mx)) && (ma == null || (v.area != null && v.area >= ma))));
        return { count: l.length, properties: l.slice(0, 25).map(pSum) };
      },
    },
    {
      name: "save_client",
      description: "يعدّل بيانات عميل موجود ومتابعته (الاسم، الجوال، الاهتمام، الحالة، موعد الاتصال والزيارة). ما يضيف عميل جديد: العميل الجديد يتسجّل مع طلبه بـ save_request. وش يبي العميل (النوع، الحي، الميزانية…) يتعدّل بـ save_request. next_call: تاريخ YYYY-MM-DD أو عدد أيام. assignee: اسم الموظف (للمدير فقط).",
      input_schema: S({
        client_id: { type: "string" }, name: { type: "string" }, phone: { type: "string" }, visit_at: { type: "string", description: "YYYY-MM-DDTHH:MM أو none" },
        visit_property_id: { type: "string" }, temp: enumS(TEMPS), status: enumS(CSTATUS), source: enumS(SOURCES), notes: { type: "string" },
        next_call: { type: "string" }, assignee: { type: "string" },
      }, ["client_id"]),
      async run(d, i, ctx) {
        const c = needClient(d, i.client_id);
        const p: Record<string, unknown> = {};
        for (const k of ["name", "phone", "temp", "status", "source", "notes"]) if (i[k] != null && i[k] !== "") p[k] = str(i[k]);
        if (p.phone) { const dup = findDup(d, str(p.phone), c.id); if (dup) throw new Error("الرقم مسجّل لعميل ثاني: " + dup.name); }
        if (i.visit_at) { const v = str(i.visit_at); p.visitAt = v === "none" ? null : v.slice(0, 16); p.visitConfirmed = false; }
        if (i.visit_property_id) p.visitProperty = str(i.visit_property_id);
        const nc = parseDay(i.next_call);
        if (nc !== undefined) p.nextCall = nc;
        p.updatedAt = nowStamp();
        await write("clients", c.id, p, "update");
        if (i.assignee) {
          if (!d.isMgr) throw new Error("الإسناد للمدير فقط");
          const m = memberByName(d, i.assignee);
          if (!m) throw new Error("ما لقيت موظف بهذا الاسم. الفريق: " + teamList(d));
          await assignClient(d, c.id, m);
        }
        ctx.act("عدّل العميل: " + (str(p.name) || c.name), "client", c.id);
        return { ok: true, client_id: c.id };
      },
    },
    {
      name: "log_client_update",
      description: "يسجّل تحديث على عميل (وش صار معه) ويحدد موعد الاتصال القادم. next_call: عدد أيام، أو YYYY-MM-DD، أو none. إذا ما حدده المستخدم استخدم الافتراضي: 3 أيام لإرسال الموقع/التفاصيل واتصلت/استفسر، يوم لما رد، يومين للزيارة والتفاوض، none لصرف النظر والإغلاق. \"أجّل\" = نوع اتصلت عليه مع ملاحظة تأجيل.",
      input_schema: S({ client_id: { type: "string" }, update_type: enumS(UPD.map((u) => u.k)), note: { type: "string" }, next_call: { type: "string" }, property_id: { type: "string" } }, ["client_id", "update_type"]),
      async run(d, i, ctx) {
        const c = needClient(d, i.client_id);
        const u = UPD.find((x) => x.k === i.update_type);
        if (!u) throw new Error("نوع تحديث غير معروف");
        let nc = parseDay(i.next_call);
        if (nc === undefined) nc = u.n === "none" ? null : addDays(u.n);
        await applyUpdate(d, c.id, u.k, nc, str(i.note), i.property_id ? str(i.property_id) : null);
        ctx.act(c.name + ": " + u.k + (nc ? " — اتصال " + relDay(nc) : ""), "client", c.id);
        return { ok: true, next_call: nc };
      },
    },
    {
      name: "save_property",
      description: "يضيف عقار (بدون property_id) أو يعدّل عقار موجود. للمشاريع أرسل units كقائمة وحدات بمساحتها وسعرها. owner_kind: مالك فرد/مطور/مسوق. يرجع id.",
      input_schema: S({
        property_id: { type: "string" }, title: { type: "string" }, type: enumS(PTYPES), purpose: enumS(["بيع", "إيجار"]), status: enumS(PSTATUS),
        price: { type: "number" }, price_note: enumS(["قابل للتفاوض", "نهائي"]), city: { type: "string" }, district: { type: "string" },
        area: { type: "number" }, bedrooms: { type: "number" }, bathrooms: { type: "number" }, floor: enumS(FLOORS), facing: { type: "string" },
        street_width: { type: "number" }, age: { type: "string" }, features: { type: "string" }, link: { type: "string" }, owner_kind: enumS(OWNERK),
        contact_name: { type: "string" }, contact_phone: { type: "string" }, commission_note: { type: "string" },
        wa_message: { type: "string", description: "رسالة الواتساب الجاهزة للعقار مع الموقع" }, notes: { type: "string" },
        units: { type: "array", items: { type: "object", properties: { name: { type: "string" }, type: { type: "string" }, area: { type: "number" }, price: { type: "number" }, bedrooms: { type: "number" }, floor: enumS(FLOORS), status: enumS(PSTATUS) } } },
      }),
      async run(d, i, ctx) {
        const p: Record<string, unknown> = {};
        const map: Record<string, string> = {
          title: "title", floor: "floor", type: "type", purpose: "purpose", status: "status", price_note: "priceNote", city: "city", district: "district",
          facing: "facing", age: "age", features: "features", link: "link", owner_kind: "ownerKind", contact_name: "contactName",
          contact_phone: "contactPhone", commission_note: "commissionNote", wa_message: "waMessage", notes: "notes",
        };
        for (const [k, f] of Object.entries(map)) if (i[k] != null && i[k] !== "") p[f] = str(i[k]);
        for (const [k, f] of [["price", "price"], ["area", "area"], ["bedrooms", "bedrooms"], ["bathrooms", "bathrooms"], ["street_width", "streetWidth"]])
          if (i[k] != null && i[k] !== "") p[f] = num(i[k]);
        if (Array.isArray(i.units))
          p.units = (i.units as Input[]).map((u, n) => ({
            name: str(u.name) || "وحدة " + (n + 1), type: u.type ? str(u.type) : null, area: num(u.area), price: num(u.price), bedrooms: num(u.bedrooms),
            floor: FLOORS.includes(u.floor as never) ? u.floor : null, status: PSTATUS.includes(u.status as never) ? u.status : "متاح",
          }));
        p.updatedAt = nowStamp();
        if (i.property_id) {
          const x = propById(d, str(i.property_id));
          if (!x) throw new Error("ما لقيت العقار");
          await write("properties", x.id, p, "update");
          ctx.act("عدّل العقار: " + (str(p.title) || x.title), "property", x.id);
          return { ok: true, property_id: x.id };
        }
        if (!p.title) throw new Error("اسم العقار مطلوب");
        const id = await write("properties", null, { purpose: "بيع", status: "متاح", city: "الرياض", images: [], units: [], createdAt: nowStamp(), ...p });
        ctx.act("أضاف عقار: " + p.title, "property", id);
        return { ok: true, property_id: id };
      },
    },
    {
      name: "save_task",
      description: "ينشئ مهمة (بدون task_id) أو يعدّلها أو يعلّمها منجزة (done:true). assignee: اسم الموظف أو \"أنا\". due: YYYY-MM-DD أو عدد أيام.",
      input_schema: S({ task_id: { type: "string" }, title: { type: "string" }, assignee: { type: "string" }, due: { type: "string" }, priority: enumS(PRIO), client_id: { type: "string" }, property_id: { type: "string" }, notes: { type: "string" }, done: { type: "boolean" } }),
      async run(d, i, ctx) {
        const p: Record<string, unknown> = {};
        if (i.title) p.title = str(i.title);
        if (i.priority) p.priority = str(i.priority);
        if (i.notes) p.notes = str(i.notes);
        const due = parseDay(i.due);
        if (due !== undefined) p.due = due;
        if (i.client_id) { needClient(d, i.client_id); p.clientId = str(i.client_id); }
        if (i.property_id) p.propertyId = str(i.property_id);
        if (i.assignee) { const m = memberByName(d, i.assignee); if (!m) throw new Error("ما لقيت موظف بهذا الاسم. الفريق: " + teamList(d)); p.assignee = m; }
        if (typeof i.done === "boolean") { p.done = i.done; p.doneAt = i.done ? nowStamp() : null; p.doneBy = i.done ? d.uid : null; }
        p.updatedAt = nowStamp();
        if (i.task_id) {
          const t = visibleTasks(d).find((x) => x.id === str(i.task_id));
          if (!t) throw new Error("ما لقيت المهمة");
          if (p.assignee && p.assignee !== t.assignee) p.seen = p.assignee === d.uid;
          await write("tasks", t.id, p, "update");
          ctx.act((p.done ? "أنجز المهمة: " : "عدّل المهمة: ") + (str(p.title) || t.title), "task", t.id);
          return { ok: true };
        }
        if (!p.title) throw new Error("عنوان المهمة مطلوب");
        const body: Record<string, unknown> = { assignee: d.uid, due: today(), priority: "عادية", done: false, clientId: null, propertyId: null, notes: null, createdBy: d.uid, createdAt: nowStamp(), ...p };
        const id = await write("tasks", null, { ...body, seen: body.assignee === d.uid });
        ctx.act("أنشأ مهمة: " + str(body.title) + " — " + (body.assignee === d.uid ? "لك" : "لـ " + nameOf(d, str(body.assignee))), "task", id);
        return { ok: true, task_id: id };
      },
    },
    {
      name: "list_tasks",
      description: "يرجع المهام المفتوحة (أو المنجزة مع include_done) الظاهرة للمستخدم مع id والعنوان والتاريخ والأولوية والمسؤول والعميل.",
      input_schema: S({ include_done: { type: "boolean" }, assignee: { type: "string" } }),
      run(d, i) {
        let l = visibleTasks(d).filter((t) => (i.include_done ? true : !t.done));
        if (i.assignee) { const m = memberByName(d, i.assignee); l = l.filter((t) => t.assignee === m); }
        return l.slice(0, 40).map((t) => ({ id: t.id, title: t.title, due: t.due || null, priority: t.priority || "عادية", done: !!t.done, assignee: nameOf(d, t.assignee), client: clientById(d, t.clientId)?.name || "" }));
      },
    },
    {
      name: "assign_clients",
      description: "للمدير فقط: يسند عميل أو أكثر لموظف بالاسم.",
      input_schema: S({ client_ids: { type: "array", items: { type: "string" } }, member: { type: "string" } }, ["client_ids", "member"]),
      async run(d, i, ctx) {
        if (!d.isMgr) throw new Error("الإسناد للمدير فقط");
        const m = memberByName(d, i.member);
        if (!m) throw new Error("ما لقيت موظف بهذا الاسم. الفريق: " + teamList(d));
        const done: string[] = [];
        for (const id of arr(i.client_ids)) { const c = clientById(d, id); if (!c) continue; await assignClient(d, c.id, m); done.push(c.name); }
        ctx.act("أسند " + done.length + " عميل إلى " + nameOf(d, m), null, null);
        return { ok: true, assigned: done, to: nameOf(d, m) };
      },
    },
    {
      name: "team_overview",
      description: "يرجع أعضاء الفريق (الاسم، الدور) ومع المدير أرقام كل موظف: عملاء نشطين، اتصالات اليوم، متأخرة، مهام مفتوحة، صفقات.",
      input_schema: S({}),
      run(d) {
        return members(d).map((id) => ({ name: nameOf(d, id), role: isMgrId(d, id) ? "مدير" : "موظف", is_me: id === d.uid, ...(d.isMgr ? statsFor(d, id) : {}) }));
      },
    },
    {
      name: "whatsapp_draft",
      description: "يجهّز رسالة واتساب لعميل (client_id) أو رقم، ويطلع للمستخدم زر يفتح واتساب والرسالة جاهزة. ما يرسل شي بنفسه.",
      input_schema: S({ client_id: { type: "string" }, phone: { type: "string" }, text: { type: "string" } }, ["text"]),
      run(d, i, ctx) {
        const c = i.client_id ? needClient(d, i.client_id) : null;
        const link = waLink(c ? c.phone : str(i.phone), str(i.text));
        if (!link) throw new Error("ما فيه رقم جوال");
        ctx.wa("افتح واتساب" + (c ? " — " + c.name : ""), link);
        return { ok: true, note: "ظهر للمستخدم زر فتح واتساب" };
      },
    },
    {
      name: "save_request",
      description: "يسجّل طلب عميل جديد في قسم الطلبات أو يعدّل طلب/مرحلته. هذي الطريقة الوحيدة لإضافة عميل جديد: أرسل new_client_name وجواله بدل client_id (إذا الجوال مسجّل يرفض). للعربون والبيع أرسل status مع property_id و price (و unit للمشاريع). المراحل: " + REQ.join("، ") + ".",
      input_schema: S({
        request_id: { type: "string" }, client_id: { type: "string" }, new_client_name: { type: "string" }, new_client_phone: { type: "string" },
        purpose: enumS(["شراء", "إيجار"]), prop_types: { type: "array", items: enumS(PTYPES) }, districts: { type: "array", items: { type: "string" } },
        budget: { type: "number" }, payment: enumS(PAY), area_min: { type: "number" }, bedrooms_min: { type: "number" },
        floors: { type: "array", items: enumS(FLOORS) }, requirements: { type: "string" }, status: enumS(REQ), priority: enumS(PRIO),
        assignee: { type: "string" }, property_id: { type: "string", description: "العقار عند العربون أو البيع" }, unit: { type: "string" },
        price: { type: "number", description: "قيمة البيع" }, commission_pct: { type: "number" }, deposit: { type: "number", description: "مبلغ العربون" },
        source: enumS(SOURCES),
      }),
      async run(d, i, ctx) {
        const p: Record<string, unknown> = {};
        if (i.purpose) p.purpose = str(i.purpose);
        if (i.prop_types) p.propTypes = arr(i.prop_types);
        if (i.districts) p.districts = arr(i.districts).join("، ");
        if (i.budget != null) p.budget = num(i.budget);
        if (i.payment) p.payment = str(i.payment);
        if (i.area_min != null) p.areaMin = num(i.area_min);
        if (i.bedrooms_min != null) p.bedroomsMin = num(i.bedrooms_min);
        if (i.floors) p.floors = arr(i.floors);
        if (i.requirements) p.requirements = str(i.requirements);
        if (i.priority) p.priority = str(i.priority);
        let m: string | null = null;
        if (i.assignee) {
          if (!d.isMgr) throw new Error("الإسناد للمدير فقط");
          m = memberByName(d, i.assignee);
          if (!m) throw new Error("ما لقيت موظف بهذا الاسم. الفريق: " + teamList(d));
        }
        const to = i.status ? str(i.status) : null;
        const closing = to === "عربون" || to === "تم البيع";
        if (closing && (!i.property_id || i.price == null)) throw new Error("للعربون أو البيع لازم العقار (property_id) وقيمة البيع (price). اسأل المستخدم عنها.");
        p.updatedAt = nowStamp();
        let r: { id: string; clientId: string; depositAt?: string | null; assignee?: string | null } | null = null;
        if (i.request_id) {
          const x = visibleRequests(d).find((y) => y.id === str(i.request_id));
          if (!x) throw new Error("ما لقيت الطلب");
          r = x;
        } else {
          let cid = i.client_id ? needClient(d, i.client_id).id : null;
          if (!cid) {
            if (!i.new_client_name) throw new Error("اختر عميل موجود أو أرسل اسم العميل الجديد");
            if (i.new_client_phone) {
              const dup = findDup(d, str(i.new_client_phone));
              if (dup) throw new Error("العميل مسجّل من قبل باسم " + dup.name + (dup.assignee ? " عند " + nameOf(d, dup.assignee) : "") + ". ما تقدر تضيفه مرة ثانية.");
            }
            cid = await write("clients", null, {
              name: str(i.new_client_name), phone: i.new_client_phone ? str(i.new_client_phone) : null, status: "نشط",
              temp: p.priority === "عاجلة" ? "ساخن" : "دافئ", nextCall: today(), log: [], source: i.source || null, assignee: m || d.uid,
              notes: null, visitAt: null, createdAt: nowStamp(), ...p,
            });
            ctx.act("أضاف عميل: " + str(i.new_client_name), "client", cid);
          } else await write("clients", cid, { ...p }, "update");
          const id = await write("requests", null, {
            clientId: cid, purpose: "شراء", status: to && !closing ? to : "جديد", priority: "عادية", source: i.source || null, notes: null,
            assignee: m || clientById(d, cid)?.assignee || d.uid, propertyId: null, unit: null, price: null, commissionPct: 2.5, createdAt: nowStamp(), ...p,
          });
          ctx.act("سجّل طلب: " + (clientById(d, cid)?.name || str(i.new_client_name)), "request", id);
          if (!closing) return { ok: true, request_id: id, matching_properties: d.props.filter((x) => match(p as unknown as Request, x)).length };
          r = { id, clientId: cid };
        }
        if (to && !closing) p.status = to;
        if (i.request_id) {
          await write("requests", r.id, p, "update");
          if (m && m !== r.assignee) await assignClient(d, r.clientId, m, r.id);
          if (!closing) { ctx.act("حدّث الطلب" + (to ? " إلى " + to : ""), "request", r.id); return { ok: true }; }
        }
        const prop = propById(d, str(i.property_id));
        if (!prop) throw new Error("ما لقيت العقار");
        const unit = i.unit ? str(i.unit) : null;
        if (unit && !unitsOf(prop).some((u) => u.name === unit)) throw new Error("ما لقيت وحدة بهذا الاسم. الوحدات: " + unitsOf(prop).map((u) => u.name).join("، "));
        const price = num(i.price)!, pct = num(i.commission_pct) ?? 2.5;
        const patch: Record<string, unknown> = { status: to, propertyId: prop.id, unit, price, commissionPct: pct, updatedAt: nowStamp() };
        if (to === "عربون") { patch.depositAt = r.depositAt || nowStamp(); if (i.deposit != null) patch.deposit = num(i.deposit); }
        else { patch.closedAt = nowStamp(); if (!r.depositAt) patch.depositAt = patch.closedAt; }
        await write("requests", r.id, patch, "update");
        const st = to === "تم البيع" ? "مباع" : "محجوز";
        if (unit && unitsOf(prop).length) await write("properties", prop.id, { units: prop.units.map((u) => (u.name === unit ? { ...u, status: st } : u)), updatedAt: nowStamp() }, "update");
        else if (!unitsOf(prop).length) await write("properties", prop.id, { status: st, updatedAt: nowStamp() }, "update");
        if (r.clientId) await applyUpdate0(d, r.clientId, to === "تم البيع" ? "تم الإغلاق" : "دفع عربون", null, prop.title + (unit ? " — " + unit : "") + " · " + moneyFull(price), prop.id);
        if (to === "تم البيع" && r.clientId) await write("clients", r.clientId, { status: "مغلق" }, "update");
        ctx.act((to === "تم البيع" ? "سجّل البيع: " : "سجّل العربون: ") + prop.title + (unit ? " — " + unit : ""), "request", r.id);
        return { ok: true };
      },
    },
    {
      name: "post_team_chat",
      description: "ينشر رسالة في دردشة الفريق باسم المستخدم. استخدمها فقط إذا طلب المستخدم صراحة.",
      input_schema: S({ text: { type: "string" } }, ["text"]),
      async run(d, i, ctx) {
        await write("chat", null, { text: str(i.text).slice(0, 2000), by: d.uid, at: nowStamp(), clientId: null });
        ctx.act("نشر في دردشة الفريق", null, null);
        return { ok: true };
      },
    },
  ];
}

/** System prompt for the assistant: role, today, the team, and the working rules from the original CRM. */
export function assistantRules(d: CrmData) {
  const dt = new Date();
  return (
    'أنت مساعد داخل نظام CRM لشركة "بن سلمه العقارية" في الرياض. تكلم بلهجة سعودية بسيطة وباختصار.\n' +
    "اليوم: " + today() + " (" + dt.toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { weekday: "long" }) + "). المستخدم: " + nameOf(d, d.uid) + " — " +
    (d.isMgr ? "مدير يشوف كل العملاء" : "موظف يشوف عملاءه بس") + ".\n" +
    "الفريق: " + members(d).map((id) => nameOf(d, id) + (isMgrId(d, id) ? " (مدير)" : "")).join("، ") + ".\n" +
    "أنواع التحديث: " + UPD.map((u) => u.k).join("، ") + ". أنواع العقار: " + PTYPES.join("، ") + ".\n" +
    "القواعد:\n- العميل الجديد يتسجّل فقط مع طلبه: save_request مع new_client_name و new_client_phone. save_client لتعديل عميل موجود بس.\n" +
    "- إذا قال لك النظام إن العميل مسجّل من قبل، بلّغ المستخدم باسمه والموظف المسؤول ولا تحاول تضيفه بطريقة ثانية.\n" +
    "- الطلب = وش يبي ومراحله حتى العربون والبيع (save_request مع status و property_id و price).\n" +
    "- نفّذ الأوامر بالأدوات مباشرة، لا تقول بسوي وتوقف.\n" +
    "- إذا المستخدم لصق عرض عقاري أو قال مين يناسبه عرض، استخدم clients_for_offer مباشرة (لا تضيف العقار للنظام إلا إذا طلب).\n" +
    "- لا تخترع id أبداً: ابحث بـ find_clients أو find_properties أو list_tasks أول.\n" +
    "- إذا فيه أكثر من عميل بنفس الاسم أو معلومة أساسية ناقصة (مثل اسم العميل) اسأل سؤال واحد قصير.\n" +
    '- المبالغ بالريال: "3 مليون" = 3000000، "900 ألف" = 900000.\n' +
    "- التواريخ: بكرة = 1، بعد أسبوع = 7، أو YYYY-MM-DD.\n" +
    "- ما تقدر تحذف أي شي؛ إذا طُلب الحذف قل للمستخدم يحذف من النظام.\n" +
    "- لا تنشر في الدردشة ولا تجهّز واتساب إلا إذا طُلب.\n" +
    "- بعد التنفيذ اختم بجملة أو قائمة قصيرة بوش سويت. لا تستخدم جداول."
  );
}

/** API tool definitions (without the client-side run functions). */
export const toolDefs = (tools: Tool[]): Anthropic.Beta.BetaTool[] =>
  tools.map(({ name, description, input_schema }) => ({ name, description, input_schema }));

export { propSummary };
