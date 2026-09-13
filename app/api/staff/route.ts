import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { sign as cryptoSign } from "node:crypto";
import { adminApp } from "@/lib/firebase-admin";
import type { StaffRole } from "@/lib/types";

/**
 * Creates a new CRM staff account (Firebase Auth user + `staff` Firestore
 * doc). Admin-only. Uses privileged, non-client-SDK operations because the
 * client SDK can't create another user's account without replacing the
 * caller's own session — see lib/staff-client.ts and CLAUDE.md §1.
 *
 * Deliberately avoids `firebase-admin/auth`: that module unconditionally
 * requires `jwks-rsa`, which does a CJS `require()` of the ESM-only `jose`
 * package. That interop crashes with `ERR_REQUIRE_ESM` once Turbopack
 * bundles it for a deployed Vercel function (works fine in `next dev`,
 * and in `scripts/seed-admin.ts` which runs under plain Node, not
 * Turpoback) — see the Update Log entries around 2026-09-13's Vercel
 * deploy for the two failed attempts at fixing this via
 * `serverExternalPackages` before landing on this rewrite. Token
 * verification and user creation are done by hand below instead, using
 * `jose` directly (a normal ESM `import`, not a broken CJS require) and
 * plain REST calls. `firebase-admin/firestore` is unaffected and still
 * used normally for the `staff` doc.
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;

const firebaseJwks = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
);

async function verifyFirebaseIdToken(idToken: string): Promise<string> {
  const { payload } = await jwtVerify(idToken, firebaseJwks, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
  });
  if (!payload.sub) throw new Error("Token missing subject");
  return payload.sub;
}

function getServiceAccount(): { client_email: string; private_key: string } {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (inline) return JSON.parse(inline);
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "./service-account.json";
  return JSON.parse(readFileSync(path, "utf-8"));
}

/**
 * Mints a short-lived Google OAuth access token for the service account via
 * the JWT-bearer grant (RFC 7523) — signed by hand with Node's `crypto`
 * instead of `google-auth-library`, which pulls in the same broken
 * jwks-rsa/jose chain as firebase-admin/auth.
 */
async function getGoogleAccessToken(scopes: string[]): Promise<string> {
  const sa = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = cryptoSign("RSA-SHA256", Buffer.from(unsigned), sa.private_key);
  const assertion = `${unsigned}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description ?? "Failed to get a Google access token");
  }
  return data.access_token as string;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** Creates the Firebase Auth user via the Identity Platform REST API. */
async function createFirebaseUser(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<string> {
  const accessToken = await getGoogleAccessToken([
    "https://www.googleapis.com/auth/identitytoolkit",
  ]);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        displayName: input.displayName,
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message ?? "Failed to create the staff account");
  }
  return data.localId as string;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!idToken) {
    return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
  }

  let callerUid: string;
  try {
    callerUid = await verifyFirebaseIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
  }

  const db = getFirestore(adminApp);
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
    const uid = await createFirebaseUser({ email, password, displayName: name });

    await db.collection("staff").doc(uid).set({
      name,
      email,
      role: role as StaffRole,
      active: true,
      created_at: new Date(),
    });

    return NextResponse.json({ uid });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create staff";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
