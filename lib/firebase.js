import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function loadEnvFallback() {
  const envFilePath = join(process.cwd(), ".env.local");
  if (!existsSync(envFilePath)) return;

  const lines = readFileSync(envFilePath, "utf8").split(/\r?\n/);
  let currentKey = null;
  let currentParts = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    const trimmed = line.trim();

    if (currentKey) {
      currentParts.push(line);
      if (trimmed.endsWith('"')) {
        const rawValue = currentParts.join("\n").trim();
        const value = rawValue.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
        if (!process.env[currentKey]) process.env[currentKey] = value;
        currentKey = null;
        currentParts = [];
      }
      continue;
    }

    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (!process.env[key] && value.startsWith('"') && !value.endsWith('"')) {
      currentKey = key;
      currentParts = [value.slice(1)];
      continue;
    }

    if (!process.env[key]) {
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key === "FIREBASE_PRIVATE_KEY" || key === "FIREBASE_PRIVATE_KEY_BASE64") {
        value = value.replace(/\\n/g, "\n");
      }
      process.env[key] = value;
    }
  }
}

loadEnvFallback();

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
      project_id: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: resolvePrivateKey(),
    }),
  });
}

export const db = getFirestore();
export { FieldValue };
