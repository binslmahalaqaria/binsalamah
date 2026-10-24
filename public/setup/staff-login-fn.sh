#!/bin/bash
# One-time setup (2026-10-24): an HTTPS Cloud Function the CRM calls when the owner deletes a staff member.
# It checks the caller is an active owner, then deletes the person's Firebase login and staff doc.
# (Firestore triggers can't run in me-central2, so this is called directly instead.) Run in Cloud Shell.
set -e
P=binsalamah-34cb1
FN_R=europe-west1
gcloud config set project $P >/dev/null
gcloud functions delete deleteStaffLogin --region=$FN_R --quiet >/dev/null 2>&1 || true
D=$(mktemp -d); cd $D
cat > package.json <<'J'
{ "name": "staff-delete-fn", "main": "index.js", "engines": { "node": "22" },
  "dependencies": { "@google-cloud/functions-framework": "^3.4.0", "firebase-admin": "^12.7.0" } }
J
cat > index.js <<'J'
const functions = require("@google-cloud/functions-framework");
const admin = require("firebase-admin");
admin.initializeApp();
const ORIGINS = ["https://www.binslmahre.com", "https://binslmahre.com", "http://localhost:3000"];
functions.http("staffDelete", async (req, res) => {
  const o = req.get("Origin");
  if (ORIGINS.includes(o)) res.set("Access-Control-Allow-Origin", o);
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const tok = (req.get("Authorization") || "").replace(/^Bearer /, "");
    const me = await admin.auth().verifyIdToken(tok);
    const caller = await admin.firestore().doc("staff/" + me.uid).get();
    if (!caller.exists || caller.get("role") !== "admin" || caller.get("active") !== true) return res.status(403).json({ error: "Forbidden" });
    const uid = req.body && req.body.uid;
    if (typeof uid !== "string" || !uid || uid === me.uid) return res.status(400).json({ error: "Invalid uid" });
    try { await admin.auth().deleteUser(uid); } catch (e) { if (e.code !== "auth/user-not-found") throw e; }
    await admin.firestore().doc("staff/" + uid).delete();
    console.log("staff deleted", uid, "by", me.uid);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: String((e && e.message) || e) });
  }
});
J
echo ">> deploying"
gcloud functions deploy staffDelete --gen2 --runtime=nodejs22 --region=$FN_R --source=. \
  --entry-point=staffDelete --trigger-http --allow-unauthenticated --quiet
echo ">> URL: $(gcloud functions describe staffDelete --region=$FN_R --gen2 --format='value(serviceConfig.uri)')"
echo ">> DONE-STAFF-FN"
