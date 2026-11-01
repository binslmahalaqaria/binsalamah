import { NextRequest, NextResponse } from "next/server";

/**
 * Public photo fetch for «تنزيل الصور» on a property page (client 2026-11-01). Visitors' browsers can't read the photos
 * of other hosts directly, so the page fetches them through here and zips them. To keep this from being an open proxy it
 * only serves images of OUR Firebase Storage bucket (where offer photos are uploaded), https only, images only, 15 MB max.
 */
const BUCKET = "binsalamah-34cb1";

function allowed(url: URL) {
  if (url.protocol !== "https:") return false;
  if (url.hostname === "firebasestorage.googleapis.com") return url.pathname.startsWith("/v0/b/" + BUCKET + ".");
  if (url.hostname === "storage.googleapis.com") return url.pathname.startsWith("/" + BUCKET + ".");
  return false;
}

export async function GET(req: NextRequest) {
  let url: URL;
  try { url = new URL(req.nextUrl.searchParams.get("u") || ""); } catch { return NextResponse.json({ error: "Bad url" }, { status: 400 }); }
  if (!allowed(url)) return NextResponse.json({ error: "Not allowed" }, { status: 400 });
  const res = await fetch(url, { redirect: "error" }).catch(() => null);
  if (!res || !res.ok) return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  const type = res.headers.get("content-type") || "";
  if (!type.startsWith("image/")) return NextResponse.json({ error: "Not an image" }, { status: 415 });
  const buf = await res.arrayBuffer();
  if (buf.byteLength > 15 * 1024 * 1024) return NextResponse.json({ error: "Too large" }, { status: 413 });
  return new NextResponse(buf, { headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600" } });
}
