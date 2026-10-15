import { NextRequest, NextResponse } from "next/server";
import { caller, submit } from "@/lib/zatca/server";

/** Signs an issued invoice and reports / clears it with ZATCA. Any active staff member. */
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  try {
    if (!token || !(await caller(token))) return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
    const { id } = (await req.json()) as { id: string };
    if (!id) return NextResponse.json({ error: "no id" }, { status: 400 });
    return NextResponse.json(await submit(token, id));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
