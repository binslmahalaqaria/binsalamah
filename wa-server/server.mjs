/**
 * WhatsApp link for the Bin Slmah CRM (unofficial "linked device", Baileys).
 * Several numbers ("sources") can be linked by QR: company numbers (managers)
 * and each employee's own number. The CRM page /admin/whatsapp is a unified
 * inbox over all of them.
 *
 * - Every request needs a Firebase ID token of an active staff member (verified
 *   with jose; the caller's staff doc is read over Firestore REST with their own
 *   token, so no service-account key is needed).
 * - Visibility is enforced here: managers see every source; others see a source
 *   if they own it, are its default employee, or it is shared with the team.
 * - Per source: data/sessions/<id>/auth (WhatsApp session) and store.json
 *   (recent text messages, chat tags). Source settings in data/sources.json.
 *   Keep data/ private; it is git-ignored.
 *
 * Run: npm start   (PORT, CRM_ORIGIN, FIREBASE_PROJECT_ID optional). See README.md.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import pino from "pino";
import QRCode from "qrcode";
import { createRemoteJWKSet, jwtVerify } from "jose";
import makeWASocket, {
  Browsers, DisconnectReason, fetchLatestBaileysVersion, isJidBroadcast, isJidGroup, isJidNewsletter,
  jidNormalizedUser, useMultiFileAuthState,
} from "@whiskeysockets/baileys";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(DIR, "data");
const SESS = path.join(DATA, "sessions");
const SOURCES_FILE = path.join(DATA, "sources.json");
fs.mkdirSync(SESS, { recursive: true });

function envFromDotLocal(key) {
  try {
    const txt = fs.readFileSync(path.join(DIR, "..", ".env.local"), "utf8");
    const m = txt.match(new RegExp("^" + key + "=(.*)$", "m"));
    return m ? m[1].trim().replace(/^"|"$/g, "") : undefined;
  } catch {
    return undefined;
  }
}
const PORT = Number(process.env.PORT || 4100);
const PROJECT = process.env.FIREBASE_PROJECT_ID || envFromDotLocal("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
const ORIGINS = (process.env.CRM_ORIGIN || "http://localhost:3000").split(",").map((s) => s.trim());
if (!PROJECT) throw new Error("FIREBASE_PROJECT_ID is not set");
const log = pino({ level: "warn" });
const MAX_MSGS = 3000; // per chat; high enough to keep older messages pulled on demand

/* ---------------- sources (settings) ---------------- */
// { id, label, kind: "company" | "personal", ownerUid, defaultAssignee, visibility: "team" | "private", createdAt }
let sources = [];
try {
  sources = JSON.parse(fs.readFileSync(SOURCES_FILE, "utf8"));
} catch {
  sources = [];
}
// One-time migration from the single-number layout (data/auth + data/store.json).
if (!sources.length && fs.existsSync(path.join(DATA, "auth"))) {
  const id = "company-1";
  fs.mkdirSync(path.join(SESS, id), { recursive: true });
  fs.renameSync(path.join(DATA, "auth"), path.join(SESS, id, "auth"));
  if (fs.existsSync(path.join(DATA, "store.json"))) fs.renameSync(path.join(DATA, "store.json"), path.join(SESS, id, "store.json"));
  sources = [{ id, label: "رقم الشركة", kind: "company", ownerUid: null, defaultAssignee: null, visibility: "private", createdAt: Date.now() }];
}
const saveSources = () => fs.writeFileSync(SOURCES_FILE, JSON.stringify(sources, null, 2));
saveSources();

/* ---------------- one WhatsApp session per source ---------------- */
const skip = (jid) => !jid || isJidGroup(jid) || isJidBroadcast(jid) || isJidNewsletter(jid) || jid.endsWith("@newsletter");
function textOf(m) {
  const x = m?.message || {};
  const inner = x.ephemeralMessage?.message || x.viewOnceMessage?.message || x.viewOnceMessageV2?.message || x;
  if (inner.conversation) return inner.conversation;
  if (inner.extendedTextMessage?.text) return inner.extendedTextMessage.text;
  if (inner.imageMessage) return "[صورة]" + (inner.imageMessage.caption ? " " + inner.imageMessage.caption : "");
  if (inner.videoMessage) return "[فيديو]" + (inner.videoMessage.caption ? " " + inner.videoMessage.caption : "");
  if (inner.documentMessage) return "[مستند] " + (inner.documentMessage.fileName || "");
  if (inner.audioMessage) return "[رسالة صوتية]";
  if (inner.stickerMessage) return "[ملصق]";
  if (inner.locationMessage) return "[موقع]";
  if (inner.contactMessage) return "[جهة اتصال] " + (inner.contactMessage.displayName || "");
  return null;
}

const sessions = new Map(); // id -> session

function makeSession(src) {
  const dir = path.join(SESS, src.id);
  fs.mkdirSync(dir, { recursive: true });
  const storeFile = path.join(dir, "store.json");
  const s = {
    id: src.id, sock: null, stopped: false, dirty: false,
    state: { status: "starting", qr: null, me: null, since: Date.now(), sync: { progress: null, done: false, at: null } },
    store: { chats: {}, msgs: {}, names: {}, lid: {}, labels: {}, chatLabels: {}, labelsSynced: false },
  };
  try {
    Object.assign(s.store, JSON.parse(fs.readFileSync(storeFile, "utf8")));
  } catch {
    /* new */
  }
  for (const [id, l] of Object.entries(s.store.labels)) if (/^‎/.test(l.name || "")) delete s.store.labels[id]; // built-in lists, not labels
  s.flush = () => {
    if (!s.dirty) return;
    s.dirty = false;
    fs.writeFileSync(storeFile, JSON.stringify(s.store));
  };
  s.timer = setInterval(s.flush, 10_000);
  // Unlinking (from the CRM or from the phone) also clears this number's saved chats, so nothing stays visible.
  s.wipe = () => {
    s.store.chats = {}; s.store.msgs = {}; s.store.names = {}; s.store.lid = {};
    s.store.labels = {}; s.store.chatLabels = {}; s.store.labelsSynced = false; s.store.backfilled = {};
    s.backfill.running = false;
    s.dirty = true;
    s.flush();
  };

  const canon = (jid) => {
    if (!jid) return jid;
    const j = jidNormalizedUser(jid);
    return j.endsWith("@lid") && s.store.lid[j] ? s.store.lid[j] : j;
  };
  const learnLid = (key) => {
    const alt = key?.senderPn || key?.remoteJidAlt || key?.participantPn;
    if (key?.remoteJid?.endsWith("@lid") && alt) s.store.lid[jidNormalizedUser(key.remoteJid)] = jidNormalizedUser(alt);
  };
  /** Move everything filed under a hidden @lid id to the real phone-number id once WhatsApp tells us. */
  const mapLid = (lid, pn) => {
    if (!lid || !pn) return;
    lid = jidNormalizedUser(lid);
    pn = jidNormalizedUser(pn);
    if (!lid.endsWith("@lid") || !pn.endsWith("@s.whatsapp.net") || s.store.lid[lid] === pn) return;
    s.store.lid[lid] = pn;
    const st = s.store;
    if (st.msgs[lid]) {
      const all = [...(st.msgs[pn] || []), ...st.msgs[lid]].filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i).sort((a, b) => a.ts - b.ts);
      st.msgs[pn] = all.slice(-MAX_MSGS);
      delete st.msgs[lid];
    }
    if (st.chats[lid]) {
      const a = st.chats[lid], b = st.chats[pn];
      st.chats[pn] = b && b.ts >= a.ts ? { ...b, unread: (b.unread || 0) + (a.unread || 0), tags: [...new Set([...(b.tags || []), ...(a.tags || [])])] }
        : { ...a, jid: pn, unread: (a.unread || 0) + (b?.unread || 0), tags: [...new Set([...(a.tags || []), ...(b?.tags || [])])] };
      delete st.chats[lid];
    }
    if (st.names[lid] && !st.names[pn]) st.names[pn] = st.names[lid];
    if (st.chatLabels[lid]) {
      st.chatLabels[pn] = [...new Set([...(st.chatLabels[pn] || []), ...st.chatLabels[lid]])];
      delete st.chatLabels[lid];
    }
    s.dirty = true;
  };
  s.mapLid = mapLid;
  /** Ask the library for the phone number behind every chat still filed under @lid. */
  s.resolveLids = async () => {
    const repo = s.sock?.signalRepository?.lidMapping;
    if (!repo) return 0;
    let n = 0;
    for (const jid of [...new Set([...Object.keys(s.store.chats), ...Object.keys(s.store.chatLabels)])].filter((j) => j.endsWith("@lid"))) {
      const pn = await repo.getPNForLID(jid).catch(() => null);
      if (pn) { mapLid(jid, pn); n++; }
    }
    return n;
  };

  s.ingest = (m, notify) => {
    learnLid(m.key);
    const jid = canon(m.key?.remoteJid);
    if (skip(jid)) return;
    const text = textOf(m);
    if (text == null) return;
    const ts = Number(m.messageTimestamp || 0) * 1000 || Date.now();
    const list = (s.store.msgs[jid] ||= []);
    if (list.some((x) => x.id === m.key.id)) return;
    list.push({ id: m.key.id, fromMe: !!m.key.fromMe, text, ts });
    list.sort((a, b) => a.ts - b.ts);
    if (list.length > MAX_MSGS) list.splice(0, list.length - MAX_MSGS);
    const c = (s.store.chats[jid] ||= { jid, unread: 0, ts: 0, tags: [] });
    if (ts >= c.ts) Object.assign(c, { ts, last: text, lastFromMe: !!m.key.fromMe });
    if (notify && !m.key.fromMe) c.unread = (c.unread || 0) + 1;
    if (m.pushName && !m.key.fromMe && !s.store.names[jid]) s.store.names[jid] = m.pushName;
    s.dirty = true;
  };

  s.connect = async () => {
    if (s.stopped) return;
    const { state: auth, saveCreds } = await useMultiFileAuthState(path.join(dir, "auth"));
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));
    const sock = makeWASocket({
      auth, version, logger: log,
      // "Desktop" identities (Mac OS / Windows) get refused by WhatsApp with 428 on this library version, so keep the default.
      browser: Browsers.appropriate("Bin Slmah CRM"),
      syncFullHistory: true, markOnlineOnConnect: false, printQRInTerminal: false,
    });
    s.sock = sock;
    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", async (u) => {
      if (u.qr) Object.assign(s.state, { status: "qr", qr: await QRCode.toDataURL(u.qr, { margin: 1, width: 300 }) });
      if (u.connection === "open") {
        s.fails = 0;
        Object.assign(s.state, { status: "open", qr: null, since: Date.now(), me: { id: jidNormalizedUser(sock.user?.id), name: sock.user?.name || null } });
        if (!s.store.labelsSynced) s.syncLabels().catch((e) => console.warn("[" + s.id + "] label sync failed:", e?.message || e));
      }
      if (u.connection === "close") {
        const code = u.lastDisconnect?.error?.output?.statusCode;
        const loggedOut = code === DisconnectReason.loggedOut;
        if (code && !loggedOut && code !== 408) console.warn("[" + s.id + "] connection closed:", code, u.lastDisconnect?.error?.message || "");
        Object.assign(s.state, { status: loggedOut ? "loggedOut" : "reconnecting", qr: null, since: Date.now(), me: loggedOut ? null : s.state.me });
        if (loggedOut) {
          fs.rmSync(path.join(dir, "auth"), { recursive: true, force: true });
          s.wipe();
        }
        // 408 = the QR codes expired unscanned: not a failure, show a fresh code right away.
        const qrExpired = code === DisconnectReason.timedOut || code === 408;
        s.fails = loggedOut || qrExpired ? 0 : (s.fails || 0) + 1;
        const wait = loggedOut || qrExpired ? 500 : Math.min(60_000, 3000 * 2 ** Math.min(s.fails - 1, 5));
        if (!s.stopped) setTimeout(s.connect, wait);
      }
    });
    sock.ev.on("lid-mapping.update", (m) => mapLid(m.lid, m.pn));
    // WhatsApp Business labels (التصنيفات): definitions and which chats carry them.
    sock.ev.on("labels.edit", (l) => {
      if (!l?.id) return;
      if (l.deleted) {
        delete s.store.labels[l.id];
        for (const j of Object.keys(s.store.chatLabels)) s.store.chatLabels[j] = s.store.chatLabels[j].filter((x) => x !== l.id);
      } else if (!/^‎/.test(l.name || "")) {
        // (names starting with U+200E are WhatsApp's built-in lists — Unread, Favorites, Groups — not labels)
        s.store.labels[l.id] = { id: l.id, name: l.name || "", color: l.color ?? 0 };
      }
      s.dirty = true;
    });
    sock.ev.on("labels.association", ({ association: a, type }) => {
      if (a?.type !== "label_jid" || !a.chatId) return;
      const jid = canon(a.chatId);
      const cur = new Set(s.store.chatLabels[jid] || []);
      if (type === "add") cur.add(a.labelId); else cur.delete(a.labelId);
      s.store.chatLabels[jid] = [...cur];
      s.dirty = true;
    });
    sock.ev.on("messaging-history.status", (st) => {
      if (st.status === "complete") Object.assign(s.state.sync, { done: true, at: Date.now() });
      s.resolveLids().catch(() => {});
    });
    sock.ev.on("messaging-history.set", ({ chats, contacts, messages, lidPnMappings, progress }) => {
      for (const m of lidPnMappings || []) mapLid(m.lid, m.pn);
      for (const c of contacts || []) {
        if (c.id?.endsWith("@lid") && c.phoneNumber) mapLid(c.id, c.phoneNumber);
        if (c.lid && c.id?.endsWith("@s.whatsapp.net")) mapLid(c.lid, c.id);
        if (c.id && (c.name || c.notify)) s.store.names[canon(c.id)] = c.name || c.notify;
      }
      if (progress != null) Object.assign(s.state.sync, { progress, at: Date.now(), done: progress >= 100 || s.state.sync.done });
      for (const c of chats || []) {
        const jid = canon(c.id);
        if (skip(jid)) continue;
        const x = (s.store.chats[jid] ||= { jid, unread: 0, ts: 0, tags: [] });
        x.unread = c.unreadCount || x.unread || 0;
        if (c.name) s.store.names[jid] = c.name;
      }
      for (const m of messages || []) s.ingest(m, false);
      s.dirty = true;
    });
    sock.ev.on("messages.upsert", ({ messages, type }) => messages.forEach((m) => s.ingest(m, type === "notify")));
    const names = (cs) => cs.forEach((c) => c.id && (c.name || c.notify) && (s.store.names[canon(c.id)] = c.name || c.notify));
    sock.ev.on("contacts.upsert", names);
    sock.ev.on("contacts.update", names);
  };
  /**
   * Labels arrive through WhatsApp app-state sync, which only replays everything on a fresh link.
   * For a number linked before labels were stored, reset the sync versions once and pull the full snapshot.
   */
  /**
   * "Pull all conversations": for every chat with at least one stored message, keep asking the phone
   * for 50 older messages until nothing more arrives (= the chat's first message). Chats already
   * finished are remembered in store.backfilled, so a restart resumes where it stopped. One request
   * at a time with a pause between them, to stay gentle with the phone and WhatsApp.
   */
  s.backfill = { running: false, done: 0, total: 0, added: 0, startedAt: null };
  s.runBackfill = async () => {
    if (s.backfill.running) return;
    const st = s.store;
    st.backfilled ||= {};
    const queue = Object.keys(st.msgs).filter((j) => j.endsWith("@s.whatsapp.net") && st.msgs[j]?.length && !st.backfilled[j]);
    Object.assign(s.backfill, { running: true, total: queue.length + Object.keys(st.backfilled).length, done: Object.keys(st.backfilled).length, added: 0, startedAt: Date.now() });
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
      for (const jid of queue) {
        for (let round = 0; round < 60 && s.backfill.running; round++) {
          if (s.state.status !== "open") { await sleep(5000); round--; continue; }
          const list = st.msgs[jid] || [];
          if (list.length >= MAX_MSGS) break;
          const before = list.length, oldest = list[0];
          await s.sock.fetchMessageHistory(50, { remoteJid: jid, fromMe: oldest.fromMe, id: oldest.id }, oldest.ts).catch(() => {});
          let grew = 0;
          for (let w = 0; w < 12 && !grew; w++) { await sleep(1000); grew = (st.msgs[jid]?.length || 0) - before; }
          s.backfill.added += Math.max(0, grew);
          if (grew <= 0) break; // reached the start of this chat
          await sleep(1500);
        }
        if (!s.backfill.running) break;
        st.backfilled[jid] = true;
        s.backfill.done++;
        s.dirty = true;
      }
    } finally {
      s.backfill.running = false;
      s.flush();
    }
  };
  s.syncLabels = async () => {
    const sock = s.sock;
    if (!sock?.resyncAppState) return;
    const names = ["critical_block", "critical_unblock_low", "regular_high", "regular_low", "regular"];
    await sock.authState.keys.set({ "app-state-sync-version": Object.fromEntries(names.map((n) => [n, null])) });
    await sock.resyncAppState(names, true);
    s.store.labelsSynced = true;
    s.dirty = true;
  };
  s.stop = async (logout) => {
    s.stopped = true;
    clearInterval(s.timer);
    s.flush();
    if (logout) await s.sock?.logout().catch(() => {});
    else s.sock?.end?.(undefined);
  };
  sessions.set(src.id, s);
  s.connect().catch((e) => Object.assign(s.state, { status: "error", error: String(e?.message || e) }));
  return s;
}
sources.forEach(makeSession);

/* ---------------- auth ---------------- */
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const staffCache = new Map();
async function staffOf(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (!token) return null;
  const { payload } = await jwtVerify(token, JWKS, { issuer: "https://securetoken.google.com/" + PROJECT, audience: PROJECT });
  const uid = payload.sub;
  const hit = staffCache.get(uid);
  if (hit && hit.at > Date.now() - 5 * 60_000) return hit.staff;
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/staff/${uid}`, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!r.ok) return null;
  const f = (await r.json()).fields || {};
  const perms = f.perms?.mapValue?.fields || {};
  const role = f.role?.stringValue;
  const staff = {
    uid, role, active: f.active?.booleanValue === true,
    mgr: role === "admin" || role === "manager",
    wa: role === "admin" || role === "manager" || perms.whatsapp?.booleanValue !== false, // on by default; the owner can turn it off per employee
  };
  staffCache.set(uid, { at: Date.now(), staff });
  return staff.active ? staff : null;
}
const canSee = (src, who) => who.mgr || src.ownerUid === who.uid || src.defaultAssignee === who.uid || src.visibility === "team";
const canManage = (src, who) => who.mgr || (src.ownerUid && src.ownerUid === who.uid);

/* ---------------- HTTP API ---------------- */
const send = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((ok) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => {
      try {
        ok(JSON.parse(b || "{}"));
      } catch {
        ok({});
      }
    });
  });
const pub = (src, who) => {
  const s = sessions.get(src.id);
  const unread = s ? Object.values(s.store.chats).reduce((n, c) => n + (c.unread || 0), 0) : 0;
  return {
    ...src, status: s?.state.status || "stopped", me: s?.state.me || null, since: s?.state.since || null, unread, sync: s?.state.sync || null,
    chats: s ? Object.keys(s.store.chats).length : 0, hidden: s ? Object.keys(s.store.chats).filter((j) => j.endsWith("@lid")).length : 0,
    qr: canManage(src, who) ? s?.state.qr || null : null, canManage: canManage(src, who), backfill: s?.backfill || null,
  };
};

http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  const url = new URL(req.url, "http://x");
  let who;
  try {
    who = await staffOf(req);
  } catch {
    who = null;
  }
  if (!who || !who.wa) return send(res, 401, { error: "unauthorized" });
  const body = req.method === "POST" ? await readBody(req) : {};
  const srcOf = (id) => sources.find((x) => x.id === id);

  try {
    // --- sources ---
    if (url.pathname === "/api/sources" && req.method === "GET") {
      return send(res, 200, { sources: sources.filter((x) => canSee(x, who)).map((x) => pub(x, who)), manager: who.mgr });
    }
    if (url.pathname === "/api/sources" && req.method === "POST") {
      const kind = body.kind === "company" && who.mgr ? "company" : "personal";
      if (kind === "personal" && sources.some((x) => x.kind === "personal" && x.ownerUid === who.uid)) return send(res, 409, { error: "exists" });
      const src = {
        id: (kind === "company" ? "company-" : "staff-") + crypto.randomBytes(4).toString("hex"),
        label: String(body.label || (kind === "company" ? "رقم الشركة" : "رقمي")).slice(0, 60),
        kind, ownerUid: kind === "personal" ? who.uid : null,
        defaultAssignee: kind === "personal" ? who.uid : body.defaultAssignee || null,
        visibility: body.visibility === "team" ? "team" : "private", createdAt: Date.now(),
      };
      sources.push(src);
      saveSources();
      makeSession(src);
      return send(res, 200, { source: pub(src, who) });
    }
    const m = url.pathname.match(/^\/api\/sources\/([\w-]+)\/(update|logout|remove|resolve|backfill|clear)$/);
    if (m && req.method === "POST") {
      const src = srcOf(m[1]);
      if (!src || !canManage(src, who)) return send(res, 403, { error: "forbidden" });
      if (m[2] === "update") {
        if (body.label != null) src.label = String(body.label).slice(0, 60);
        if (who.mgr && body.defaultAssignee !== undefined) src.defaultAssignee = body.defaultAssignee || null;
        if (body.visibility) src.visibility = body.visibility === "team" ? "team" : "private";
        saveSources();
        return send(res, 200, { source: pub(src, who) });
      }
      if (m[2] === "clear") {
        // "تصفير النظام": forget this number's saved chats but stay linked; new messages keep arriving.
        const cs = sessions.get(src.id);
        // Keep the label list itself (WhatsApp Business labels), drop which chats carry them.
        if (cs) { const labels = cs.store.labels; cs.backfill.running = false; cs.wipe(); Object.assign(cs.store, { labels, labelsSynced: true }); cs.dirty = true; cs.flush(); }
        return send(res, 200, { ok: true });
      }
      if (m[2] === "backfill") {
        const bs = sessions.get(src.id);
        if (!bs) return send(res, 404, { error: "no_session" });
        if (body.action === "stop") bs.backfill.running = false;
        else bs.runBackfill().catch((e) => console.warn("[" + src.id + "] backfill:", e?.message || e));
        return send(res, 200, { backfill: bs.backfill });
      }
      if (m[2] === "resolve") return send(res, 200, { resolved: await sessions.get(src.id)?.resolveLids() });
      if (m[2] === "logout") {
        // Unlink the phone and clear its saved chats; the source stays and a new QR appears.
        const s = sessions.get(src.id);
        await s?.sock?.logout().catch(() => {});
        s?.wipe();
        return send(res, 200, { ok: true });
      }
      await sessions.get(src.id)?.stop(true);
      sessions.delete(src.id);
      fs.rmSync(path.join(SESS, src.id), { recursive: true, force: true });
      sources = sources.filter((x) => x.id !== src.id);
      saveSources();
      return send(res, 200, { ok: true });
    }

    // --- inbox ---
    if (url.pathname === "/api/chats") {
      const out = [];
      for (const src of sources.filter((x) => canSee(x, who))) {
        const s = sessions.get(src.id);
        if (!s) continue;
        for (const c of Object.values(s.store.chats)) {
          if (!c.ts) continue;
          out.push({
            ...c, tags: c.tags || [], source: src.id, name: s.store.names[c.jid] || null, phone: c.jid.endsWith("@s.whatsapp.net") ? c.jid.split("@")[0] : null,
            labels: (s.store.chatLabels[c.jid] || []).filter((id) => s.store.labels[id]),
          });
        }
        // Labelled chats older than the synced history: no messages here, but the client and their label are still worth listing.
        for (const [jid, ids] of Object.entries(s.store.chatLabels)) {
          const labels = ids.filter((id) => s.store.labels[id]);
          if (!labels.length || s.store.chats[jid]?.ts || skip(jid)) continue;
          out.push({
            jid, unread: 0, ts: 0, tags: [], source: src.id, name: s.store.names[jid] || null,
            phone: jid.endsWith("@s.whatsapp.net") ? jid.split("@")[0] : null, labels, old: true,
          });
        }
      }
      out.sort((a, b) => b.ts - a.ts);
      const labels = sources.filter((x) => canSee(x, who)).flatMap((x) => Object.values(sessions.get(x.id)?.store.labels || {}).map((l) => ({ ...l, source: x.id })));
      return send(res, 200, { chats: out.slice(0, 3000), labels });
    }
    const src = srcOf(url.searchParams.get("source") || body.source);
    if (!src || !canSee(src, who)) return send(res, 404, { error: "no_source" });
    const s = sessions.get(src.id);
    if (url.pathname === "/api/messages") return send(res, 200, { messages: s.store.msgs[url.searchParams.get("jid")] || [] });
    if (url.pathname === "/api/read" && req.method === "POST") {
      const c = s.store.chats[body.jid];
      if (c) c.unread = 0;
      const lastIn = (s.store.msgs[body.jid] || []).filter((x) => !x.fromMe).slice(-1)[0];
      if (lastIn && s.state.status === "open") await s.sock.readMessages([{ remoteJid: body.jid, id: lastIn.id, fromMe: false }]).catch(() => {});
      s.dirty = true;
      return send(res, 200, { ok: true });
    }
    if (url.pathname === "/api/tags" && req.method === "POST") {
      const c = s.store.chats[body.jid];
      if (!c) return send(res, 404, { error: "no_chat" });
      c.tags = [...new Set((Array.isArray(body.tags) ? body.tags : []).map((t) => String(t).trim()).filter(Boolean))].slice(0, 10);
      s.dirty = true;
      return send(res, 200, { ok: true, tags: c.tags });
    }
    if (url.pathname === "/api/older" && req.method === "POST") {
      // Like WhatsApp Web scrolling up: ask the phone for messages older than the oldest one stored.
      // They arrive later through "messaging-history.set" (on-demand sync) and are stored by ingest().
      if (s.state.status !== "open") return send(res, 409, { error: "not_connected" });
      if (!body.jid) return send(res, 400, { error: "missing" });
      const oldest = (s.store.msgs[body.jid] || [])[0];
      // WhatsApp may file the chat under its hidden @lid id; ask under that id when we know it.
      const lid = Object.keys(s.store.lid).find((l) => s.store.lid[l] === body.jid);
      const chatJid = body.jid.endsWith("@lid") ? body.jid : lid && body.useLid ? lid : body.jid;
      await s.sock.fetchMessageHistory(50,
        { remoteJid: chatJid, fromMe: oldest?.fromMe ?? false, id: oldest?.id ?? "" },
        oldest?.ts ?? Date.now());
      return send(res, 200, { ok: true, had: (s.store.msgs[body.jid] || []).length, lid: !!lid });
    }
    if (url.pathname === "/api/label" && req.method === "POST") {
      // Add or remove a WhatsApp Business label on a chat; it changes on the phone too.
      if (s.state.status !== "open") return send(res, 409, { error: "not_connected" });
      if (!body.jid || !s.store.labels[body.labelId]) return send(res, 400, { error: "missing" });
      if (body.on) await s.sock.addChatLabel(body.jid, body.labelId);
      else await s.sock.removeChatLabel(body.jid, body.labelId);
      const cur = new Set(s.store.chatLabels[body.jid] || []);
      if (body.on) cur.add(body.labelId); else cur.delete(body.labelId);
      s.store.chatLabels[body.jid] = [...cur];
      s.dirty = true;
      return send(res, 200, { ok: true, labels: s.store.chatLabels[body.jid] });
    }
    if (url.pathname === "/api/send-media" && req.method === "POST") {
      // An image (e.g. a receipt rendered in the browser) with an optional caption, as a data URL.
      if (s.state.status !== "open") return send(res, 409, { error: "not_connected" });
      const m = /^data:(image\/(?:png|jpeg));base64,(.+)$/.exec(String(body.dataUrl || ""));
      if (!body.jid || !m) return send(res, 400, { error: "missing" });
      const buf = Buffer.from(m[2], "base64");
      if (buf.length > 5 * 1024 * 1024) return send(res, 413, { error: "too_large" });
      const caption = String(body.caption || "").slice(0, 1000);
      const sent = await s.sock.sendMessage(body.jid, { image: buf, mimetype: m[1], caption: caption || undefined });
      s.ingest(sent, false);
      return send(res, 200, { ok: true });
    }
    if (url.pathname === "/api/send" && req.method === "POST") {
      if (s.state.status !== "open") return send(res, 409, { error: "not_connected" });
      const text = String(body.text || "").trim();
      if (!body.jid || !text) return send(res, 400, { error: "missing" });
      const sent = await s.sock.sendMessage(body.jid, { text });
      s.ingest(sent, false);
      return send(res, 200, { ok: true });
    }
    return send(res, 404, { error: "not_found" });
  } catch (e) {
    return send(res, 500, { error: String(e?.message || e) });
  }
}).listen(PORT, () => console.log("WhatsApp server on http://localhost:" + PORT + " for project " + PROJECT + " — " + sources.length + " source(s)"));

const shutdown = async () => {
  for (const s of sessions.values()) s.flush();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
