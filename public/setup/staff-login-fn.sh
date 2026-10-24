#!/bin/bash
# One-time setup (2026-10-24): a Cloud Function that deletes a staff member's Firebase login
# as soon as their staff/{uid} document is deleted from the CRM. Run in Cloud Shell.
set -e
P=binsalamah-34cb1
R=me-central2
gcloud config set project $P >/dev/null
echo ">> enabling APIs"
gcloud services enable cloudfunctions.googleapis.com cloudbuild.googleapis.com run.googleapis.com eventarc.googleapis.com artifactregistry.googleapis.com firebase.googleapis.com identitytoolkit.googleapis.com --quiet
D=$(mktemp -d); cd $D
cat > package.json <<'J'
{ "name": "staff-login-fn", "main": "index.js", "engines": { "node": "20" },
  "dependencies": { "@google-cloud/functions-framework": "^3.4.0", "firebase-admin": "^12.7.0" } }
J
cat > index.js <<'J'
const functions = require("@google-cloud/functions-framework");
const admin = require("firebase-admin");
admin.initializeApp();
// staff/{uid} deleted in the CRM -> delete that person's login so the email is free again.
functions.cloudEvent("deleteStaffLogin", async (ce) => {
  const m = /documents\/staff\/([^/]+)$/.exec(ce.subject || "");
  if (!m) return;
  try { await admin.auth().deleteUser(m[1]); console.log("deleted login", m[1]); }
  catch (e) { if (e.code !== "auth/user-not-found") throw e; console.log("no login for", m[1]); }
});
J
echo ">> deploying"
gcloud functions deploy deleteStaffLogin --gen2 --runtime=nodejs20 --region=$R --source=. \
  --entry-point=deleteStaffLogin \
  --trigger-event-filters=type=google.cloud.firestore.document.v1.deleted \
  --trigger-event-filters=database='(default)' \
  --trigger-event-filters-path-pattern=document='staff/{uid}' \
  --trigger-location=$R --quiet
echo ">> DONE-STAFF-FN"
