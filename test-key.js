import { cert } from "firebase-admin/app";

try {
  cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  });

  console.log("VALID KEY");
} catch (e) {
  console.error(e);
}