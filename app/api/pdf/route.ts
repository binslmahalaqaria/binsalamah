import { NextResponse, type NextRequest } from "next/server";
import { activeStaffUid } from "@/lib/verify-staff";

/**
 * POST { html } → application/pdf. Turns a CRM document (receipt, invoice) into a real
 * PDF — vector text, A4, prints sharp — instead of a screenshot (client 2026-10-21).
 * The browser sends the document's own HTML with the page's stylesheets; a headless
 * Chromium renders it in print mode. Active staff only; the page may load files only
 * from this site and Google Fonts (everything else is blocked).
 * On Vercel the browser is @sparticuz/chromium; locally set CHROME_PATH or the default
 * Windows Chrome path is used.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const LOCAL_CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

async function launch() {
  const puppeteer = (await import("puppeteer-core")).default;
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  }
  return puppeteer.launch({ executablePath: LOCAL_CHROME, headless: true });
}

export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const uid = token ? await activeStaffUid(token).catch(() => null) : null;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { html } = (await req.json().catch(() => ({}))) as { html?: string };
  if (!html || html.length > 4_000_000) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const origin = req.nextUrl.origin;
  const allowed = (u: string) =>
    u.startsWith("data:") || u.startsWith(origin + "/") || u.startsWith("https://fonts.googleapis.com/") || u.startsWith("https://fonts.gstatic.com/");

  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    // The document has no origin of its own (set from a string), so the browser would refuse the site's
    // fonts (cross-origin). Files from this site are fetched here and handed over with an open CORS header.
    page.on("request", async (r) => {
      const u = r.url();
      if (!allowed(u)) return r.abort();
      if (!u.startsWith(origin + "/")) return r.continue();
      try {
        const res = await fetch(u);
        r.respond({ status: res.status, contentType: res.headers.get("content-type") || undefined,
          headers: { "Access-Control-Allow-Origin": "*" }, body: Buffer.from(await res.arrayBuffer()) });
      } catch {
        r.abort();
      }
    });
    await page.emulateMediaType("print");
    await page.setContent(html.replace("<head>", `<head><base href="${origin}/">`), { waitUntil: "load", timeout: 30_000 });
    await page.waitForNetworkIdle({ idleTime: 300, timeout: 15_000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return new NextResponse(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "render_failed" }, { status: 500 });
  } finally {
    await browser.close().catch(() => {});
  }
}
