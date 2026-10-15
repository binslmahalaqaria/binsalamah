import { NextRequest, NextResponse } from "next/server";
import { caller, onboard } from "@/lib/zatca/server";
import type { ZatcaEnv } from "@/lib/zatca/csr";

/** Links the CRM to ZATCA (Fatoora) with the owner's OTP — owner only. See lib/zatca/server.ts. */
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  try {
    const who = token ? await caller(token) : null;
    if (!who || who.role !== "admin") return NextResponse.json({ error: "الربط للمالك فقط" }, { status: 403 });
    const { env, otp } = (await req.json()) as { env: ZatcaEnv; otp: string };
    if (!["sandbox", "simulation", "production"].includes(env)) return NextResponse.json({ error: "بيئة غير معروفة" }, { status: 400 });
    if (!/^\d{6}$/.test(String(otp || ""))) return NextResponse.json({ error: "رمز التحقق (OTP) 6 أرقام" }, { status: 400 });
    const r = await onboard(token, env, String(otp), () => {});
    return NextResponse.json(r);
  } catch (e) {
    const m = (e as Error).message;
    return NextResponse.json({ error: m === "no_enc_key" ? "مفتاح التشفير ZATCA_ENC_KEY غير مضبوط على الخادم" : m }, { status: 500 });
  }
}
