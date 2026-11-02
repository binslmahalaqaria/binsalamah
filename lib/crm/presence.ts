/**
 * Online / offline for the team chat (client 2026-11-02). Each open CRM tab writes `staff/{uid}.lastSeen` about once a
 * minute, but only while the person is actually using it (mouse, keys, touch or scroll in the last minute). Someone with
 * no activity for 5 minutes stops writing and shows as offline. `lastSeen` is one of the fields a staff member may edit
 * on their own staff doc (firestore.rules), so no rules change is needed.
 */
import type { Staff } from "@/lib/types";

export const IDLE_MS = 5 * 60 * 1000;
export const BEAT_MS = 60 * 1000;

export const isOnline = (s: Pick<Staff, "lastSeen"> | undefined | null, now = Date.now()) => {
  const t = s?.lastSeen ? new Date(s.lastSeen).getTime() : 0;
  return !!t && now - t <= IDLE_MS;
};
