import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function loadEnvFallback() {
  const candidates = [
    join(process.cwd(), ".env.local"),
    join(process.cwd(), "..", ".env.local"),
    join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local"),
  ];

  for (const envFilePath of candidates) {
    if (!existsSync(envFilePath)) continue;

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

    break;
  }
}

loadEnvFallback();

function normalizePrivateKey(value) {
  if (!value) return "";

  let normalized = String(value).trim();
  if ((normalized.startsWith('"') && normalized.endsWith('"')) || (normalized.startsWith("'") && normalized.endsWith("'"))) {
    normalized = normalized.slice(1, -1);
  }

  normalized = normalized.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
  normalized = normalized.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  normalized = normalized.replace(/\s+$/g, "").trim();

  return normalized;
}

// Some serverless functions in this project (api/ipn.js,
// api/admin/process-withdrawal.js) read the service-account key
// as FIREBASE_PRIVATE_KEY_BASE64 (base64-encoded, avoids Vercel's
// newline-escaping headaches). Support both so a single secret
// setup works everywhere in the codebase.
function resolvePrivateKey() {
  if (process.env.FIREBASE_PRIVATE_KEY_BASE64) {
    try {
      return Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, "base64").toString("utf8").trim();
    } catch (error) {
      console.warn("Could not decode FIREBASE_PRIVATE_KEY_BASE64, falling back to FIREBASE_PRIVATE_KEY.");
    }
  }
  return normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
}

let firebaseDb = null;
let firebaseInitError = null;

function initFirebase() {
  if (firebaseDb) return firebaseDb;

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = resolvePrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    firebaseInitError = new Error("Firebase Admin credentials are incomplete. Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.");
    return null;
  }

  try {
    if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

    firebaseDb = getFirestore();
    return firebaseDb;
  } catch (error) {
    firebaseInitError = error;
    console.error("Firebase Admin initialization failed:", error?.message || error);
    return null;
  }
}

const db = initFirebase();

export function getDb() {
  const currentDb = initFirebase();
  if (!currentDb) {
    throw new Error(firebaseInitError?.message || "Firebase is not available right now.");
  }
  return currentDb;
}

export function getFirebaseError() {
  return firebaseInitError;
}

export { db, FieldValue };
