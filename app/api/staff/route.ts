import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { adminApp } from "@/lib/firebase-admin";
import type { StaffRole } from "@/lib/types";

/**
 * Creates a new CRM staff account (Firebase Auth user + `staff` Firestore
 * doc). Admin-only. Uses the Admin SDK because the client SDK can't create
 * another user's account without replacing the caller's own session — see
 * lib/staff-client.ts and CLAUDE.md §1.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!idToken) {
    return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
  }

  const auth = getAuth(adminApp);
  const db = getFirestore(adminApp);

  let callerUid: string;
  try {
    callerUid = (await auth.verifyIdToken(idToken)).uid;
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
  }

  const callerDoc = await db.collection("staff").doc(callerUid).get();
  const callerData = callerDoc.data();
  if (!callerDoc.exists || callerData?.role !== "admin" || !callerData?.active) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const { name, email, password, role } = body ?? {};
  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    password.length < 6 ||
    (role !== "admin" && role !== "sales")
  ) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
    });

    await db.collection("staff").doc(userRecord.uid).set({
      name,
      email,
      role: role as StaffRole,
      active: true,
      created_at: new Date(),
    });

    return NextResponse.json({ uid: userRecord.uid });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create staff";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
