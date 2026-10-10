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
  collection, doc, limit, onSnapshot, orderBy, query, Timestamp, updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import type { Staff } from "@/lib/types";
import type {
  AttendanceDay, ChatMsg, Client, CrmSettings, Goal, HrFile, PayrollRow, Property, Request, Task,
} from "./types";
import type { CrmData } from "./logic";
import { nowStamp } from "./util";

export type Modal =
  | { kind: "client"; id?: string }
  | { kind: "request"; id?: string; preset?: Partial<Request> & { _clientName?: string } }
  | { kind: "property"; id?: string }
  | { kind: "task"; id?: string; preset?: Partial<Task> }
  | { kind: "update"; clientId: string; type?: string; propertyId?: string }
  | { kind: "visit"; reqId: string }
  | { kind: "close"; reqId: string; to: string }
  | { kind: "cancel"; reqId: string; to?: string }
  | { kind: "reqMatches"; reqId: string }
  | { kind: "propReqs"; propId: string }
  | { kind: "goal"; uid: string; month: string }
  | { kind: "hr"; uid: string }
  | { kind: "attEdit"; uid: string; date: string };

interface CrmContextValue {
  data: CrmData;
  chat: ChatMsg[];
  settings: CrmSettings;
  loaded: boolean;
  me: Staff | null;
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
  const { user, staff: me } = useAuth();
  const uid = user?.uid || "";
  const isAdmin = me?.role === "admin";
  const isMgr = isAdmin || me?.role === "manager";

  const [clients, setClients] = useState<Client[]>([]);
  const [props, setProps] = useState<Property[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [hr, setHr] = useState<HrFile[]>([]);
  const [payroll, setPayroll] = useState<PayrollRow[]>([]);
  const [att, setAtt] = useState<Record<string, AttendanceDay[]>>({});
  const [settings, setSettings] = useState<CrmSettings>({ salesManager: null, escalateDays: 2, escalateOff: false });
  const [loadedKeys, setLoadedKeys] = useState<Set<string>>(new Set());
  const [viewAs, setViewAsState] = useState("");
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
    if (!uid || !me?.active) return;
    const subs = [
      onSnapshot(collection(db, "clients"), (s) => {
        setClients(s.docs.map((d) => withId<Client>(d)));
        markLoaded("clients");
      }),
      onSnapshot(collection(db, "properties"), (s) => {
        setProps(s.docs.map((d) => withId<Property>(d)));
        markLoaded("props");
      }),
      onSnapshot(collection(db, "requests"), (s) => {
        setRequests(s.docs.map((d) => withId<Request>(d)));
        markLoaded("requests");
      }),
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
      }),
      onSnapshot(query(collection(db, "chat"), orderBy("at", "desc"), limit(200)), (s) =>
        setChat(s.docs.map((d) => withId<ChatMsg>(d)).reverse())
      ),
      onSnapshot(doc(db, "crm", "settings"), (s) => {
        if (s.exists()) setSettings({ salesManager: null, escalateDays: 2, escalateOff: false, ...(s.data() as Partial<CrmSettings>) });
      }),
    ];
    return () => subs.forEach((u) => u());
  }, [uid, me?.active, markLoaded]);

  // Admin-only collections.
  useEffect(() => {
    if (!uid || !isAdmin) return;
    const subs = [
      onSnapshot(collection(db, "hr"), (s) => setHr(s.docs.map((d) => withId<HrFile>(d)))),
      onSnapshot(collection(db, "payroll"), (s) => setPayroll(s.docs.map((d) => withId<PayrollRow>(d)))),
    ];
    return () => subs.forEach((u) => u());
  }, [uid, isAdmin]);

  // Attendance: own days for everyone; every member's days for admins.
  const attIds = useMemo(
    () => (isAdmin ? staff.filter((s) => s.active).map((s) => s.id) : uid ? [uid] : []).join(","),
    [isAdmin, staff, uid]
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
    if (!uid || !me?.active || seenOnce.current) return;
    seenOnce.current = true;
    updateDoc(doc(db, "staff", uid), { lastSeen: nowStamp() }).catch(() => {});
  }, [uid, me?.active]);

  const data: CrmData = useMemo(
    () => ({ clients, props, requests, tasks, staff, goals, att, hr, payroll, uid, isMgr, isAdmin, viewAs: isMgr ? viewAs : "" }),
    [clients, props, requests, tasks, staff, goals, att, hr, payroll, uid, isMgr, isAdmin, viewAs]
  );

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastT.current) clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastMsg(null), 3000);
  }, []);

  const value: CrmContextValue = {
    data,
    chat,
    settings,
    loaded: ["clients", "props", "requests", "staff"].every((k) => loadedKeys.has(k)),
    me,
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
