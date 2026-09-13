/**
 * One-time script to create the first `admin` staff account, per
 * CLAUDE.md Phase 0: "Seed script or manual creation of first admin
 * staff account."
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json \
 *     npm run seed:admin -- --email you@company.com --password "..." --name "Your Name"
 *
 * Requires a Firebase service account key (Project settings > Service
 * accounts > Generate new private key). Never commit that file.
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";

function arg(name: string): string | undefined {
  const flag = `--${name}`;
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const email = arg("email");
  const password = arg("password");
  const name = arg("name") ?? "Admin";

  if (!email || !password) {
    console.error(
      "Usage: npm run seed:admin -- --email you@company.com --password \"...\" --name \"Your Name\""
    );
    process.exit(1);
  }

  const credentialsPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "./service-account.json";
  const serviceAccount = JSON.parse(readFileSync(credentialsPath, "utf-8"));

  if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount) });
  }

  const auth = getAuth();
  const db = getFirestore();

  const existing = await auth
    .getUserByEmail(email)
    .catch(() => null);

  const user =
    existing ??
    (await auth.createUser({ email, password, displayName: name }));

  await db.collection("staff").doc(user.uid).set(
    {
      name,
      email,
      role: "admin",
      active: true,
      created_at: Date.now(),
    },
    { merge: true }
  );

  console.log(`Admin staff account ready: ${email} (uid: ${user.uid})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
