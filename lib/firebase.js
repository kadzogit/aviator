import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function loadEnvFallback() {
  const candidates = [
    join(process.cwd(), ".env.local"),
    join(process.cwd(), "..", ".env.local"),
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
          const value = rawValue
            .replace(/^"|"$/g, "")
            .replace(/\\n/g, "\n");

          if (!process.env[currentKey]) {
            process.env[currentKey] = value;
          }

          currentKey = null;
          currentParts = [];
        }

        continue;
      }

      if (!trimmed || trimmed.startsWith("#")) continue;

      const i = trimmed.indexOf("=");
      if (i === -1) continue;

      const key = trimmed.slice(0, i).trim();
      let value = trimmed.slice(i + 1).trim();

      if (
        !process.env[key] &&
        value.startsWith('"') &&
        !value.endsWith('"')
      ) {
        currentKey = key;
        currentParts = [value.slice(1)];
        continue;
      }

      if (!process.env[key]) {
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        if (
          key === "FIREBASE_PRIVATE_KEY" ||
          key === "FIREBASE_PRIVATE_KEY_BASE64"
        ) {
          value = value.replace(/\\n/g, "\n");
        }

        process.env[key] = value;
      }
    }

    break;
  }
}

loadEnvFallback();

function resolvePrivateKey() {
  let key =
    process.env.FIREBASE_PRIVATE_KEY_BASE64 ||
    process.env.FIREBASE_PRIVATE_KEY ||
    "";

  if (!key) return "";

  key = String(key).trim();

  key = key.replace(/^['"]|['"]$/g, "");

  if (!key.includes("BEGIN PRIVATE KEY")) {
    try {
      key = Buffer.from(key, "base64").toString("utf8");
    } catch {}
  }

  key = key.replace(/\\r\\n/g, "\n");
  key = key.replace(/\\n/g, "\n");
  key = key.replace(/\r\n/g, "\n");
  key = key.replace(/\r/g, "\n");

  key = key.trim();

  key = key.replace(
    /-----BEGIN PRIVATE KEY-----\s*/,
    "-----BEGIN PRIVATE KEY-----\n"
  );

  key = key.replace(
    /\s*-----END PRIVATE KEY-----/,
    "\n-----END PRIVATE KEY-----"
  );

  console.log("KEY START:", key.substring(0, 40));
  console.log("KEY END:", key.substring(key.length - 40));
  console.log("KEY LENGTH:", key.length);

  return key;
}

let firebaseDb = null;
let firebaseInitError = null;

function initFirebase() {
  if (firebaseDb) return firebaseDb;

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID;

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = resolvePrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    firebaseInitError = new Error(
      "Firebase Admin credentials are incomplete."
    );
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
    console.error(
      "Firebase Admin initialization failed:",
      error?.message || error
    );
    return null;
  }
}

const db = initFirebase();

export function getDb() {
  const currentDb = initFirebase();

  if (!currentDb) {
    throw firebaseInitError;
  }

  return currentDb;
}

export function getFirebaseError() {
  return firebaseInitError;
}

export { db, FieldValue };