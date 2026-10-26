"use client";

/**
 * Live data + UI state for the sales CRM. Subscribes (onSnapshot) to every
 * CRM collection once for the whole /admin shell, the same way the original
 * artifact CRM loaded everything up front — the team is small, so computing
 * views client-side (see logic.ts) keeps every screen instant. HR, payroll,
 * and other people's attendance are only subscribed for admins, matching
 * firestore.rules.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import {
  collection, doc, limit, onSnapshot, orderBy, query, Timestamp, updateDoc, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Staff } from "@/lib/types";
import type {
  AttendanceDay, ChatMsg, Client, DirectMsg, Invoice, CrmSettings, Goal, HrFile, PayrollRow, Property, Proposal, Request, Task, Viewing,
} from "./types";
import type { CrmData, NumberFeed, RoundRobin } from "./logic";
import { nowStamp } from "./util";
import { PROP_LEGACY, PTYPES, SOURCES } from "./constants";
import { setPreviewMode } from "./preview";

export type Modal =
  | { kind: "client"; id?: string }
  | { kind: "request"; id?: string; preset?: Partial<Request> & { _clientName?: string; _newName?: string; _newPhone?: string } }
  | { kind: "property"; id?: string }
  | { kind: "task"; id?: string; preset?: Partial<Task> }
  | { kind: "update"; clientId: string; type?: string; propertyId?: string; reqId?: string }
  | { kind: "visit"; reqId: string; propertyId?: string; viewingId?: string }
  | { kind: "close"; reqId: string; to: string }
  | { kind: "cancel"; reqId: string; to?: string }
  | { kind: "reqMatches"; reqId: string }
  | { kind: "propReqs"; propId: string }
  | { kind: "transfer"; reqId: string }
  | { kind: "viewResult"; viewingId: string }
  | { kind: "goal"; uid: string; month: string }
  | { kind: "hr"; uid: string }
  | { kind: "attEdit"; uid: string; date: string };

interface CrmContextValue {
  data: CrmData;
  chat: ChatMsg[];
  /** My private conversations (empty while previewing as an employee). */
  dms: DirectMsg[];
  /** True when Firestore refused the "dm" query (rules not published yet). */
  dmBlocked: boolean;
  /** Tax invoices, newest first. */
  invoices: Invoice[];
  settings: CrmSettings;
  loaded: boolean;
  me: Staff | null;
  /** The signed-in manager while previewing as an employee (otherwise the same as me). */
  realMe: Staff | null;
  /** uid of the employee being previewed ("الدخول كموظف"), or null. */
  previewAs: string | null;
  startPreview: (uid: string) => void;
  stopPreview: () => void;
  setViewAs: (v: string) => void;
  toast: (msg: string) => void;
  toastMsg: string | null;
  modal: Modal | null;
  openModal: (m: Modal) => void;
  closeModal: () => void;
  drawer: { id: string; req?: string } | null;
  openClient: (id: string, req?: string) => void;
  closeClient: () => void;
}

const Ctx = createContext<CrmContextValue | null>(null);

const withId = <T,>(d: { id: string; data: () => Record<string, unknown> }) => ({ id: d.id, ...d.data() }) as T;
const store = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

export function CrmProvider({ children }: { children: ReactNode }) {
  const { user, staff: realMe } = useAuth();
  const realUid = user?.uid || "";
  const realAdmin = realMe?.role === "admin";
  const realMgr = realAdmin || realMe?.role === "manager";

  const [clients, setClients] = useState<Client[]>([]);
  const [props, setProps] = useState<Property[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [dms, setDms] = useState<DirectMsg[]>([]);
  const [dmBlocked, setDmBlocked] = useState(false);
  const [dmRetry, setDmRetry] = useState(0);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [viewings, setViewings] = useState<Viewing[]>([]);
  const [jrRetry, setJrRetry] = useState(0);
  const [invRetry, setInvRetry] = useState(0);
  const [hr, setHr] = useState<HrFile[]>([]);
  const [payroll, setPayroll] = useState<PayrollRow[]>([]);
  const [att, setAtt] = useState<Record<string, AttendanceDay[]>>({});
  const [settings, setSettings] = useState<CrmSettings>({ salesManager: null, escalateDays: 2, escalateOff: false });
  const [loadedKeys, setLoadedKeys] = useState<Set<string>>(new Set());
  const [viewAs, setViewAsState] = useState("");
  const [propTypes, setPropTypes] = useState<string[]>([...PTYPES]);
  const [sources, setSources] = useState<string[]>([...SOURCES]);
  const [rr, setRr] = useState<RoundRobin>({ on: false, order: [], last: null });
  const [feed, setFeed] = useState<NumberFeed>({ on: false, batch: 10 });
  const [previewAs, setPreviewAs] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal | null>(null);
  const [drawer, setDrawer] = useState<{ id: string; req?: string } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setViewAsState(store.get("crm.viewAs") || "");
  }, []);

  const markLoaded = useCallback((k: string) => {
    setLoadedKeys((s) => (s.has(k) ? s : new Set(s).add(k)));
  }, []);

  // Shared collections every active staff member can read.
  useEffect(() => {
    if (!realUid || !realMe?.active) return;
    const subs = [
      // Each core listener marks itself loaded even on error, so the CRM never sits on
      // «جارٍ تحميل البيانات» because one collection failed (it shows what it has).
      onSnapshot(collection(db, "clients"), (s) => {
        setClients(s.docs.map((d) => withId<Client>(d)));
        markLoaded("clients");
      }, (e) => { console.error("clients", e); markLoaded("clients"); }),
      onSnapshot(collection(db, "properties"), (s) => {
        setProps(s.docs.map((d) => withId<Property>(d)));
        markLoaded("props");
      }, (e) => { console.error("properties", e); markLoaded("props"); }),
      onSnapshot(collection(db, "requests"), (s) => {
        setRequests(s.docs.map((d) => { const r = withId<Request>(d); return r.status === "معاينة" ? { ...r, status: "أرسلنا خيارات" } : r; }));
        markLoaded("requests");
      }, (e) => { console.error("requests", e); markLoaded("requests"); }),
      onSnapshot(collection(db, "tasks"), (s) => setTasks(s.docs.map((d) => withId<Task>(d)))),
      onSnapshot(collection(db, "goals"), (s) => setGoals(s.docs.map((d) => withId<Goal>(d)))),
      onSnapshot(collection(db, "staff"), (s) => {
        setStaff(
          s.docs.map((d) => {
            const x = d.data();
            return {
              id: d.id,
              ...x,
              created_at: x.created_at instanceof Timestamp ? x.created_at.toMillis() : 0,
            } as Staff;
          })
        );
        markLoaded("staff");
      }, (e) => { console.error("staff", e); markLoaded("staff"); }),
      onSnapshot(query(collection(db, "chat"), orderBy("at", "desc"), limit(200)), (s) =>
        setChat(s.docs.map((d) => withId<ChatMsg>(d)).reverse())
      ),
      onSnapshot(doc(db, "crm", "lists"), (s) => {
        const xs = s.exists() ? (s.data().propTypes as unknown) : null;
        setPropTypes(Array.isArray(xs) && xs.length ? xs.map(String) : [...PTYPES]);
        const ss = s.exists() ? (s.data().sources as unknown) : null;
        setSources(Array.isArray(ss) && ss.length ? ss.map(String) : [...SOURCES]);
        const r = (s.exists() ? s.data().rr : null) as Partial<RoundRobin> | null;
        setRr({ on: !!r?.on, order: Array.isArray(r?.order) ? r!.order.map(String) : [], last: r?.last ?? null });
        const fd = (s.exists() ? s.data().feed : null) as Partial<NumberFeed> | null;
        setFeed({ on: !!fd?.on, batch: Math.min(50, Math.max(1, Number(fd?.batch) || 10)) });
      }),
      onSnapshot(doc(db, "crm", "settings"), (s) => {
        if (s.exists()) setSettings({ salesManager: null, escalateDays: 2, escalateOff: false, ...(s.data() as Partial<CrmSettings>) });
      }),
    ];
    return () => subs.forEach((u) => u());
  }, [realUid, realMe?.active, markLoaded]);

  // Private messages: only conversations I am a member of (the rules require the array-contains filter).
  useEffect(() => {
    if (!realUid || !realMe?.active) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const un = onSnapshot(
      query(collection(db, "dm"), where("members", "array-contains", realUid), limit(1000)),
      (s) => { setDmBlocked(false); setDms(s.docs.map((d) => withId<DirectMsg>(d)).sort((a, b) => a.at.localeCompare(b.at))); },
      () => { setDmBlocked(true); t = setTimeout(() => setDmRetry((n) => n + 1), 15000); },
    );
    return () => { un(); if (t) clearTimeout(t); };
  }, [realUid, realMe?.active, dmRetry]);

  useEffect(() => {
    if (!realUid || !realMe?.active) return;
    // A refused listener stops for good, so retry (e.g. right after new security rules are published).
    let t: ReturnType<typeof setTimeout> | undefined;
    const un = onSnapshot(collection(db, "invoices"),
      (s) => setInvoices(s.docs.map((d) => withId<Invoice>(d)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))),
      () => { t = setTimeout(() => setInvRetry((n) => n + 1), 15000); });
    return () => { un(); if (t) clearTimeout(t); };
  }, [realUid, realMe?.active, invRetry]);

  // Offers and viewings (trial): retried like invoices if the rules are not published yet.
  useEffect(() => {
    if (!realUid || !realMe?.active) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const retry = () => { if (!t) t = setTimeout(() => setJrRetry((n) => n + 1), 15000); };
    const subs = [
      onSnapshot(collection(db, "proposals"), (s) => setProposals(s.docs.map((d) => { const p = withId<Proposal>(d); return PROP_LEGACY.includes(p.status) ? { ...p, status: "مهتم" } : p; }).sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)))), retry),
      onSnapshot(collection(db, "viewings"), (s) => setViewings(s.docs.map((d) => withId<Viewing>(d)).sort((a, b) => String(a.at).localeCompare(String(b.at)))), retry),
    ];
    return () => { subs.forEach((u) => u()); if (t) clearTimeout(t); };
  }, [realUid, realMe?.active, jrRetry]);

  // Admin-only collections.
  useEffect(() => {
    if (!realUid || !realAdmin) return;
    const subs = [
      onSnapshot(collection(db, "hr"), (s) => setHr(s.docs.map((d) => withId<HrFile>(d)))),
      onSnapshot(collection(db, "payroll"), (s) => setPayroll(s.docs.map((d) => withId<PayrollRow>(d)))),
    ];
    return () => subs.forEach((u) => u());
  }, [realUid, realAdmin]);

  // Attendance: own days for everyone; every member's days for admins.
  const attIds = useMemo(
    () => (realAdmin ? staff.filter((s) => s.active).map((s) => s.id) : realUid ? [realUid] : []).join(","),
    [realAdmin, staff, realUid]
  );
  useEffect(() => {
    if (!attIds) return;
    const subs = attIds.split(",").map((id) =>
      onSnapshot(
        collection(db, "attendance", id, "days"),
        (s) => setAtt((a) => ({ ...a, [id]: s.docs.map((d) => withId<AttendanceDay>(d)) })),
        () => {}
      )
    );
    return () => subs.forEach((u) => u());
  }, [attIds]);

  // Record last-seen once per session (shown on the Team screen).
  const seenOnce = useRef(false);
  useEffect(() => {
    if (!realUid || !realMe?.active || seenOnce.current) return;
    seenOnce.current = true;
    updateDoc(doc(db, "staff", realUid), { lastSeen: nowStamp() }).catch(() => {});
  }, [realUid, realMe?.active]);

  // Preview ("الدخول كموظف"): everything below renders as that employee; writes are blocked (lib/crm/preview.ts).
  const target = previewAs ? staff.find((s) => s.id === previewAs) || null : null;
  const me = target || realMe;
  const uid = target ? target.id : realUid;
  const isAdmin = target ? target.role === "admin" : realAdmin;
  const isMgr = target ? target.role === "admin" || target.role === "manager" : realMgr;
  useEffect(() => setPreviewMode(!!target), [target]);

  const data: CrmData = useMemo(
    () => ({ proposals, viewings, clients, props, requests, tasks, staff, goals, att, hr, payroll, uid, isMgr, isAdmin, viewAs: isMgr ? viewAs : "", propTypes, sources, rr, feed }),
    [proposals, viewings, clients, props, requests, tasks, staff, goals, att, hr, payroll, uid, isMgr, isAdmin, viewAs, propTypes, sources, rr, feed]
  );

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastT.current) clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastMsg(null), 3000);
  }, []);

  const value: CrmContextValue = {
    data,
    chat,
    dms: previewAs ? [] : dms,
    dmBlocked,
    invoices,
    settings,
    loaded: ["clients", "props", "requests", "staff"].every((k) => loadedKeys.has(k)),
    me,
    realMe,
    previewAs: target ? previewAs : null,
    startPreview: (id) => {
      const t = staff.find((s) => s.id === id);
      // Managers may preview sales staff; only the owner may preview a manager.
      if (!realMgr || !t || id === realUid || t.role === "admin" || (t.role === "manager" && !realAdmin)) return;
      setViewAsState("");
      setDrawer(null);
      setModal(null);
      setPreviewAs(id);
    },
    stopPreview: () => {
      setPreviewAs(null);
      setDrawer(null);
      setModal(null);
    },
    setViewAs: (v) => {
      setViewAsState(v);
      store.set("crm.viewAs", v);
    },
    toast,
    toastMsg,
    modal,
    openModal: setModal,
    closeModal: () => setModal(null),
    drawer,
    openClient: (id, req) => setDrawer({ id, req }),
    closeClient: () => setDrawer(null),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCrm() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCrm must be used inside CrmProvider");
  return v;
}
