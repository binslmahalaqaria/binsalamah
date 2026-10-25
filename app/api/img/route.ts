import { NextRequest, NextResponse } from "next/server";
import { activeStaffUid } from "@/lib/verify-staff";

/**
 * Fetches one property photo for the CRM's «تنزيل كل الصور» (client 2026-10-25). Photos live on other hosts
 * (Firebase Storage, pasted links) that don't allow the browser to read them, so active staff fetch them
 * through here. Staff-only (Firebase ID token), https only, images only, 15 MB max.
 */
export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  if (!token) return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
  try {
    if (!(await activeStaffUid(token))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
  }
  const u = req.nextUrl.searchParams.get("u") || "";
  let url: URL;
  try { url = new URL(u); } catch { return NextResponse.json({ error: "Bad url" }, { status: 400 }); }
  if (url.protocol !== "https:") return NextResponse.json({ error: "https only" }, { status: 400 });
  const res = await fetch(url, { redirect: "follow" }).catch(() => null);
  if (!res || !res.ok) return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  const type = res.headers.get("content-type") || "";
  if (!type.startsWith("image/")) return NextResponse.json({ error: "Not an image" }, { status: 415 });
  const buf = await res.arrayBuffer();
  if (buf.byteLength > 15 * 1024 * 1024) return NextResponse.json({ error: "Too large" }, { status: 413 });
  return new NextResponse(buf, { headers: { "Content-Type": type, "Cache-Control": "private, no-store" } });
}
