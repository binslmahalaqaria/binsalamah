"use client";

/**
 * Owner-only demo data for trying the CRM: three demo employees with
 * clients, requests at every stage (incl. deposits and sales), call logs
 * over the last two weeks, visits, tasks, goals, and today's attendance.
 * Every record id starts with "demo_" (goals: "<month>_demo_…") so
 * "remove" deletes exactly what was added and never touches real data.
 * Lives in Team → Settings next to the old-CRM importer.
 */
import { useState } from "react";
import { collection, deleteDoc, doc, getDocs, writeBatch, type WriteBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCrm } from "@/lib/crm/store";
import { assertWritable } from "@/lib/crm/preview";
import { addDays, today, ym } from "@/lib/crm/util";

const STAFF = [
  { id: "demo_sara", name: "سارة (تجريبي)" },
  { id: "demo_khalid", name: "خالد (تجريبي)" },
  { id: "demo_noura", name: "نورة (تجريبي)" },
];
const NAMES = [
  "تركي الحربي", "عبدالله القحطاني", "منيرة الشهري", "فيصل العنزي", "ريم الدوسري", "ماجد السبيعي", "هيفاء المطيري",
  "سلطان الغامدي", "نواف الزهراني", "أمل العتيبي", "بندر الشمري", "لمى القرني", "يزيد الرشيد", "جواهر المالكي",
  "مشعل البقمي", "دانة الخالدي", "سعود الجهني", "العنود الحربي", "راكان العمري", "شهد السهلي", "حمد الدوسري",
  "وعد الزهراني", "زياد العسيري", "غادة الشهراني",
];
// Stage per client (index-aligned with NAMES).
const STAGES = [
  "جديد", "جديد", "جديد", "جديد", "جديد", "جاري البحث", "جاري البحث", "جاري البحث", "جاري البحث", "أرسلنا خيارات",
  "أرسلنا خيارات", "أرسلنا خيارات", "أرسلنا خيارات", "أرسلنا خيارات", "أرسلنا خيارات", "أرسلنا خيارات", "تفاوض", "تفاوض", "تفاوض",
  "عربون", "عربون", "عربون", "تم البيع", "تم البيع",
];

const stamp = (day: string, hhmm: string) => new Date(day + "T" + hhmm + ":00").toISOString();

function build(ownerUid: string) {
  const t = today();
  const now = new Date().toISOString();
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
  const people = [...STAFF.map((s) => s.id), ownerUid];
  const docs: [string, string, Record<string, unknown>][] = [];

  /* ---- staff, goals, attendance ---- */
  STAFF.forEach((s, i) => {
    docs.push(["staff", s.id, { name: s.name, email: s.id + "@demo.local", role: "sales", active: true, created_at: Date.now(), phone: "050000000" + i }]);
    docs.push(["goals", ym() + "_" + s.id, { uid: s.id, month: ym(), calls: 12, reqs: 8, visits: 6, deals: 2, commission: 60000, note: "", by: ownerUid, updatedAt: now }]);
  });
  docs.push(["attendance/demo_sara/days", t, { date: t, in: stamp(t, "08:52"), out: null }]);
  docs.push(["attendance/demo_khalid/days", t, { date: t, in: stamp(t, "09:41"), out: null }]);

  /* ---- properties ---- */
  const prop = (id: string, title: string, type: string, district: string, price: number, area: number, bedrooms: number | null, extra: Record<string, unknown> = {}) =>
    docs.push(["properties", id, {
      title, type, purpose: "بيع", price, status: "متاح", district, area, bedrooms, bathrooms: bedrooms ? bedrooms + 1 : null, floor: null,
      priceNote: null, link: null, images: [], videoLink: null, ownerKind: "مطور", contactName: null, contactPhone: null, commissionNote: null,
      waMessage: null, units: [], features: null, city: "الرياض", buildArea: null, livingRooms: null, floors: null, facing: "شمالية",
      streetWidth: 20, age: "جديد", notes: "بيانات تجريبية", createdAt: stamp(addDays(-20), "10:00"), updatedAt: now, ...extra,
    }]);
  prop("demo_p1", "فيلا النرجس (تجريبي)", "فيلا", "النرجس", 2400000, 350, 5);
  prop("demo_p2", "مشروع شقق الياسمين (تجريبي)", "شقة", "الياسمين", 950000, 160, 3, {
    units: ["A1", "A2", "A3", "A4", "A5", "A6"].map((n, i) => ({ name: n, type: "شقة", area: 150 + i * 8, price: 850000 + i * 50000, bedrooms: 3, floor: i < 2 ? "أرضي" : i < 4 ? "أول" : "ثاني", status: "متاح" })),
  });
  prop("demo_p3", "دور الملقا (تجريبي)", "دور", "الملقا", 1350000, 240, 4, { floor: "أول" });
  prop("demo_p4", "تاون هاوس القيروان (تجريبي)", "تاون هاوس", "القيروان", 1750000, 280, 4);
  prop("demo_p5", "أرض العارض (تجريبي)", "أرض", "العارض", 1200000, 600, null);
  prop("demo_p6", "فيلا حطين (تجريبي)", "فيلا", "حطين", 3800000, 450, 6);
  const PROP_OF: Record<string, { pid: string; unit: string | null; price: number }> = {
    "عربون0": { pid: "demo_p2", unit: "A1", price: 850000 },
    "عربون1": { pid: "demo_p2", unit: "A2", price: 900000 },
    "عربون2": { pid: "demo_p3", unit: null, price: 1350000 },
    "تم البيع0": { pid: "demo_p2", unit: "A3", price: 950000 },
    "تم البيع1": { pid: "demo_p5", unit: null, price: 1180000 },
  };
  const unitSt: Record<string, string> = { A1: "محجوز", A2: "محجوز", A3: "مباع" };
  const p2 = docs.find((d) => d[1] === "demo_p2")![2];
  p2.units = (p2.units as { name: string }[]).map((u) => ({ ...u, status: unitSt[u.name] || "متاح" }));
  docs.find((d) => d[1] === "demo_p3")![2].status = "محجوز";
  docs.find((d) => d[1] === "demo_p5")![2].status = "مباع";

  /* ---- clients, requests, logs ---- */
  const DEMAND = [
    { t: "فيلا", d: "النرجس، الياسمين", b: 2500000 }, { t: "شقة", d: "الياسمين", b: 1000000 }, { t: "دور", d: "الملقا، النرجس", b: 1400000 },
    { t: "تاون هاوس", d: "القيروان", b: 1800000 }, { t: "أرض", d: "العارض", b: 1300000 }, { t: "فيلا", d: "حطين", b: 4000000 },
  ];
  const stageCount: Record<string, number> = {};
  NAMES.forEach((name, i) => {
    const id = "demo_c" + i;
    const st = STAGES[i];
    const k = st + (stageCount[st] = (stageCount[st] ?? -1) + 1);
    const who = people[i % people.length];
    const dm = DEMAND[i % DEMAND.length];
    const created = addDays(-Math.min(14, 1 + Math.floor(i / 2)));
    // Next call first: a client whose call is due (late or today) cannot have been called after that date —
    // logging a call always moves the next call forward — so their history ends the day before it.
    const late = i % 4 === 1, none = i % 11 === 10;
    const nextCall = ["تم البيع"].includes(st) || none ? null : late ? addDays(-(1 + (i % 3))) : i % 4 === 0 ? t : addDays(1 + (i % 5));
    const dueBack = nextCall && nextCall <= t ? (late ? 1 + (i % 3) : 0) + 1 : 0;
    // Call log, newest first. Busier, later-stage clients have more history; some calls land today.
    const log: Record<string, unknown>[] = [];
    const n = Math.min(5, 1 + Math.floor(i / 5));
    for (let j = 0; j < n; j++) {
      const day = j === 0 && i % 3 !== 2 && !dueBack ? t : addDays(-(dueBack + j * 2 + (i % 3)));
      if (day < created) break;
      const type = st === "جديد" ? pick(["اتصلت عليه", "ما رد"]) : j === 0 && ["معاينة", "تفاوض"].includes(st) ? (st === "تفاوض" ? "تفاوض" : "زار العقار")
        : pick(["اتصلت عليه", "ما رد", "استفسر", "تم إرسال الموقع", "تم إرسال التفاصيل", "سجّل اهتمام"]);
      log.push({ at: stamp(day, (10 + j) + ":" + (10 + i)), byId: who, type, text: type === "ما رد" ? "" : "متابعة تجريبية — " + dm.t + " في " + dm.d.split("،")[0], propertyId: null });
    }
    const deal = PROP_OF[k];
    const depDay = k === "عربون0" ? t : addDays(-3 - (i % 4));
    if (deal) log.unshift({ at: stamp(st === "تم البيع" ? addDays(-2) : depDay, "16:20"), byId: who, type: st === "تم البيع" ? "تم الإغلاق" : "دفع عربون", text: "صفقة تجريبية", propertyId: deal.pid });
    const visitAt = i === 13 ? addDays(1) + "T17:00" : i === 14 ? addDays(-1) + "T18:30" : i === 15 ? t + "T20:00" : null;
    docs.push(["clients", id, {
      name, phone: "05000" + String(10000 + i).slice(1), source: pick(["واتساب", "سناب", "تيك توك", "إعلان عقار", "إحالة", "اتصال"]),
      assignee: who, assignedAt: stamp(created, "09:00"), assignedBy: ownerUid, unseen: false,
      temp: st === "جديد" ? "دافئ" : ["تفاوض", "عربون", "معاينة"].includes(st) ? "ساخن" : pick(["دافئ", "بارد", "ساخن"]),
      status: st === "تم البيع" ? "مغلق" : i === 8 ? "غير مهتم" : "نشط",
      nextCall, visitAt, visitProperty: visitAt ? "demo_p1" : null, visitConfirmed: i === 15,
      notes: "بيانات تجريبية", log, lastUpdate: (log[0]?.type as string) || null, lastUpdateAt: (log[0]?.at as string) || null,
      purpose: "شراء", propTypes: [dm.t], districts: dm.d, budget: dm.b, payment: pick(["كاش", "بنك", "بنك + كاش"]),
      createdAt: stamp(created, "09:00"), updatedAt: now,
    }]);
    const by = i % 5 === 0 ? ownerUid : who; // sometimes the owner recorded the deal for the employee
    docs.push(["requests", "demo_r" + i, {
      clientId: id, priority: st === "تفاوض" || st === "عربون" ? "مهمة" : "عادية", source: null, notes: null, status: st, assignee: who,
      purpose: "شراء", propTypes: [dm.t], districts: dm.d, budget: dm.b, payment: "بنك", bank: null, areaMin: null, bedroomsMin: null, floors: [], requirements: null,
      propertyId: deal?.pid || (st === "تفاوض" ? "demo_p1" : null), unit: deal?.unit || null,
      price: deal?.price || (st === "تفاوض" ? 2350000 : null), commissionPct: 2.5,
      deposit: st === "عربون" ? [50000, 30000, 0][stageCount[st]] || null : st === "تم البيع" ? 40000 : null,
      depositAt: deal ? stamp(st === "تم البيع" ? addDays(-9) : depDay, "16:20") : null, depositBy: deal ? by : null,
      closedAt: st === "تم البيع" ? stamp(addDays(-2), "12:00") : null, closedBy: st === "تم البيع" ? by : null,
      sent: ["أرسلنا خيارات", "معاينة", "تفاوض"].includes(st) ? ["demo_p1"] : [],
      createdAt: stamp(created, "09:05"), updatedAt: now,
    }]);
  });

  /* ---- tasks ---- */
  [["اتصل على البنك بخصوص تمويل العميل", 0, "demo_sara", false], ["جهّز عقد العربون", 0, "demo_khalid", false],
    ["صوّر شقق مشروع الياسمين", -2, "demo_noura", false], ["تابع إفراغ أرض العارض", 2, "demo_khalid", false],
    ["أرسل عروض حطين للعملاء", 0, "demo_sara", true]].forEach(([title, d, who, done], i) => {
    docs.push(["tasks", "demo_t" + i, {
      title, assignee: who, due: addDays(d as number), priority: i === 1 ? "عاجلة" : "عادية", clientId: "demo_c" + (19 + (i % 3)), propertyId: null,
      notes: null, done, doneAt: done ? now : null, doneBy: done ? who : null, seen: true, createdBy: ownerUid, createdAt: stamp(addDays(-3), "11:00"), updatedAt: now,
    }]);
  });
  return docs;
}

async function commitAll(ops: ((b: WriteBatch) => void)[]) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    ops.slice(i, i + 400).forEach((op) => op(b));
    await b.commit();
  }
}

export function DemoData() {
  const { data, toast } = useCrm();
  const [busy, setBusy] = useState(false);
  const has = data.clients.some((c) => c.id.startsWith("demo_")) || data.staff.some((s) => s.id.startsWith("demo_"));

  async function add() {
    assertWritable();
    setBusy(true);
    try {
      const docs = build(data.uid);
      await commitAll(docs.map(([col, id, body]) => (b) => b.set(doc(db, col, id), body)));
      toast("انضافت البيانات التجريبية");
    } catch {
      toast("تعذّرت الإضافة، تأكد من أنك المالك");
    } finally {
      setBusy(false);
    }
  }

  async function removeAll() {
    assertWritable();
    setBusy(true);
    try {
      const ops: ((b: WriteBatch) => void)[] = [];
      for (const col of ["clients", "requests", "properties", "tasks", "staff", "goals"]) {
        const snap = await getDocs(collection(db, col));
        snap.docs.filter((d) => d.id.startsWith("demo_") || d.id.includes("_demo_")).forEach((d) => ops.push((b) => b.delete(d.ref)));
      }
      for (const s of STAFF) {
        const snap = await getDocs(collection(db, "attendance", s.id, "days"));
        snap.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
      }
      await commitAll(ops);
      // Staff docs last, in case a batch above needed them for rules.
      await Promise.all(STAFF.map((s) => deleteDoc(doc(db, "staff", s.id)).catch(() => {})));
      toast("انمسحت البيانات التجريبية (" + ops.length + ")");
    } catch {
      toast("تعذّر المسح، يرجى المحاولة مجدداً");
    } finally {
      setBusy(false);
    }
  }

  if (!data.isAdmin) return null;
  return (
    <div className="crm-card grid gap-2 p-4">
      <b className="text-sm">بيانات تجريبية</b>
      <p className="crm-hint m-0">
        يضيف هذا الخيار 3 موظفين تجريبيين و24 عميلاً بطلباتهم في جميع المراحل (منها عربونات ومبيعات)، إضافة إلى مكالمات وزيارات ومهام وأهداف، لتجربة النظام.
        تبدأ معرّفات جميع البيانات التجريبية بـ demo_، ويحذفها خيار «مسح» كاملةً دون المساس ببياناتك الحقيقية.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="crm-btn primary" disabled={busy || has} onClick={add}>{has ? "البيانات التجريبية موجودة" : "إضافة بيانات تجريبية"}</button>
        <button type="button" className="crm-btn danger" disabled={busy || !has} onClick={removeAll}>مسح البيانات التجريبية</button>
      </div>
    </div>
  );
}
