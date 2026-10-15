/**
 * Location check for attendance: check-in/out is allowed only within a radius
 * of the office (set by the owner), unless the employee is marked "from any
 * place". Uses the browser's location (phone GPS / Wi-Fi), so it needs HTTPS or
 * localhost and the user's permission. It is a working rule, not a security
 * boundary — a determined user can fake a browser location.
 */
import type { CrmSettings } from "./types";

export interface GeoPoint { lat: number; lng: number }
export interface GeoFix extends GeoPoint { acc: number }
/** Saved on the attendance day: where the check happened and how far from the office. */
export interface AttLoc extends GeoFix { dist: number | null }

/** Great-circle distance in metres. */
export function distanceM(a: GeoPoint, b: GeoPoint) {
  const R = 6371e3, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export const fmtDist = (m: number) => (m >= 1000 ? (Math.round(m / 100) / 10).toLocaleString("en-US") + " كم" : m + " م");
export const mapLink = (p: GeoPoint) => "https://www.google.com/maps?q=" + p.lat + "," + p.lng;

/** The device's current position (fresh, high accuracy). */
export function getFix(): Promise<GeoFix> {
  return new Promise((ok, fail) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return fail(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }),
      (e) => fail(new Error(e.code === 1 ? "denied" : e.code === 3 ? "timeout" : "unavailable")),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

/** Coordinates from "24.7, 46.6", or a Google Maps link containing @lat,lng / q=lat,lng / !3dlat!4dlng. */
export function parsePoint(s: string): GeoPoint | null {
  const t = decodeURIComponent(s.trim());
  const m = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(t) || /[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/.exec(t)
    || /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(t) || /^(-?\d+\.\d+)\s*[,،]\s*(-?\d+\.\d+)$/.exec(t);
  if (!m) return null;
  const lat = +m[1], lng = +m[2];
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export const officeOf = (s: CrmSettings): GeoPoint | null =>
  s.officeLat != null && s.officeLng != null ? { lat: s.officeLat, lng: s.officeLng } : null;

/**
 * Locates the employee for a check-in/out. When the rule is on (and they are not exempt) it refuses outside
 * the radius; the GPS accuracy is given the benefit of the doubt up to 100 m.
 */
export async function locateForAttendance(s: CrmSettings, exempt: boolean): Promise<{ ok: true; loc: AttLoc | null } | { ok: false; msg: string }> {
  const office = officeOf(s);
  const enforce = !!s.geoOn && !!office && !exempt;
  let fix: GeoFix;
  try {
    fix = await getFix();
  } catch (e) {
    if (!enforce) return { ok: true, loc: null };
    const code = (e as Error).message;
    return { ok: false, msg: code === "denied" ? "يجب السماح للنظام بالوصول إلى موقعك من إعدادات المتصفح ثم المحاولة مرة أخرى" : code === "timeout" ? "تعذّر تحديد موقعك في الوقت المحدد — تأكد من تشغيل الموقع (GPS) وحاول مجدداً" : "تعذّر تحديد موقعك على هذا الجهاز" };
  }
  const dist = office ? distanceM(fix, office) : null;
  const radius = s.officeRadius || 200;
  if (enforce && dist != null && dist - Math.min(fix.acc, 100) > radius)
    return { ok: false, msg: "أنت خارج موقع الدوام — على بُعد " + fmtDist(dist) + " من المكتب (المسموح " + fmtDist(radius) + "). التسجيل من موقع العمل فقط." };
  return { ok: true, loc: { ...fix, dist } };
}
