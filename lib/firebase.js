import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Some serverless functions in this project (api/ipn.js,
// api/admin/process-withdrawal.js) read the service-account key
// as FIREBASE_PRIVATE_KEY_BASE64 (base64-encoded, avoids Vercel's
// newline-escaping headaches). Support both so a single secret
// setup works everywhere in the codebase.
function resolvePrivateKey() {
  if (process.env.FIREBASE_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, "base64").toString("utf8");
  }
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: resolvePrivateKey(),
    }),
  });
}

export const db = getFirestore();
export { FieldValue };
