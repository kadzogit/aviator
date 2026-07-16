import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();
const db = getFirestore();

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { adminUid } = req.body;
  if (!adminUid) return res.status(400).json({ error: "Missing adminUid" });

  try {
    const adminDoc = await db.collection("users").doc(adminUid).get();
    if (!adminDoc.exists || !["admin","superadmin"].includes(adminDoc.data().role)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const snap = await db.collection("users").get();
    res.status(200).json({
      users: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
